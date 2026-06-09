/* Helper: get linked roommate IDs from a guest (handles both old and new field) */
function getLinkedIds(g) {
  if (Array.isArray(g.roommateIds) && g.roommateIds.length > 0) return g.roommateIds;
  if (g.roommateId) return [g.roommateId];
  return [];
}

/* Build bidirectional travel-with clusters from unassigned guests */
function buildTravelWithClusters(guests) {
  const linkMap = {};
  guests.forEach(g => {
    getLinkedIds(g).forEach(rmId => {
      if (!linkMap[g.id]) linkMap[g.id] = new Set();
      if (!linkMap[rmId]) linkMap[rmId] = new Set();
      linkMap[g.id].add(rmId);
      linkMap[rmId].add(g.id);
    });
  });

  const guestMap = Object.fromEntries(guests.map(g => [g.id, g]));
  const visited = new Set();
  const clusters = [];

  guests.forEach(g => {
    if (visited.has(g.id) || !linkMap[g.id]) return;
    const cluster = [];
    const queue = [g.id];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      if (guestMap[id]) cluster.push(guestMap[id]);
      if (linkMap[id]) linkMap[id].forEach(rmId => { if (!visited.has(rmId)) queue.push(rmId); });
    }
    if (cluster.length > 1) clusters.push(cluster);
  });

  return clusters;
}

/**
 * Auto-allocation algorithm.
 * Assigns unassigned guests to rooms based on enabled rules + scoring.
 * Returns { [guestId]: roomId } for newly assigned guests.
 */
export function autoAllocate(guests, accommodation, rules, existingStays = [], startDate = '', endDate = '') {
  const enabledRules = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  // Build a mutable room map: roomId → roomData + currentGuests[]
  const roomMap = {};
  accommodation.floors.forEach((floor, idx) => {
    floor.corridors.forEach(corridor => {
      corridor.rooms.forEach((room, roomIdx) => {
        roomMap[room.id] = {
          ...room,
          floorId: floor.id,
          floorIndex: idx,
          floorNumber: floor.number,
          corridorId: corridor.id,
          corridorName: corridor.name,
          roomIndex: roomIdx,
          currentGuests: [],
        };
      });
    });
  });

  // Pre-populate with existing stays from other projects that overlap in time
  const projStart = startDate;
  const projEnd = endDate;

  existingStays.forEach(s => {
    const sIn = s.arrivalDate ? parseItalianDateAllocSafe(s.arrivalDate) : s.projStart;
    const sOut = s.departureDate ? parseItalianDateAllocSafe(s.departureDate) : s.projEnd;
    const hasOverlap = (sIn < projEnd && sOut > projStart);
    if (hasOverlap && s.roomId && roomMap[s.roomId]) {
      roomMap[s.roomId].currentGuests.push({ ...s, isGhost: true });
    }
  });

  // Pre-populate already-assigned guests in CURRENT project (pinned)
  guests.forEach(g => {
    if (g.roomId && roomMap[g.roomId]) {
      roomMap[g.roomId].currentGuests.push(g);
    }
  });

  // Only assign unassigned guests
  const toAssign = guests.filter(g => !g.roomId);

  const assignments = {};
  const clusterAssigned = new Set();

  // ── PHASE 1: Travel-with cluster pre-pass ──────────────────────────────
  // Assign linked guests together (same room or adjacent) before everything else.
  const clusters = buildTravelWithClusters(toAssign);

  for (const cluster of clusters) {
    const members = cluster.filter(g => !clusterAssigned.has(g.id));
    if (members.length === 0) continue;

    // Try to fit the whole cluster in one room
    const singleRoom = Object.values(roomMap)
      .filter(room => {
        if (room.status === 'unavailable') return false;
        if (room.currentGuests.length + members.length > room.capacity) return false;
        return members.every(g => isValid(room, g, roomMap, enabledRules));
      })
      .sort((a, b) => {
        // Prefer rooms that are already partially filled by same group
        const aScore = a.currentGuests.filter(g => g.group === members[0].group).length;
        const bScore = b.currentGuests.filter(g => g.group === members[0].group).length;
        return bScore - aScore;
      })[0];

    if (singleRoom) {
      members.forEach(g => {
        assignments[g.id] = singleRoom.id;
        singleRoom.currentGuests.push(g);
        clusterAssigned.add(g.id);
      });
      continue;
    }

    // For pairs: try adjacent rooms in the same corridor
    if (members.length === 2) {
      const [gA, gB] = members;
      const roomList = Object.values(roomMap).filter(r => r.status !== 'unavailable');
      let placed = false;
      for (let i = 0; i < roomList.length && !placed; i++) {
        for (let j = i + 1; j < roomList.length && !placed; j++) {
          const rA = roomList[i], rB = roomList[j];
          if (rA.corridorId !== rB.corridorId) continue;
          if (Math.abs(rA.roomIndex - rB.roomIndex) !== 1) continue;
          if (rA.currentGuests.length >= rA.capacity || rB.currentGuests.length >= rB.capacity) continue;
          if (isValid(rA, gA, roomMap, enabledRules) && isValid(rB, gB, roomMap, enabledRules)) {
            assignments[gA.id] = rA.id; rA.currentGuests.push(gA); clusterAssigned.add(gA.id);
            assignments[gB.id] = rB.id; rB.currentGuests.push(gB); clusterAssigned.add(gB.id);
            placed = true;
          } else if (isValid(rA, gB, roomMap, enabledRules) && isValid(rB, gA, roomMap, enabledRules)) {
            assignments[gB.id] = rA.id; rA.currentGuests.push(gB); clusterAssigned.add(gB.id);
            assignments[gA.id] = rB.id; rB.currentGuests.push(gA); clusterAssigned.add(gA.id);
            placed = true;
          }
        }
      }
    }

    // For larger clusters that don't fit one room: assign consecutively so the scoring
    // of subsequent members is informed by the already-placed ones.
    // (handled by the normal loop below since clusterAssigned won't include unplaced members)
  }

  // ── PHASE 2: Normal scoring-based assignment for remaining guests ──────
  const ageProxRule = enabledRules.find(r => r.type === 'age_proximity');
  const ageOrderRule = enabledRules.find(r => r.type === 'age_floor_order');
  const groupRule = enabledRules.find(r => r.type === 'maximize_group');

  const topAgePriority = Math.min(
    ageProxRule ? ageProxRule.priority : Infinity,
    ageOrderRule ? ageOrderRule.priority : Infinity
  );

  const sortPrimary = (topAgePriority < Infinity && groupRule)
    ? (topAgePriority < groupRule.priority ? 'age' : 'group')
    : (topAgePriority < Infinity ? 'age' : 'group');

  const remaining = toAssign.filter(g => !clusterAssigned.has(g.id));

  // Split: assign students/LiA-students first, then GL/LiA last
  // This ensures supervisors can see which corridors need coverage
  const isStaffRole = g => g.role === 'GL' || g.role === 'LiA';
  const students   = remaining.filter(g => !isStaffRole(g));
  const supervisors = remaining.filter(g => isStaffRole(g));

  const groupCounts = {};
  remaining.forEach(g => { groupCounts[g.group] = (groupCounts[g.group] || 0) + 1; });

  const withLinks    = students.filter(g => getLinkedIds(g).length > 0);
  const withoutLinks = students.filter(g => getLinkedIds(g).length === 0);

  const sortFn = (a, b) => {
    if (sortPrimary === 'age') {
      const ageDiff = a.age - b.age;
      if (ageDiff !== 0) return ageDiff;
      const gDiff = (groupCounts[b.group] || 0) - (groupCounts[a.group] || 0);
      if (gDiff !== 0) return gDiff;
      if (a.group !== b.group) return (a.group || '').localeCompare(b.group || '');
      return (a.sex || '').localeCompare(b.sex || '');
    } else {
      const gDiff = (groupCounts[b.group] || 0) - (groupCounts[a.group] || 0);
      if (gDiff !== 0) return gDiff;
      if (a.group !== b.group) return (a.group || '').localeCompare(b.group || '');
      if (a.sex !== b.sex) return (a.sex || '').localeCompare(b.sex || '');
      return a.age - b.age;
    }
  };

  // Students: linked first (travel-with), then the rest; supervisors last
  const sorted = [
    ...withLinks.sort(sortFn),
    ...withoutLinks.sort(sortFn),
    ...supervisors.sort(sortFn),
  ];

  const allAges = guests.map(g => g.age).filter(a => a > 0);
  const globalStats = {
    minAge: allAges.length > 0 ? Math.min(...allAges) : 0,
    maxAge: allAges.length > 0 ? Math.max(...allAges) : 100,
    numFloors: accommodation.floors.length
  };

  // Sex rules are non-negotiable for regular guests (GL and LiA are exempt)
  const sexRules = enabledRules.filter(r => r.type === 'same_sex_room' || r.type === 'same_sex_corridor');

  for (const guest of sorted) {
    const isStaff = guest.role === 'GL' || guest.role === 'LiA';

    for (let count = enabledRules.length; count >= 0; count--) {
      let activeRules = enabledRules.slice(0, count);

      // For non-staff, always keep sex rules active regardless of relaxation level
      if (!isStaff && sexRules.length > 0) {
        const sexTypes = new Set(sexRules.map(r => r.type));
        activeRules = [...activeRules.filter(r => !sexTypes.has(r.type)), ...sexRules];
      }

      const candidates = Object.values(roomMap)
        .filter(room => {
          if (room.status === 'unavailable') return false;
          if (room.currentGuests.length >= room.capacity) return false;
          return isValid(room, guest, roomMap, activeRules);
        })
        .map(room => ({ room, score: scoreRoom(room, guest, roomMap, activeRules, enabledRules.length, globalStats) }))
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const best = candidates[0].room;
        assignments[guest.id] = best.id;
        best.currentGuests.push(guest);
        break;
      }
    }
    // If no room found, guest remains unassigned (pending) — intentional
  }

  return assignments;
}

function isValid(room, guest, roomMap, rules) {
  for (const rule of rules) {
    switch (rule.type) {
      case 'same_sex_room': {
        if (room.currentGuests.some(g => g.sex !== guest.sex)) return false;
        break;
      }
      case 'same_sex_corridor': {
        const corridorGuests = getCorridorGuests(room.corridorId, roomMap);
        if (corridorGuests.some(g => g.sex !== guest.sex)) return false;
        break;
      }
      case 'age_proximity': {
        const { maxAgeDiff = 3 } = rule.params;
        const floorGuests = getFloorGuests(room.floorId, roomMap);
        if (floorGuests.length > 0) {
          const avgAge = floorGuests.reduce((sum, g) => sum + g.age, 0) / floorGuests.length;
          if (Math.abs(guest.age - avgAge) > maxAgeDiff) return false;
        }
        break;
      }
    }
  }
  return true;
}

function scoreRoom(room, guest, roomMap, activeRules, maxRulesCount, globalStats) {
  let s = 0;

  for (let i = 0; i < activeRules.length; i++) {
    const rule = activeRules[i];
    // Weight exponentially by priority (lowest index = highest priority)
    const weight = Math.pow(10, maxRulesCount - i);

    switch (rule.type) {
      case 'maximize_group': {
        const sameInRoom = room.currentGuests.filter(g => g.group === guest.group).length;
        s += sameInRoom * weight * 2;
        const sameInCorridor = getCorridorGuests(room.corridorId, roomMap)
          .filter(g => g.group === guest.group).length;
        s += sameInCorridor * weight;
        break;
      }
      case 'same_sex_corridor': {
        const corridorGuests = getCorridorGuests(room.corridorId, roomMap);
        if (corridorGuests.length === 0) s += weight * 0.5;
        else if (corridorGuests.every(g => g.sex === guest.sex)) s += weight;
        break;
      }
      case 'age_proximity': {
        const floorGuests = getFloorGuests(room.floorId, roomMap);
        const corridorGuests = getCorridorGuests(room.corridorId, roomMap);
        
        let bonus = 0;
        
        // Punteggio per la prossimità nel corridoio (prioritario rispetto al piano intero)
        if (corridorGuests.length === 0) {
          bonus += weight * 0.6; // Corridoio vuoto, ottimo per iniziare
        } else {
          const avgCorrAge = corridorGuests.reduce((sum, g) => sum + g.age, 0) / corridorGuests.length;
          const corrDiff = Math.abs(guest.age - avgCorrAge);
          bonus += Math.max(0, weight * (1 - corrDiff / 8)); // Più scalato: diff=0 -> full weight, diff>=8 -> 0
        }

        // Punteggio secondario per la prossimità nel piano intero
        if (floorGuests.length === 0) {
          bonus += weight * 0.2; 
        } else {
          const avgFloorAge = floorGuests.reduce((sum, g) => sum + g.age, 0) / floorGuests.length;
          const floorDiff = Math.abs(guest.age - avgFloorAge);
          bonus += Math.max(0, (weight * 0.5) * (1 - floorDiff / 12));
        }

        s += bonus;
        break;
      }
      case 'age_floor_order': {
        const { minAge, maxAge, numFloors } = globalStats || {};
        if (numFloors > 1 && maxAge > minAge && guest.age) {
          const agePercentile = (guest.age - minAge) / (maxAge - minAge); // 0 (più piccoli) a 1 (più grandi)
          const floorPercentile = room.floorIndex / (numFloors - 1); // 0 (piano basso) a 1 (piano alto)
          const diff = Math.abs(agePercentile - floorPercentile);
          // Assegna il punteggio: massima aderenza (diff=0) -> weight intero maggiorato
          s += weight * 20 * (1 - diff);
        }
        break;
      }
      case 'spread_gl': {
        if (guest.role !== 'GL' && guest.role !== 'LiA') break;
        const corridorGuests = getCorridorGuests(room.corridorId, roomMap);
        // Students from this supervisor's group in the corridor
        const sameGroupStudents = corridorGuests.filter(g =>
          g.group === guest.group && g.role !== 'GL' && g.role !== 'LiA'
        ).length;
        // Supervisors already covering this group in the corridor
        const sameGroupSupervisors = corridorGuests.filter(g =>
          g.group === guest.group && (g.role === 'GL' || g.role === 'LiA')
        ).length;

        if (sameGroupStudents > 0 && sameGroupSupervisors === 0) {
          // Unsupervised students from my group here — strong pull
          s += weight * (4 + sameGroupStudents);
        } else if (sameGroupStudents > 0 && sameGroupSupervisors > 0) {
          // Already covered — slight penalty to spread supervisors
          s -= weight;
        } else {
          // No students from my group — mild penalty
          s -= weight * 0.5;
        }
        break;
      }
      case 'roommate_link': {
        const rmIds = Array.isArray(guest.roommateIds) && guest.roommateIds.length > 0
          ? guest.roommateIds
          : (guest.roommateId ? [guest.roommateId] : []);
        for (const rmId of rmIds) {
          const roommateEntry = Object.values(roomMap).find(r => r.currentGuests.some(cg => cg.id === rmId));
          if (roommateEntry) {
            if (roommateEntry.id === room.id) {
              s += weight * 10000; // stessa stanza
            } else if (roommateEntry.corridorId === room.corridorId && Math.abs(roommateEntry.roomIndex - room.roomIndex) === 1) {
              s += weight * 5000;  // affiancati (stanze adiacenti)
            } else if (roommateEntry.corridorId === room.corridorId) {
              s += weight * 2000;  // vicini (stesso corridoio)
            }
          }
        }
        break;
      }
    }
  }


  // Prefer partially filled rooms (consolidate before spreading)
  s += room.currentGuests.length * 5;

  return s;
}

function getCorridorGuests(corridorId, roomMap) {
  return Object.values(roomMap)
    .filter(r => r.corridorId === corridorId)
    .flatMap(r => r.currentGuests);
}

function getFloorGuests(floorId, roomMap) {
  return Object.values(roomMap)
    .filter(r => r.floorId === floorId)
    .flatMap(r => r.currentGuests);
}

/**
 * Validate an assignment against active rules.
 * Returns array of warning strings (empty = no violations).
 */
export function checkViolations(guest, room, allGuests, accommodation, rules) {
  const warnings = [];
  const enabledRules = rules.filter(r => r.enabled);

  // Build corridor/room guest lists
  const roomGuests = allGuests.filter(g => g.roomId === room.id && g.id !== guest.id);

  // Build corridor rooms
  const corridorRooms = [];
  accommodation.floors.forEach(f =>
    f.corridors.forEach(c => {
      if (c.rooms.some(r => r.id === room.id)) {
        c.rooms.forEach(r => corridorRooms.push(r));
      }
    })
  );
  const corridorGuests = allGuests.filter(g =>
    g.id !== guest.id && corridorRooms.some(r => r.id === g.roomId)
  );

  for (const rule of enabledRules) {
    switch (rule.type) {
      case 'same_sex_room':
        if (roomGuests.some(g => g.sex !== guest.sex))
          warnings.push('Violates: same sex per room');
        break;
      case 'same_sex_corridor':
        if (corridorGuests.some(g => g.sex !== guest.sex))
          warnings.push('Violates: same sex per corridor');
        break;
      case 'age_proximity': {
        const { maxAgeDiff = 3 } = rule.params;
        const floorRooms = [];
        accommodation.floors.forEach(f => {
          if (f.corridors.some(c => c.rooms.some(r => r.id === room.id))) {
            f.corridors.forEach(c => c.rooms.forEach(r => floorRooms.push(r)));
          }
        });
        const floorGuests = allGuests.filter(g => g.id !== guest.id && floorRooms.some(r => r.id === g.roomId));
        if (floorGuests.length > 0) {
          const avgAge = floorGuests.reduce((sum, g) => sum + g.age, 0) / floorGuests.length;
          if (Math.abs(guest.age - avgAge) > maxAgeDiff) {
            warnings.push(`Violates: age too far from floor average (> ${maxAgeDiff} years)`);
          }
        }
        break;
      }
      case 'spread_gl': {
        if (guest.role !== 'GL' && guest.role !== 'LiA') break;
        const corridorRoomIds = new Set(corridorRooms.map(r => r.id));
        const corrGuests = allGuests.filter(g => g.id !== guest.id && corridorRoomIds.has(g.roomId));
        const sameGroupSupervisors = corrGuests.filter(g => g.group === guest.group && (g.role === 'GL' || g.role === 'LiA')).length;
        const sameGroupStudents = corrGuests.filter(g => g.group === guest.group && g.role !== 'GL' && g.role !== 'LiA').length;
        if (sameGroupSupervisors > 0)
          warnings.push('Supervisor coverage: another supervisor from this group is already in this corridor');
        if (sameGroupStudents === 0)
          warnings.push('Supervisor coverage: no students from this group in this corridor');
        break;
      }
    }
  }

  return warnings;
}

function parseItalianDateAllocSafe(str) {
  if (!str) return '';
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return str;
}

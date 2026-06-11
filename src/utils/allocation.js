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

  // Compute global age stats upfront — needed by both Phase 1 and Phase 2
  const allAgesEarly = guests.map(g => g.age).filter(a => a > 0);
  const globalStats = {
    minAge: allAgesEarly.length > 0 ? Math.min(...allAgesEarly) : 0,
    maxAge: allAgesEarly.length > 0 ? Math.max(...allAgesEarly) : 100,
    numFloors: accommodation.floors.length
  };

  // ── PHASE 1: Travel-with cluster pre-pass ──────────────────────────────
  // Assign linked guests together (same room or adjacent) before everything else.
  // Uses floor-based age score as fallback when corridors are still empty.
  const clusters = buildTravelWithClusters(toAssign);

  for (const cluster of clusters) {
    const members = cluster.filter(g => !clusterAssigned.has(g.id));
    if (members.length === 0) continue;

    const clusterAvgAge = members.reduce((s, g) => s + (g.age || 0), 0) / members.length;

    // When a corridor is empty, estimate suitability from the floor's position
    // relative to the cluster's age percentile across all guests.
    const floorAgeScore = (floorIndex) => {
      const { minAge, maxAge, numFloors } = globalStats;
      if (numFloors <= 1 || maxAge <= minAge || !clusterAvgAge) return 0;
      const pct = Math.min(1, Math.max(0, (clusterAvgAge - minAge) / (maxAge - minAge)));
      return -Math.abs(floorIndex - pct * (numFloors - 1));
    };

    const corridorAgeScore = (corridorId, floorIndex) => {
      const cg = getCorridorGuests(corridorId, roomMap);
      if (cg.length === 0) return floorAgeScore(floorIndex);
      const avg = cg.reduce((s, g) => s + (g.age || 0), 0) / cg.length;
      return -Math.abs(clusterAvgAge - avg);
    };

    // Try to fit the whole cluster in one room
    const singleRoom = Object.values(roomMap)
      .filter(room => {
        if (room.status === 'unavailable') return false;
        if (room.currentGuests.length + members.length > room.capacity) return false;
        return members.every(g => isValid(room, g, roomMap, enabledRules));
      })
      .sort((a, b) => {
        const groupA = a.currentGuests.filter(g => g.group === members[0].group).length * 10;
        const groupB = b.currentGuests.filter(g => g.group === members[0].group).length * 10;
        return (groupB + corridorAgeScore(b.corridorId, b.floorIndex)) -
               (groupA + corridorAgeScore(a.corridorId, a.floorIndex));
      })[0];

    if (singleRoom) {
      members.forEach(g => {
        assignments[g.id] = singleRoom.id;
        singleRoom.currentGuests.push(g);
        clusterAssigned.add(g.id);
      });
      continue;
    }

    // For pairs: collect all valid adjacent-room combinations, pick best age-affinity floor
    if (members.length === 2) {
      const [gA, gB] = members;
      const roomList = Object.values(roomMap).filter(r => r.status !== 'unavailable');
      const validPairs = [];

      for (let i = 0; i < roomList.length; i++) {
        for (let j = i + 1; j < roomList.length; j++) {
          const rA = roomList[i], rB = roomList[j];
          if (rA.corridorId !== rB.corridorId) continue;
          if (Math.abs(rA.roomIndex - rB.roomIndex) !== 1) continue;
          if (rA.currentGuests.length >= rA.capacity || rB.currentGuests.length >= rB.capacity) continue;
          if (isValid(rA, gA, roomMap, enabledRules) && isValid(rB, gB, roomMap, enabledRules)) {
            validPairs.push({ r1: rA, r2: rB, g1: gA, g2: gB });
          } else if (isValid(rA, gB, roomMap, enabledRules) && isValid(rB, gA, roomMap, enabledRules)) {
            validPairs.push({ r1: rA, r2: rB, g1: gB, g2: gA });
          }
        }
      }

      if (validPairs.length > 0) {
        validPairs.sort((a, b) =>
          corridorAgeScore(b.r1.corridorId, b.r1.floorIndex) -
          corridorAgeScore(a.r1.corridorId, a.r1.floorIndex)
        );
        const best = validPairs[0];
        assignments[best.g1.id] = best.r1.id; best.r1.currentGuests.push(best.g1); clusterAssigned.add(best.g1.id);
        assignments[best.g2.id] = best.r2.id; best.r2.currentGuests.push(best.g2); clusterAssigned.add(best.g2.id);
      }
    }

    // Larger clusters that don't fit one room are handled by Phase 2 via normal scoring.
  }

  // ── PHASE 2: Corridor-first assignment ───────────────────────────────────
  // For each corridor: fill to (capacity - 1) with students, then place 1 GL/LiA.
  // If no supervisor is available for that corridor, fill the last slot with a student.
  const ageProxRule  = enabledRules.find(r => r.type === 'age_proximity');
  const ageOrderRule = enabledRules.find(r => r.type === 'age_floor_order');
  const groupRule    = enabledRules.find(r => r.type === 'maximize_group');

  const topAgePriority = Math.min(
    ageProxRule  ? ageProxRule.priority  : Infinity,
    ageOrderRule ? ageOrderRule.priority : Infinity
  );
  const sortPrimary = (topAgePriority < Infinity && groupRule)
    ? (topAgePriority < groupRule.priority ? 'age' : 'group')
    : (topAgePriority < Infinity ? 'age' : 'group');

  const isStaffRole = g => g.role === 'GL' || g.role === 'LiA';
  const remaining = toAssign.filter(g => !clusterAssigned.has(g.id));

  const students    = remaining.filter(g => !isStaffRole(g));
  const supervisors = remaining.filter(g => isStaffRole(g));

  const groupCounts = {};
  remaining.forEach(g => { groupCounts[g.group] = (groupCounts[g.group] || 0) + 1; });

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

  const sexRules = enabledRules.filter(r => r.type === 'same_sex_room' || r.type === 'same_sex_corridor');

  // Priority: GL before LiA, then by sortFn within same role
  const unplacedSupervisors = [...supervisors].sort((a, b) => {
    if (a.role === 'GL' && b.role !== 'GL') return -1;
    if (b.role === 'GL' && a.role !== 'GL') return 1;
    return sortFn(a, b);
  });
  const unplacedStudents = new Set(students.map(g => g.id));

  // Build corridor list from accommodation structure
  const corridorSlots = [];
  accommodation.floors.forEach(floor => {
    floor.corridors.forEach(corridor => {
      const rooms = corridor.rooms
        .map(r => roomMap[r.id])
        .filter(Boolean)
        .filter(r => r.status !== 'unavailable');
      if (rooms.length > 0) corridorSlots.push({ corridorId: corridor.id, rooms });
    });
  });

  for (const { corridorId, rooms } of corridorSlots) {
    // Reserve 1 bed for a supervisor if any are still available
    const hasPotentialSup = unplacedSupervisors.length > 0 &&
                            rooms.some(r => r.currentGuests.length < r.capacity);
    const totalAvailable = rooms.reduce((s, r) => s + Math.max(0, r.capacity - r.currentGuests.length), 0);
    const bedsForStudents = hasPotentialSup ? Math.max(0, totalAvailable - 1) : totalAvailable;

    // Score all unplaced students for this corridor and pick the best ones
    const eligible = students
      .filter(g => unplacedStudents.has(g.id))
      .map(g => {
        const best = rooms
          .filter(r => r.currentGuests.length < r.capacity && isValid(r, g, roomMap, enabledRules))
          .map(r => scoreRoom(r, g, roomMap, enabledRules, enabledRules.length, globalStats))
          .sort((a, b) => b - a);
        return best.length > 0 ? { guest: g, bestScore: best[0] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ageDiff = (a.guest.age || 0) - (b.guest.age || 0);
        return ageDiff !== 0 ? ageDiff : b.bestScore - a.bestScore;
      });

    let placed = 0;
    for (const { guest } of eligible) {
      if (placed >= bedsForStudents) break;
      const roomCandidates = rooms
        .filter(r => r.currentGuests.length < r.capacity && isValid(r, guest, roomMap, enabledRules))
        .map(r => ({ room: r, score: scoreRoom(r, guest, roomMap, enabledRules, enabledRules.length, globalStats) }))
        .sort((a, b) => b.score - a.score);
      if (roomCandidates.length > 0) {
        const best = roomCandidates[0].room;
        assignments[guest.id] = best.id;
        best.currentGuests.push(guest);
        unplacedStudents.delete(guest.id);
        placed++;
      }
    }

    // Now that students are placed, pick the best supervisor based on actual corridor state
    if (hasPotentialSup) {
      const corrStudents = getCorridorGuests(corridorId, roomMap).filter(g => !isStaffRole(g));
      const sexMatch = (sup) =>
        corrStudents.length === 0 || corrStudents.every(g => g.sex === sup.sex);
      const groupScore = (sup) =>
        corrStudents.filter(g => g.group === sup.group).length;

      const hasRoomNow = rooms.some(r => r.currentGuests.length < r.capacity);
      const scoredSups = unplacedSupervisors
        .map((sup, idx) => ({ sup, idx, sexOk: sexMatch(sup) }))
        .filter(() => hasRoomNow)
        .sort((a, b) => {
          const gDiff = groupScore(b.sup) - groupScore(a.sup);
          if (gDiff !== 0) return gDiff;
          if (a.sexOk !== b.sexOk) return a.sexOk ? -1 : 1;
          return 0;
        });

      const supIdx = scoredSups.length > 0 ? scoredSups[0].idx : -1;
      if (supIdx !== -1) {
        const sup = unplacedSupervisors[supIdx];
        const supRoom = rooms
          .filter(r => r.currentGuests.length < r.capacity)
          .sort((a, b) => b.currentGuests.length - a.currentGuests.length)[0];
        if (supRoom) {
          assignments[sup.id] = supRoom.id;
          supRoom.currentGuests.push(sup);
          unplacedSupervisors.splice(supIdx, 1);
        }
      }
    }
  }

  // ── Fallback: place any remaining guests with normal scoring ──────────────
  const remainingAll = [
    ...students.filter(g => unplacedStudents.has(g.id)).sort(sortFn),
    ...unplacedSupervisors,
  ];

  for (const guest of remainingAll) {
    const isStaff = isStaffRole(guest);
    for (let count = enabledRules.length; count >= 0; count--) {
      let activeRules = enabledRules.slice(0, count);
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
        // Adults (>18) and supervisors are exempt — age proximity only constrains minors
        if (guest.age > 18 || guest.role === 'GL' || guest.role === 'LiA') break;
        const { maxAgeDiff = 3 } = rule.params;
        const floorGuests = getFloorGuests(room.floorId, roomMap)
          .filter(g => g.age > 0 && g.age <= 18 && g.role !== 'GL' && g.role !== 'LiA');
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
        // Adults (>18) and supervisors don't participate in age proximity scoring
        if (guest.age > 18 || guest.role === 'GL' || guest.role === 'LiA') break;
        const isMinorNonStaff = g => g.age > 0 && g.age <= 18 && g.role !== 'GL' && g.role !== 'LiA';
        const floorGuests = getFloorGuests(room.floorId, roomMap).filter(isMinorNonStaff);
        const corridorGuests = getCorridorGuests(room.corridorId, roomMap).filter(isMinorNonStaff);

        let bonus = 0;

        if (corridorGuests.length === 0) {
          bonus += weight * 0.6;
        } else {
          const avgCorrAge = corridorGuests.reduce((sum, g) => sum + g.age, 0) / corridorGuests.length;
          const corrDiff = Math.abs(guest.age - avgCorrAge);
          bonus += Math.max(0, weight * (1 - corrDiff / 8));
        }

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
        const anyGLInCorridor = corridorGuests.some(g => g.role === 'GL' || g.role === 'LiA');
        const sameGroupStudents = corridorGuests.filter(g =>
          g.group === guest.group && g.role !== 'GL' && g.role !== 'LiA'
        ).length;
        const sameGroupSupervisors = corridorGuests.filter(g =>
          g.group === guest.group && (g.role === 'GL' || g.role === 'LiA')
        ).length;

        if (!anyGLInCorridor) {
          // Primary goal: corridor has no GL at all — strong pull
          s += weight * 8;
          // Tiebreaker: prefer corridors that also have my group's students
          if (sameGroupStudents > 0) s += weight * sameGroupStudents;
        } else if (sameGroupStudents > 0 && sameGroupSupervisors === 0) {
          // Corridor covered, but my group's students have no supervisor here — moderate pull
          s += weight * 2;
        } else {
          // Corridor already has a GL and my group is covered — push away to spread
          s -= weight;
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
        if (corridorGuests.filter(g => g.role !== 'GL' && g.role !== 'LiA').some(g => g.sex !== guest.sex))
          warnings.push('Violates: same sex per corridor');
        break;
      case 'age_proximity': {
        if (guest.age > 18 || guest.role === 'GL' || guest.role === 'LiA') break;
        const { maxAgeDiff = 3 } = rule.params;
        const floorRooms = [];
        accommodation.floors.forEach(f => {
          if (f.corridors.some(c => c.rooms.some(r => r.id === room.id))) {
            f.corridors.forEach(c => c.rooms.forEach(r => floorRooms.push(r)));
          }
        });
        const floorGuests = allGuests.filter(g =>
          g.id !== guest.id && g.age > 0 && g.age <= 18 &&
          g.role !== 'GL' && g.role !== 'LiA' &&
          floorRooms.some(r => r.id === g.roomId)
        );
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

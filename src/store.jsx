import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { loadCenterState, saveCenterState } from './firebase';
import { autoAllocate as runAutoAllocate } from './utils/allocation';

const AppContext = createContext(null);

export const DEFAULT_RULES = [
  { id: 'same-sex-room',    type: 'same_sex_room',    label: 'Same sex per room',         description: 'All guests in a room must be of the same gender.', enabled: true,  priority: 1, params: {} },
  { id: 'same-sex-corridor',type: 'same_sex_corridor', label: 'Same sex per corridor',    description: 'All guests in a corridor must be of the same gender.', enabled: true, priority: 2, params: {} },
  { id: 'age-proximity',    type: 'age_proximity',    label: 'Age proximity per floor',   description: 'Tries to assign people to the same floor minimising the average age deviation.', enabled: true, priority: 3, params: { maxAgeDiff: 3 } },
  { id: 'roommate-link',    type: 'roommate_link',    label: 'Honour Travel With links',  description: 'Forces/prioritises placing linked guests in the same room.', enabled: true, priority: 4, params: { weight: 100000 } },
  { id: 'maximize-group',   type: 'maximize_group',   label: 'Maximise group cohesion',   description: 'Tries to place guests from the same group in nearby rooms or corridors.', enabled: true, priority: 5, params: {} },
  { id: 'age-floor-order',  type: 'age_floor_order',  label: 'Age-based floor ordering',  description: 'Assigns younger guests to lower floors and older guests to higher floors.', enabled: false, priority: 6, params: {} },
  { id: 'spread-gl',        type: 'spread_gl',        label: 'Supervisor coverage per corridor', description: 'Ensures every corridor has at least one GL or LiA. Corridors with no supervisor are filled first; group affinity is used as a tiebreaker.', enabled: true, priority: 3, params: {} },
];

const BLANK_PROJECT = {
  accommodation: { name: '', floors: [] },
  startDate: '',
  endDate: '',
  rules: DEFAULT_RULES,
  guests: [],
  auditLog: [],
  undoStack: [],
  redoStack: [],
};

// Activity object shorthands
const _m  = (text = '', ...tags) => ({ type: 'meal',      text, tags });
const _c  = (text = '')          => ({ type: 'class',     text, tags: [] });
const _ex = (text = '', ...tags) => ({ type: 'excursion', text, tags });
const _ev = (text = '', ...tags) => ({ type: 'evening',      text, tags });
const _fd = (text = '', ...tags) => ({ type: 'fd_excursion', text, tags });
const _cu = (text = '')          => ({ type: 'custom',       text, tags: [] });

// Zig Zag A base schedule (14 days)
const ZZA_DAYS = [
  // G1 – Arrivo
  { breakfast: null, morning: null, lunch: null, afternoon: null, dinner: _m('', 'packed'), evening: _cu('Room allocation') },
  // G2
  { breakfast: _m(), morning: _c('Study vacation and course induction'), lunch: _m(), afternoon: _c('Placement Test + Class'), dinner: _m(), evening: _ev('LiA Welcome Party') },
  // G3
  { breakfast: _m(), morning: _ex('HD Camden Town'), lunch: _m(), afternoon: _c('Class (CEFR A1-C1)'), dinner: _m(), evening: _ev('LiA Quiz & Bingo') },
  // G4
  { breakfast: _m(), morning: _ex('HD British Museum'), lunch: _m(), afternoon: _c('Class (CEFR A1-C1)'), dinner: _m(), evening: _ev('Covent Garden', 'LBN') },
  // G5
  { breakfast: _m(), morning: _fd('FD City Centre Sightseeing Tour Day 1 (Green Park, Buckingham Palace, St. James Park, Westminster, Downing Street, Trafalgar Square, National Gallery) con packed lunch'), lunch: null, afternoon: null, dinner: _m(), evening: _ev('Movie Night') },
  // G6
  { breakfast: _m(), morning: _fd('FD Brighton by train con Brighton Pier', 'ticket_included'), lunch: null, afternoon: null, dinner: _m(), evening: _ev('Free Time') },
  // G7
  { breakfast: _m(), morning: _ex('HD London Eye', 'ticket_included'), lunch: _m(), afternoon: _c('Class (CEFR A1-C1)'), dinner: _m(), evening: _ev('LiA Karaoke') },
  // G8
  { breakfast: _m(), morning: _ex('HD Oxford Street Shopping & Oxford Circus'), lunch: _m(), afternoon: _c('Class (CEFR A1-C1)'), dinner: _m(), evening: _ev('London Monuments incl. Tower Bridge and Tower of London', 'LBN') },
  // G9
  { breakfast: _m(), morning: _c('Class (CEFR A1-C1)'), lunch: _m(), afternoon: _ex('HD Natural History Museum'), dinner: null, evening: _ev('Piccadilly & Leicester Square con Hard Rock Café Shopping (packed dinner)', 'LBN') },
  // G10
  { breakfast: _m(), morning: _c('Class (CEFR A1-C1)'), lunch: _m(), afternoon: _ex('HD Madame Tussauds', 'ticket_included'), dinner: _m(), evening: _ev('PopWorld Disco', 'LBN') },
  // G11
  { breakfast: _m(), morning: _c('Class (CEFR A1-C1)'), lunch: _m(), afternoon: _ex('HD Westfield Shopping Centre'), dinner: null, evening: _ev('Thames River Cruise', 'LBN', 'ticket_included') },
  // G12
  { breakfast: _m(), morning: _fd('FD City Centre Sightseeing Tour Day 2 (St Pauls, Millennium Bridge, Borough Market, Tate Modern, Southwark) con packed lunch'), lunch: null, afternoon: null, dinner: _m(), evening: _ev('LiA Trash Fashion Show') },
  // G13
  { breakfast: _m(), morning: _fd('FD Greenwich Observatory, Greenwich Park Picnic, and Urban Farm'), lunch: null, afternoon: null, dinner: _m(), evening: _ev('Free Time / Talent Contest Rehearsals') },
  // G14
  { breakfast: _m(), morning: _c('Class (CEFR A1-C1)'), lunch: _m(), afternoon: _ex('HD Portobello Road and Notting Hill'), dinner: _m(), evening: _ev("LiA's Got Talent & Last Night Party") },
];

// Zig Zag B = A with morning and afternoon swapped on each day
const swapMorningAfternoon = days => days.map(day =>
  day ? { ...day, morning: day.afternoon ?? null, afternoon: day.morning ?? null } : day
);

const initialState = {
  activeTab: 'allocazione', // 'strutture' | 'allocazione'
  listImproverTarget: null,
  isEditingAccommodation: false, // flag for the Strutture tab
  editingAllocationId: null, // the ID of the current project being edited
  currentStep: 0,
  selectedAccommodationId: null, // for booking view
  ...BLANK_PROJECT,
  currentUser: 'Gestore',
  savedAccommodations: [], // [{ id, name, date, data }]
  savedAllocations: [],   // [{ id, name, date, accommodation, guests, accommodationId, auditLog }]
  savedGuestLists: [],    // [{ id, name, date, guests }]
  savedGroups: [],        // [{ id, name, agent, arrivalDate, departureDate, guestCount, accommodationId, intakeId, schedule }]
  savedIntakes: [],       // [{ id, name, startDate, endDate }]
  activityLibrary: [],    // [{ id, type, text, tags }] — user-added custom activities
  scheduleTemplates: [
    { id: 'zza', name: 'Zig Zag A', days: ZZA_DAYS },
    { id: 'zzb', name: 'Zig Zag B', days: swapMorningAfternoon(ZZA_DAYS) },
  ],
};

// Carica da localStorage per persistenza istantanea
const loadPersistedState = () => {
  try {
    const saved = localStorage.getItem('allocation_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Mantieni la compatibilità unendo il blank project se mancano campi
      return { ...initialState, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load state', e);
  }
  return initialState;
};

function floorRoomIds(floor) {
  const ids = new Set();
  floor.corridors.forEach(c => c.rooms.forEach(r => ids.add(r.id)));
  return ids;
}

function deriveDates(guests) {
  let start = null;
  let end = null;
  
  guests.forEach(g => {
    // Check both arrival date and general project logic
    const aDate = g.arrivalDate;
    const dDate = g.departureDate;

    if (aDate) {
      const d = parseItalianDate(aDate);
      if (d && (!start || d < start)) start = d;
    }
    if (dDate) {
      const d = parseItalianDate(dDate);
      if (d && (!end || d > end)) end = d;
    }
  });

  return {
    start: start ? start.toISOString().split('T')[0] : null,
    end: end ? end.toISOString().split('T')[0] : null
  };
}

function parseItalianDate(str) {
  if (!str || typeof str !== 'string') return null;
  // Handle dd/mm/yyyy
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  // Handle yyyy-mm-dd
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function reducer(state, action) {
  const findRoomLabel = (id) => {
    if (!id) return null;
    let found = null;
    state.accommodation.floors.forEach(f => 
      f.corridors.forEach(c => 
        c.rooms.forEach(r => { if(r.id === id) found = r.number; })
      )
    );
    return found ? `Stanza ${found}` : `ID ${id}`;
  };

  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LIST_IMPROVER_TARGET':
      return { ...state, listImproverTarget: action.payload };
    case 'SET_IMPROVER_VERSION':
      return {
        ...state,
        savedGuestLists: state.savedGuestLists.map(l =>
          l.id === action.listId ? { ...l, improverLastVersion: l.version || 1 } : l
        )
      };
    case 'SET_EDITING_ACCOMMODATION':
      return { ...state, isEditingAccommodation: action.payload };
    case 'NEW_ACCOMMODATION':
      // Like NEW_PROJECT but stays on the current tab (used from Settings)
      return { ...state, accommodation: { name: '', floors: [] }, currentStep: 0, isEditingAccommodation: true };
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_SELECTED_ACCOMMODATION_ID':
      return { ...state, selectedAccommodationId: action.payload };

    case 'SET_ACCOMMODATION':
      return { ...state, accommodation: action.payload };

    // ── Floors ──
    case 'ADD_FLOOR':
      return { ...state, accommodation: { ...state.accommodation, floors: [...state.accommodation.floors, action.floor] } };

    case 'UPDATE_FLOOR':
      return { ...state, accommodation: { ...state.accommodation,
        floors: state.accommodation.floors.map(f => f.id === action.floor.id ? { ...f, ...action.floor } : f) } };

    case 'REMOVE_FLOOR': {
      const floor = state.accommodation.floors.find(f => f.id === action.floorId);
      const ids = floor ? floorRoomIds(floor) : new Set();
      return { ...state,
        accommodation: { ...state.accommodation, floors: state.accommodation.floors.filter(f => f.id !== action.floorId) },
        guests: state.guests.map(g => ids.has(g.roomId) ? { ...g, roomId: null } : g) };
    }

    // ── Corridors ──
    case 'ADD_CORRIDOR':
      return { ...state, accommodation: { ...state.accommodation,
        floors: state.accommodation.floors.map(f =>
          f.id === action.floorId ? { ...f, corridors: [...f.corridors, action.corridor] } : f) } };

    case 'REPLACE_CORRIDOR': {
      let oldCorridorData = null;
      state.accommodation.floors.forEach(f =>
        f.corridors.forEach(c => { if (c.id === action.corridorId) oldCorridorData = c; })
      );
      const oldIds = new Set(oldCorridorData?.rooms.map(r => r.id) || []);
      const newIds = new Set(action.corridor.rooms.map(r => r.id));
      const removedIds = new Set([...oldIds].filter(id => !newIds.has(id)));
      const newFloors = state.accommodation.floors.map(f => {
        let corridors = f.corridors.filter(c => c.id !== action.corridorId);
        if (f.id === action.targetFloorId) corridors = [...corridors, action.corridor];
        return { ...f, corridors };
      });
      return { ...state,
        accommodation: { ...state.accommodation, floors: newFloors },
        guests: state.guests.map(g => removedIds.has(g.roomId) ? { ...g, roomId: null } : g) };
    }

    case 'REMOVE_CORRIDOR': {
      const ids = new Set();
      state.accommodation.floors.forEach(f =>
        f.corridors.forEach(c => { if (c.id === action.corridorId) c.rooms.forEach(r => ids.add(r.id)); })
      );
      return { ...state,
        accommodation: { ...state.accommodation,
          floors: state.accommodation.floors.map(f => ({ ...f, corridors: f.corridors.filter(c => c.id !== action.corridorId) })) },
        guests: state.guests.map(g => ids.has(g.roomId) ? { ...g, roomId: null } : g) };
    }

    // ── Rooms ──
    case 'UPDATE_ROOM':
      return { ...state, accommodation: { ...state.accommodation,
        floors: state.accommodation.floors.map(f => ({ ...f,
          corridors: f.corridors.map(c => ({ ...c,
            rooms: c.rooms.map(r => r.id === action.room.id ? action.room : r) })) })) } };

    case 'SET_ROOMS_STATUS': {
      const map = {};
      action.updates.forEach(u => { map[u.roomId] = u; });
      return { ...state, accommodation: { ...state.accommodation,
        floors: state.accommodation.floors.map(f => ({ ...f,
          corridors: f.corridors.map(c => ({ ...c,
            rooms: c.rooms.map(r => map[r.id] ? { ...r, status: map[r.id].status, unavailableUntil: map[r.id].unavailableUntil } : r) })) })) } };
    }

    // ── Rules ──
    case 'SET_RULES':   return { ...state, rules: action.payload };
    case 'UPDATE_RULE': return { ...state, rules: state.rules.map(r => r.id === action.rule.id ? action.rule : r) };

    // ── Guests ──
    case 'SET_GUESTS': {
      const guests = action.payload;
      const { start, end } = deriveDates(guests);
      return { 
        ...state, 
        guests, 
        startDate: start || state.startDate, 
        endDate: end || state.endDate 
      };
    }
    case 'ADD_GUEST':     return { ...state, guests: [...state.guests, action.guest] };
    case 'UPDATE_GUEST':  return { ...state, guests: state.guests.map(g => g.id === action.guest.id ? action.guest : g) };
    case 'REMOVE_GUEST':  return { ...state, guests: state.guests.filter(g => g.id !== action.guestId) };
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const [prev, ...restUndo] = state.undoStack;
      return {
        ...state,
        guests: prev,
        undoStack: restUndo,
        redoStack: [state.guests, ...state.redoStack].slice(0, 50),
      };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const [next, ...restRedo] = state.redoStack;
      return {
        ...state,
        guests: next,
        redoStack: restRedo,
        undoStack: [state.guests, ...state.undoStack].slice(0, 50),
      };
    }
    case 'ASSIGN_ROOM': {
      const g = state.guests.find(x => x.id === action.guestId);
      const oldRoom = findRoomLabel(g?.roomId);
      const newRoom = findRoomLabel(action.roomId);
      const meta = `${g?.sex || '?'} · ${g?.age || '?'}y${g?.role ? ` · ${g.role}` : ''}`;

      const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        user: state.currentUser || 'User',
        type: 'assignment',
        guestName: g ? `${g.name} ${g.surname}` : 'Guest',
        details: g?.roomId
          ? `Moved from ${oldRoom} to ${newRoom} (${meta})`
          : `Assigned to ${newRoom} (${meta})`
      };
      return { ...state,
        guests: state.guests.map(g => g.id === action.guestId ? { ...g, roomId: action.roomId } : g),
        auditLog: [log, ...(state.auditLog || [])],
        undoStack: [state.guests, ...state.undoStack].slice(0, 50),
        redoStack: [],
      };
    }
    case 'UNASSIGN_GUEST': {
      const g = state.guests.find(x => x.id === action.guestId);
      const oldRoom = findRoomLabel(g?.roomId);
      const meta = `${g?.sex || '?'} · ${g?.age || '?'}y${g?.role ? ` · ${g.role}` : ''}`;

      const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        user: state.currentUser || 'User',
        type: 'unassignment',
        guestName: g ? `${g.name} ${g.surname}` : 'Guest',
        details: `Removed from ${oldRoom} (${meta})`
      };
      return { ...state,
        guests: state.guests.map(g => g.id === action.guestId ? { ...g, roomId: null } : g),
        auditLog: [log, ...(state.auditLog || [])],
        undoStack: [state.guests, ...state.undoStack].slice(0, 50),
        redoStack: [],
      };
    }

    case 'AUTO_ALLOCATE': {
      // Gather all other active stays for this structure across sessions
      const existingStays = [];
      state.savedAllocations.forEach(alloc => {
        // Only check other projects that use the SAME structure
        if (alloc.accommodationId === state.accommodationId && alloc.id !== state.editingAllocationId) {
          alloc.guests.forEach(g => {
            if (g.roomId) {
              existingStays.push({
                ...g,
                projStart: alloc.startDate,
                projEnd: alloc.endDate
              });
            }
          });
        }
      });

      const assignments = runAutoAllocate(
        state.guests, 
        state.accommodation, 
        state.rules, 
        existingStays, 
        state.startDate, 
        state.endDate
      );
      
      const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        user: 'System (AI)',
        type: 'auto_allocate',
        details: `Auto-allocation completed for ${Object.keys(assignments).length} guests.`
      };
      
      return {
        ...state,
        guests: state.guests.map(g => ({
          ...g,
          roomId: assignments[g.id] !== undefined ? assignments[g.id] : g.roomId
        })),
        auditLog: [log, ...(state.auditLog || [])],
        undoStack: [state.guests, ...state.undoStack].slice(0, 50),
        redoStack: [],
      };
    }

    case 'CLEAR_ALLOCATIONS':
      return {
        ...state,
        guests: state.guests.map(g => ({ ...g, roomId: null })),
        undoStack: [state.guests, ...state.undoStack].slice(0, 50),
        redoStack: [],
      };

    case 'SWAP_GUESTS': {
      const gA = state.guests.find(g => g.id === action.guestIdA);
      const gB = state.guests.find(g => g.id === action.guestIdB);
      if (!gA || !gB) return state;
      const roomA = gA.roomId;
      const roomB = gB.roomId;
      const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        user: state.currentUser || 'User',
        type: 'swap',
        details: `Swapped ${gA.name} ${gA.surname} and ${gB.name} ${gB.surname}`
      };

      return {
        ...state,
        guests: state.guests.map(g => {
          if (g.id === action.guestIdA) return { ...g, roomId: roomB };
          if (g.id === action.guestIdB) return { ...g, roomId: roomA };
          return g;
        }),
        auditLog: [log, ...(state.auditLog || [])],
        undoStack: [state.guests, ...state.undoStack].slice(0, 50),
        redoStack: [],
      };
    }

    // ── Saved allocations ──
    case 'SAVE_ALLOCATION': {
      if (state.editingAllocationId) {
        // Update existing
        return { 
          ...state, 
          savedAllocations: state.savedAllocations.map(a => 
            a.id === state.editingAllocationId 
              ? { 
                  ...a, 
                  name: action.name || a.name, 
                  date: new Date().toISOString(),
                  guests: JSON.parse(JSON.stringify(state.guests)),
                  auditLog: JSON.parse(JSON.stringify(state.auditLog || [])) 
                } 
              : a
          ) 
        };
      }

      // Create new
      const snap = {
        id: `alloc-${Date.now()}`,
        name: action.name,
        date: new Date().toISOString(),
        startDate: state.startDate || '',
        endDate: state.endDate || '',
        accommodationId: state.accommodationId || null,
        accommodation: JSON.parse(JSON.stringify(state.accommodation)),
        guests: JSON.parse(JSON.stringify(state.guests)),
        auditLog: JSON.parse(JSON.stringify(state.auditLog || [])),
      };
      return { ...state, editingAllocationId: snap.id, savedAllocations: [snap, ...state.savedAllocations] };
    }

    case 'LOAD_ALLOCATION': {
      const snap = state.savedAllocations.find(a => a.id === action.id);
      if (!snap) return state;
      return { 
        ...state, 
        editingAllocationId: snap.id,
        accommodation: JSON.parse(JSON.stringify(snap.accommodation)),
        guests: JSON.parse(JSON.stringify(snap.guests)),
        auditLog: JSON.parse(JSON.stringify(snap.auditLog || [])),
        startDate: snap.startDate || '',
        endDate: snap.endDate || '',
        currentStep: 3, // Go to allocation view
        activeTab: 'allocazione'
      };
    }

    case 'DELETE_ALLOCATION':
      return { ...state, savedAllocations: state.savedAllocations.filter(a => a.id !== action.id) };

    // ── Saved Accommodations (Templates) ──
    case 'SAVE_ACCOMMODATION': {
      const snap = {
        id: action.id || `acc-${Date.now()}`,
        name: action.name || state.accommodation.name,
        date: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(state.accommodation))
      };
      const existing = state.savedAccommodations.findIndex(a => a.id === snap.id);
      if (existing >= 0) {
        const next = [...state.savedAccommodations];
        next[existing] = snap;
        return { ...state, savedAccommodations: next };
      }
      return { ...state, savedAccommodations: [snap, ...state.savedAccommodations] };
    }
    
    case 'LOAD_ACCOMMODATION': {
      const snap = state.savedAccommodations.find(a => a.id === action.id);
      if (!snap) return state;
      return { ...state, accommodation: JSON.parse(JSON.stringify(snap.data)) };
    }

    case 'DELETE_ACCOMMODATION':
      return { ...state, savedAccommodations: state.savedAccommodations.filter(a => a.id !== action.id) };

    // ── New project ──
    case 'NEW_PROJECT':
      return {
        ...state,
        currentStep: action.startStep !== undefined ? action.startStep : 0,
        ...BLANK_PROJECT,
        editingAllocationId: null,
        accommodationId: action.accommodationId || null,
        accommodation: action.accommodation ? JSON.parse(JSON.stringify(action.accommodation)) : BLANK_PROJECT.accommodation,
        startDate: action.startDate || '',
        endDate: action.endDate || '',
        activeTab: 'allocazione'
      };

    // ── Saved Guest Lists ──
    case 'SAVE_GUEST_LIST': {
      const snap = {
        id: `list-${Date.now()}`,
        name: action.name,
        date: new Date().toISOString(),
        guests: JSON.parse(JSON.stringify(action.guests))
      };
      return { ...state, savedGuestLists: [snap, ...state.savedGuestLists] };
    }

    case 'DELETE_GUEST_LIST':
      return { ...state, savedGuestLists: state.savedGuestLists.filter(l => l.id !== action.id) };
    case 'UPDATE_GUEST_LIST_CONTENT':
      return {
        ...state,
        savedGuestLists: state.savedGuestLists.map(l => l.id === action.listId ? { ...l, guests: action.guests } : l)
      };
    case 'VERSION_GUEST_LIST': {
      const list = state.savedGuestLists.find(l => l.id === action.listId);
      if (!list) return state;
      const currentVersion = list.version || 1;
      const historyEntry = {
        version: currentVersion,
        date: list.date,
        guests: JSON.parse(JSON.stringify(list.guests)),
      };
      const updatedList = {
        ...list,
        version: currentVersion + 1,
        date: new Date().toISOString(),
        guests: JSON.parse(JSON.stringify(action.guests)),
        history: [...(list.history || []), historyEntry],
      };
      return { ...state, savedGuestLists: state.savedGuestLists.map(l => l.id === action.listId ? updatedList : l) };
    }

    // ── Groups ──
    case 'CREATE_GROUP':
      return { ...state, savedGroups: [action.group, ...state.savedGroups] };
    case 'UPDATE_GROUP':
      return { ...state, savedGroups: state.savedGroups.map(g => g.id === action.group.id ? action.group : g) };
    case 'RENAME_GROUP': {
      // action: { id, oldName, newName, updatedGroup }
      const updatedLists = state.savedGuestLists.map(list => ({
        ...list,
        guests: list.guests.map(g => g.group === action.oldName ? { ...g, group: action.newName } : g)
      }));
      return {
        ...state,
        savedGroups: state.savedGroups.map(g => g.id === action.id ? action.updatedGroup : g),
        savedGuestLists: updatedLists,
      };
    }
    case 'DELETE_GROUP':
      return { ...state, savedGroups: state.savedGroups.filter(g => g.id !== action.id) };

    // ── Intakes ──
    case 'CREATE_INTAKE':
      return { ...state, savedIntakes: [action.intake, ...state.savedIntakes] };
    case 'UPDATE_INTAKE':
      return { ...state, savedIntakes: state.savedIntakes.map(i => i.id === action.intake.id ? action.intake : i) };
    case 'DELETE_INTAKE':
      return { ...state, savedIntakes: state.savedIntakes.filter(i => i.id !== action.id) };

    // ── Activity Library ──
    case 'ADD_TO_ACTIVITY_LIBRARY': {
      const { activity } = action;
      if (!activity?.type || (!activity.text?.trim() && !activity.tags?.length)) return state;
      const key = a => `${a.type}|${(a.text||'').trim()}|${[...(a.tags||[])].sort().join(',')}`;
      const k = key(activity);
      const inTemplates = (state.scheduleTemplates || []).some(tpl =>
        (tpl.days || []).some(day =>
          day && Object.values(day).some(v => v && typeof v === 'object' && key(v) === k)
        )
      );
      if (inTemplates) return state;
      if ((state.activityLibrary || []).some(a => key(a) === k)) return state;
      return { ...state, activityLibrary: [...(state.activityLibrary || []), { id: `lib-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...activity }] };
    }
    case 'REMOVE_FROM_ACTIVITY_LIBRARY':
      return { ...state, activityLibrary: (state.activityLibrary || []).filter(a => a.id !== action.id) };

    // ── Activities / Schedule ──
    case 'UPDATE_SCHEDULE_TEMPLATE_SLOT': {
      return {
        ...state,
        scheduleTemplates: (state.scheduleTemplates || []).map(tpl => {
          if (tpl.id !== action.templateId) return tpl;
          const days = [...(tpl.days || [])];
          days[action.dayOffset] = { ...(days[action.dayOffset] || {}), [action.slotId]: action.value };
          return { ...tpl, days };
        }),
      };
    }
    case 'UPDATE_GROUP_SCHEDULE_SLOT': {
      return {
        ...state,
        savedGroups: state.savedGroups.map(g => {
          if (g.name !== action.groupName) return g;
          const schedule = { ...(g.schedule || {}) };
          schedule[action.date] = { ...(schedule[action.date] || {}), [action.slotId]: action.value };
          return { ...g, schedule };
        }),
      };
    }
    case 'APPLY_SCHEDULE_TEMPLATE_TO_GROUP': {
      const tpl = (state.scheduleTemplates || []).find(t => t.id === action.templateId);
      if (!tpl) return state;
      const base = new Date(action.intakeStartDate);
      const newSched = {};
      (tpl.days || []).forEach((day, offset) => {
        const d = new Date(base);
        d.setDate(d.getDate() + offset);
        newSched[d.toISOString().split('T')[0]] = { ...(day || {}) };
      });
      return {
        ...state,
        savedGroups: state.savedGroups.map(g =>
          g.name === action.groupName
            ? { ...g, schedule: newSched, scheduledTemplateId: action.templateId, scheduleStartDate: action.intakeStartDate }
            : g
        ),
      };
    }

    case 'MERGE_REMOTE_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Keys excluded from cloud sync (transient UI state)
const UI_KEYS = ['activeTab', 'listImproverTarget', 'isEditingAccommodation', 'editingAllocationId', 'currentStep', 'selectedAccommodationId'];

export function AppProvider({ children, centerId = null }) {
  const localKey = centerId ? `allocation_state_${centerId}` : 'allocation_state';

  const loadLocal = () => {
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) return { ...initialState, ...JSON.parse(saved) };
    } catch {}
    return initialState;
  };

  const stampKey = `${localKey}_stamp`;

  const [state, dispatch] = useReducer(reducer, undefined, loadLocal);
  const saveTimer = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevSavedRef = useRef(state.savedAllocations);
  // Monotonic "last modified" stamp shared between localStorage and Firestore,
  // so a stale remote snapshot can never clobber newer local data on mount.
  const stampRef = useRef(Number(localStorage.getItem(stampKey)) || 0);
  const firstRun = useRef(true);

  // Persist to localStorage on every change, advancing the modification stamp.
  // Skip the first run: we just hydrated from localStorage, nothing changed yet.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    stampRef.current = Date.now();
    localStorage.setItem(localKey, JSON.stringify(state));
    localStorage.setItem(stampKey, String(stampRef.current));
  }, [state, localKey, stampKey]);

  // Load from Firestore on mount — adopt the remote state only if it is newer
  // than what this browser already has locally.
  useEffect(() => {
    if (!centerId) return;
    loadCenterState(centerId).then(remote => {
      if (!remote) return;
      const remoteStamp = remote.__stamp || 0;
      // Compare against the LIVE local stamp (not a value frozen at mount) so a
      // late-arriving remote load cannot clobber a save made while it was in
      // flight. Adopt remote unless local is STRICTLY newer; `>=` keeps
      // legacy/unstamped remote docs (stamp 0) loading.
      if (remoteStamp >= stampRef.current) {
        const { __stamp, ...payload } = remote;
        dispatch({ type: 'MERGE_REMOTE_STATE', payload });
      }
    });
  }, [centerId]);

  // Firestore save: immediate when allocations change (save/delete), debounced otherwise.
  // Also flushed before the page unloads so a refresh never drops a pending write.
  // The mount run is skipped so we never push stale local state before the merge above.
  const firstSaveRun = useRef(true);
  useEffect(() => {
    if (!centerId) return;
    if (firstSaveRun.current) { firstSaveRun.current = false; return; }

    const flush = () => {
      clearTimeout(saveTimer.current);
      const s = stateRef.current;
      const toSave = Object.fromEntries(Object.entries(s).filter(([k]) => !UI_KEYS.includes(k)));
      toSave.__stamp = stampRef.current;
      saveCenterState(centerId, toSave);
    };

    const allocationsChanged = state.savedAllocations !== prevSavedRef.current;
    prevSavedRef.current = state.savedAllocations;

    if (allocationsChanged) {
      flush(); // write immediately when an allocation is saved or deleted
    } else {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 2000);
    }

    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      clearTimeout(saveTimer.current);
    };
  }, [state, centerId]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

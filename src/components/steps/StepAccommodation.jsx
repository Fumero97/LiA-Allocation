import { useState, useMemo } from 'react';
import { useApp } from '../../store';

const ROOM_TYPES = ['standard', 'single', 'double', 'triple', 'quad', 'suite'];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function buildRooms(from, to, capacity) {
  const rooms = [];
  for (let n = from; n <= to; n++) {
    rooms.push({
      id: `rm-${generateId()}`,
      number: String(n),
      capacity,
      type: capacity === 1 ? 'single' : capacity === 2 ? 'double' : 'standard',
      status: 'available',
      unavailableUntil: null,
    });
  }
  return rooms;
}

/* ══════════════════════════════════════════
   ROOM EDIT MODAL (single room)
══════════════════════════════════════════ */
function RoomEditModal({ room, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...room });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Room {room.number}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Room number</label>
              <input className="form-input" value={draft.number} onChange={e => set('number', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <select className="form-select" value={draft.capacity} onChange={e => set('capacity', parseInt(e.target.value))}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n===1?'spot':'spots'}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={draft.type} onChange={e => set('type', e.target.value)}>
                {ROOM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Availability</label>
              <select className="form-select" value={draft.status}
                onChange={e => { set('status', e.target.value); if (e.target.value==='available') set('unavailableUntil', null); }}>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>
          {draft.status === 'unavailable' && (
            <div className="form-group">
              <label className="form-label">Unavailable until</label>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <input type="date" className="form-input" style={{ flex:1 }}
                  value={draft.unavailableUntil === 'permanent' ? '' : (draft.unavailableUntil || '')}
                  onChange={e => set('unavailableUntil', e.target.value || null)} />
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, whiteSpace:'nowrap' }}>
                  <input type="checkbox" checked={draft.unavailableUntil === 'permanent'}
                    onChange={e => set('unavailableUntil', e.target.checked ? 'permanent' : null)} />
                  Permanent
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(draft)}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   CORRIDOR EDIT MODAL
══════════════════════════════════════════ */
function CorridorEditModal({ corridor, floors, currentFloorId, affectedGuests, onSave, onClose }) {
  // Work out original range from existing rooms
  const origFrom = corridor.rooms.length ? Math.min(...corridor.rooms.map(r => parseInt(r.number)).filter(n => !isNaN(n))) : '';
  const origTo   = corridor.rooms.length ? Math.max(...corridor.rooms.map(r => parseInt(r.number)).filter(n => !isNaN(n))) : '';
  const origCap  = corridor.rooms.length ? corridor.rooms[0].capacity : 2;

  const [name, setName]       = useState(corridor.name);
  const [floorId, setFloorId] = useState(currentFloorId);
  const [fromRoom, setFrom]   = useState(String(origFrom));
  const [toRoom, setTo]       = useState(String(origTo));
  const [capacity, setCap]    = useState(origCap);

  const from = parseInt(fromRoom);
  const to   = parseInt(toRoom);
  const rangeChanged = from !== origFrom || to !== origTo;
  const count = !isNaN(from) && !isNaN(to) && to >= from ? to - from + 1 : null;

  const guestsAffected = rangeChanged ? affectedGuests : 0;

  const handleSave = () => {
    if (!name.trim()) return;
    if (isNaN(from) || isNaN(to) || to < from) return;

    let rooms;
    if (rangeChanged) {
      // Regenerate rooms
      rooms = buildRooms(from, to, capacity);
    } else {
      // Keep existing rooms, just update capacity if changed
      rooms = corridor.rooms.map(r => ({ ...r, capacity }));
    }

    onSave({
      corridor: { ...corridor, name: name.trim(), rooms },
      targetFloorId: floorId,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Corridor</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Corridor name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Floor</label>
              <select className="form-select" value={floorId} onChange={e => setFloorId(e.target.value)}>
                {floors.map(f => <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row cols-3">
            <div className="form-group">
              <label className="form-label">From room no.</label>
              <input type="number" className="form-input" value={fromRoom} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">To room no.</label>
              <input type="number" className="form-input" value={toRoom} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Beds</label>
              <div className="num-stepper">
                <button type="button" onClick={() => setCap(c => Math.max(1, c-1))}>−</button>
                <input type="number" value={capacity} min={1} max={8}
                  onChange={e => setCap(Math.max(1, Math.min(8, parseInt(e.target.value)||1)))} />
                <button type="button" onClick={() => setCap(c => Math.min(8, c+1))}>+</button>
              </div>
            </div>
          </div>
          {rangeChanged && count !== null && (
            <div style={{ background: guestsAffected > 0 ? 'var(--warning-50)' : 'var(--primary-50)',
              border: `1px solid ${guestsAffected > 0 ? '#fde68a' : 'var(--primary-200)'}`,
              borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginTop: 4 }}>
              {guestsAffected > 0
                ? `⚠️ Changing the range will recreate the rooms and ${guestsAffected} guests will be unassigned.`
                : `✓ ${count} rooms will be created (from ${from} to ${to}).`}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm"
            disabled={!name.trim() || isNaN(from) || isNaN(to) || to < from}
            onClick={handleSave}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ROOM CARD
══════════════════════════════════════════ */
function RoomCard({ room, onClick, bulkMode, bulkSelected, onBulkToggle }) {
  const isUnavail = room.status === 'unavailable';
  const isPerm = room.unavailableUntil === 'permanent';

  if (bulkMode) {
    const isMarked = bulkSelected.has(room.id);
    return (
      <div
        className={`room-card bulk-mode ${isMarked ? 'bulk-marked' : ''} ${isUnavail ? 'unavailable-perm' : ''}`}
        onClick={() => onBulkToggle(room.id)}
        title={isMarked ? 'Click to make available' : 'Click to make unavailable'}
      >
        <div className="room-number">{room.number}</div>
        <div className="room-capacity-dots">
          {Array.from({ length: room.capacity }).map((_, i) => <span key={i} className="cap-dot" />)}
        </div>
        <div className="room-status-tag" style={{ color: isMarked ? 'var(--danger-500)' : undefined }}>
          {isMarked ? 'N/A' : `${room.capacity}p`}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`room-card ${isUnavail ? (isPerm ? 'unavailable-perm' : 'unavailable') : ''}`}
      onClick={() => onClick(room)}
      title={`Room ${room.number} — click to edit`}
    >
      <div className="room-number">{room.number}</div>
      <div className="room-capacity-dots">
        {Array.from({ length: room.capacity }).map((_, i) => <span key={i} className="cap-dot" />)}
      </div>
      <div className={`room-status-tag ${isUnavail ? 'unavail' : ''}`}>
        {isUnavail ? (isPerm ? 'N/A' : room.unavailableUntil ? `until ${room.unavailableUntil}` : 'N/A') : `${room.capacity}p`}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ADD CORRIDOR INLINE FORM
══════════════════════════════════════════ */
function AddCorridorForm({ floors, onAdd }) {
  const EMPTY = () => ({ floorId: floors[0]?.id || '', name: '', fromRoom: '', toRoom: '', capacity: 1 });
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [lastAdded, setLastAdded] = useState(null); // { floorName, corridorName, from, to }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const from  = parseInt(form.fromRoom);
  const to    = parseInt(form.toRoom);
  const count = !isNaN(from) && !isNaN(to) && to >= from ? to - from + 1 : null;

  const handleAdd = () => {
    setError('');
    if (!form.name.trim())    return setError('Enter a name for the corridor.');
    if (!form.floorId)        return setError('Select a floor.');
    if (isNaN(from))          return setError('Enter the number of the first room.');
    if (isNaN(to))            return setError('Enter the number of the last room.');
    if (to < from)            return setError('The last room must be ≥ the first room.');
    if (to - from + 1 > 100) return setError('Maximum 100 rooms per corridor.');

    const floor = floors.find(f => f.id === form.floorId);
    onAdd({
      id: `co-${generateId()}`,
      name: form.name.trim(),
      rooms: buildRooms(from, to, form.capacity),
    }, form.floorId);

    setLastAdded({
      floorName: floor?.name || `Floor ${floor?.number}`,
      corridorName: form.name.trim(),
      from,
      to,
    });
    setForm(EMPTY);
    setError('');
  };

  // Keep floorId in sync if floors change
  if (form.floorId && !floors.find(f => f.id === form.floorId) && floors.length > 0) {
    setForm(f => ({ ...f, floorId: floors[0].id }));
  }

  return (
    <div className="add-corridor-form">
      <div className="add-corridor-title">
        <span>➕</span> Add corridor
        {lastAdded && (
          <span className="last-added-hint">
            Last added: <strong>{lastAdded.floorName}</strong> · corridor <strong>{lastAdded.corridorName}</strong> · rooms <strong>{lastAdded.from}–{lastAdded.to}</strong>
          </span>
        )}
      </div>
      <div className="add-corridor-fields">
        <div className="form-group" style={{ minWidth: 130 }}>
          <label className="form-label">Floor</label>
          <select className="form-select" value={form.floorId} onChange={e => set('floorId', e.target.value)}>
            {floors.map(f => <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 130 }}>
          <label className="form-label">Corridor name</label>
          <input className="form-input" placeholder="es. A, Nord, Est…" value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        </div>
        <div className="form-group" style={{ minWidth: 80 }}>
          <label className="form-label">From room</label>
          <input type="number" className="form-input" placeholder="101" value={form.fromRoom}
            onChange={e => set('fromRoom', e.target.value)} />
        </div>
        <div style={{ alignSelf:'flex-end', paddingBottom:14, color:'var(--gray-400)', fontSize:18 }}>→</div>
        <div className="form-group" style={{ minWidth: 80 }}>
          <label className="form-label">To room</label>
          <input type="number" className="form-input" placeholder="110" value={form.toRoom}
            onChange={e => set('toRoom', e.target.value)} />
        </div>
        <div className="form-group" style={{ minWidth: 100 }}>
          <label className="form-label">Beds</label>
          <div className="num-stepper">
            <button type="button" onClick={() => set('capacity', Math.max(1, form.capacity-1))}>−</button>
            <input type="number" value={form.capacity} min={1} max={8}
              onChange={e => set('capacity', Math.max(1, Math.min(8, parseInt(e.target.value)||1)))} />
            <button type="button" onClick={() => set('capacity', Math.min(8, form.capacity+1))}>+</button>
          </div>
        </div>
        <div style={{ alignSelf:'flex-end', paddingBottom:2 }}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={floors.length === 0}>
            Add
          </button>
        </div>
      </div>
      {error
        ? <p style={{ color:'var(--danger-500)', fontSize:13, marginTop:6 }}>⚠ {error}</p>
        : count !== null && (
          <p style={{ color:'var(--primary-600)', fontSize:13, marginTop:6 }}>
            ✓ {count} {count===1?'room':'rooms'} ({from}–{to}), {count * form.capacity} beds
          </p>
        )
      }
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function StepAccommodation() {
  const { state, dispatch } = useApp();
  const acc = state.accommodation;

  const [editingRoom, setEditingRoom]       = useState(null);
  const [editingCorridor, setEditingCorr]   = useState(null); // { corridor, floorId }
  const [expandedFloors, setExpandedFloors] = useState(new Set());

  // Bulk unavailability mode
  const [bulkMode, setBulkMode]       = useState(false);
  const [bulkSelected, setBulkSel]    = useState(new Set()); // roomIds marked as unavailable in this session

  // Init bulk selection from current unavailable rooms
  const enterBulkMode = () => {
    const alreadyUnavail = new Set();
    acc.floors.forEach(f => f.corridors.forEach(c => c.rooms.forEach(r => {
      if (r.status === 'unavailable') alreadyUnavail.add(r.id);
    })));
    setBulkSel(alreadyUnavail);
    setBulkMode(true);
  };

  const saveBulkMode = () => {
    // Collect all room IDs
    const allRoomIds = [];
    acc.floors.forEach(f => f.corridors.forEach(c => c.rooms.forEach(r => allRoomIds.push(r.id))));

    const updates = allRoomIds.map(id => ({
      roomId: id,
      status: bulkSelected.has(id) ? 'unavailable' : 'available',
      unavailableUntil: bulkSelected.has(id) ? 'permanent' : null,
    }));
    dispatch({ type: 'SET_ROOMS_STATUS', updates });
    setBulkMode(false);
  };

  const cancelBulkMode = () => {
    setBulkMode(false);
    setBulkSel(new Set());
  };

  const toggleBulk = roomId => {
    setBulkSel(prev => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      return next;
    });
  };

  // Building name
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');

  const startEditName = () => { setNameInput(acc.name); setEditingName(true); };
  const saveEditName  = () => {
    if (nameInput.trim()) dispatch({ type: 'SET_ACCOMMODATION', payload: { ...acc, name: nameInput.trim() } });
    setEditingName(false);
  };

  // Floor management
  const [newFloorName, setNewFloorName] = useState('');
  const [newFloorLabel, setNewFloorLabel] = useState('');

  const addFloor = () => {
    const nextNum = String(acc.floors.length + 1);
    const rawLabel = newFloorLabel.trim().toUpperCase();
    const label = rawLabel || nextNum;
    const name = newFloorName.trim() || `Floor ${label}`;
    const floor = { id: `fl-${generateId()}`, number: label, name, corridors: [] };
    dispatch({ type: 'ADD_FLOOR', floor });
    setExpandedFloors(prev => new Set([...prev, floor.id]));
    setNewFloorName('');
    setNewFloorLabel('');
  };

  const removeFloor = (floorId, floorName) => {
    const floor = acc.floors.find(f => f.id === floorId);
    const roomsWithGuests = floor?.corridors.flatMap(c => c.rooms.filter(r =>
      state.guests.some(g => g.roomId === r.id)
    )).length || 0;
    const msg = roomsWithGuests > 0
      ? `Delete "${floorName}"? ${roomsWithGuests} guests will be unassigned.`
      : `Delete "${floorName}"?`;
    if (window.confirm(msg)) dispatch({ type: 'REMOVE_FLOOR', floorId });
  };

  const updateFloorName = (floorId, name) => {
    dispatch({ type: 'UPDATE_FLOOR', floor: { id: floorId, name } });
  };

  const updateFloorNumber = (floorId, number) => {
    dispatch({ type: 'UPDATE_FLOOR', floor: { id: floorId, number } });
  };

  // Corridor management
  const handleAddCorridor = (corridor, floorId) => {
    dispatch({ type: 'ADD_CORRIDOR', floorId, corridor });
    setExpandedFloors(prev => new Set([...prev, floorId]));
  };

  const handleRemoveCorridor = (corridorId, corridorName) => {
    const guests = countGuestsInCorridor(corridorId);
    const msg = guests > 0
      ? `Delete corridor "${corridorName}"? ${guests} guests will be unassigned.`
      : `Delete corridor "${corridorName}"?`;
    if (window.confirm(msg)) dispatch({ type: 'REMOVE_CORRIDOR', corridorId });
  };

  const handleSaveCorridorEdit = ({ corridor, targetFloorId }) => {
    dispatch({ type: 'REPLACE_CORRIDOR', corridorId: corridor.id, targetFloorId, corridor });
    setEditingCorr(null);
  };

  const countGuestsInCorridor = corridorId => {
    const ids = new Set();
    acc.floors.forEach(f => f.corridors.forEach(c => {
      if (c.id === corridorId) c.rooms.forEach(r => ids.add(r.id));
    }));
    return state.guests.filter(g => ids.has(g.roomId)).length;
  };

  const countGuestsInCorridorExcludingNewRange = (corridorId, from, to) => {
    // guests in rooms whose number falls outside [from,to]
    let count = 0;
    acc.floors.forEach(f => f.corridors.forEach(c => {
      if (c.id === corridorId) {
        c.rooms.forEach(r => {
          const n = parseInt(r.number);
          if ((isNaN(n) || n < from || n > to) && state.guests.some(g => g.roomId === r.id)) count++;
        });
      }
    }));
    return count;
  };

  const toggleFloor = id => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Stats
  const totalCorridors = acc.floors.reduce((s, f) => s + f.corridors.length, 0);
  const totalRooms = acc.floors.reduce((s, f) => s + f.corridors.reduce((ss, c) => ss + c.rooms.length, 0), 0);
  const totalBeds  = acc.floors.reduce((s, f) => s + f.corridors.reduce((ss, c) => ss + c.rooms.filter(r => r.status!=='unavailable').reduce((sss, r) => sss + r.capacity, 0), 0), 0);
  const unavail    = acc.floors.reduce((s, f) => s + f.corridors.reduce((ss, c) => ss + c.rooms.filter(r => r.status==='unavailable').length, 0), 0);

  const hasAnyRoom = totalRooms > 0;

  return (
    <div className="step-container wide">

      {/* ── Bulk mode banner ── */}
      {bulkMode && (
        <div className="bulk-mode-banner">
          <span>🔴</span>
          <div>
            <strong>Unavailable rooms selection mode</strong>
            <span style={{ marginLeft:10, fontSize:13, opacity:0.85 }}>
              Click rooms to mark them as unavailable (permanent).
              Click again to deselect them.
            </span>
          </div>
          <span className="bulk-count">{bulkSelected.size} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={cancelBulkMode}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={saveBulkMode}>Save</button>
        </div>
      )}

      <div className="step-header">
        <h1>Setup Accommodation</h1>
        <p>Configure the structure: add floors, corridors and rooms. Then customise each room individually.</p>
      </div>

      {/* ══ BUILDING CONFIG + FLOORS ══ */}
      <div className="acc-config-grid">

        {/* Building name */}
        <div className="card">
          <div className="card-title"><span>🏨</span> Structure</div>
          {acc.name && !editingName ? (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--primary-600)' }}>{acc.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={startEditName}>✏️ Rename</button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                className="form-input"
                placeholder="Structure name (e.g. Westbury House)…"
                value={editingName ? nameInput : (acc.name || '')}
                onChange={e => editingName ? setNameInput(e.target.value) : dispatch({ type:'SET_ACCOMMODATION', payload:{ ...acc, name: e.target.value } })}
                onKeyDown={e => { if (e.key==='Enter' && editingName) saveEditName(); }}
                autoFocus={editingName}
                style={{ maxWidth:320 }}
              />
              {editingName && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={saveEditName}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}>Cancel</button>
                </>
              )}
            </div>
          )}

          {/* Stats */}
          {totalRooms > 0 && (
            <div style={{ display:'flex', gap:16, marginTop:12, fontSize:13, color:'var(--gray-500)', flexWrap:'wrap' }}>
              <span><strong style={{ color:'var(--gray-800)' }}>{acc.floors.length}</strong> floors</span>
              <span><strong style={{ color:'var(--gray-800)' }}>{totalCorridors}</strong> corridors</span>
              <span><strong style={{ color:'var(--gray-800)' }}>{totalRooms}</strong> rooms</span>
              <span><strong style={{ color:'var(--gray-800)' }}>{totalBeds}</strong> beds</span>
              {unavail > 0 && <span style={{ color:'var(--danger-500)' }}><strong>{unavail}</strong> N/A</span>}
            </div>
          )}
        </div>

        {/* Floors list */}
        <div className="card">
          <div className="card-title"><span>🏢</span> Floors</div>

          {acc.floors.length === 0 && (
            <p style={{ fontSize:13, color:'var(--gray-400)', marginBottom:12 }}>
              No floors yet. Add one below.
            </p>
          )}

          <div className="floors-list">
            {acc.floors.map((floor, i) => (
              <FloorRow
                key={floor.id}
                floor={floor}
                index={i}
                onNameChange={name => updateFloorName(floor.id, name)}
                onLabelChange={number => updateFloorNumber(floor.id, number)}
                onRemove={() => removeFloor(floor.id, floor.name || `Floor ${floor.number}`)}
              />
            ))}
          </div>

          {/* Add floor */}
          <div className="add-floor-row">
            <input
              className="form-input"
              placeholder="G, 1, 2…"
              value={newFloorLabel}
              onChange={e => setNewFloorLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFloor()}
              style={{ width: 64, flexShrink: 0, textAlign: 'center' }}
            />
            <input
              className="form-input"
              placeholder="Floor name (optional)"
              value={newFloorName}
              onChange={e => setNewFloorName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFloor()}
              style={{ flex:1, maxWidth:240 }}
            />
            <button className="btn btn-outline btn-sm" onClick={addFloor}>
              + Add floor
            </button>
          </div>
        </div>
      </div>

      {/* ══ ADD CORRIDOR ══ */}
      {acc.floors.length > 0 && (
        <AddCorridorForm floors={acc.floors} onAdd={handleAddCorridor} />
      )}

      {/* ══ BULK UNAVAILABLE BUTTON ══ */}
      {hasAnyRoom && !bulkMode && (
        <div style={{ marginTop:12, marginBottom:4 }}>
          <button className="btn btn-outline btn-sm" onClick={enterBulkMode} style={{ borderColor:'var(--danger-300)', color:'var(--danger-600)' }}>
            🔴 Select unavailable rooms
          </button>
          <span className="text-muted" style={{ marginLeft:10, fontSize:12 }}>
            Enter selection mode to mark rooms as unavailable in bulk
          </span>
        </div>
      )}

      {/* ══ FLOOR ACCORDION ══ */}
      {acc.floors.length > 0 && (
        <div style={{ marginTop:16 }}>
          {acc.floors.map(floor => {
            const isOpen = expandedFloors.has(floor.id);
            const roomCount = floor.corridors.reduce((s, c) => s + c.rooms.length, 0);
            return (
              <div key={floor.id} className="floor-block">
                <div className="floor-header" onClick={() => toggleFloor(floor.id)}>
                  <span style={{ fontSize:15 }}>🏢</span>
                  <h3>{floor.name || `Floor ${floor.number}`}</h3>
                  <span style={{ fontSize:12, color:'var(--primary-400)', marginRight:6 }}>
                    {floor.corridors.length} {floor.corridors.length===1?'corridor':'corridors'} · {roomCount} rooms
                  </span>
                  <span style={{ fontSize:13, color:'var(--primary-400)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="floor-body">
                    {floor.corridors.length === 0 ? (
                      <p style={{ color:'var(--gray-400)', fontSize:13, fontStyle:'italic', padding:'4px 0' }}>
                        No corridors — use the "Add corridor" form above.
                      </p>
                    ) : (
                      floor.corridors.map(corridor => (
                        <div key={corridor.id} className="corridor-row">
                          <div className="corridor-label" style={{ justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{
                                display:'inline-flex', alignItems:'center', justifyContent:'center',
                                width:20, height:20, background:'var(--gray-200)', borderRadius:'50%',
                                fontSize:11, fontWeight:700, color:'var(--gray-600)',
                              }}>
                                {String(corridor.name).charAt(0).toUpperCase()}
                              </span>
                              <span>Corridor {corridor.name}</span>
                              {corridor.rooms.length > 0 && (
                                <span style={{ color:'var(--gray-400)', fontSize:11 }}>
                                  ({corridor.rooms[0].number}–{corridor.rooms[corridor.rooms.length-1].number}) · {corridor.rooms.length} rooms
                                </span>
                              )}
                            </div>
                            <div style={{ display:'flex', gap:6 }}>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditingCorr({ corridor, floorId: floor.id })}
                                title="Edit corridor"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="btn btn-danger-outline btn-xs"
                                onClick={() => handleRemoveCorridor(corridor.id, corridor.name)}
                                title="Delete corridor"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          <div className="room-grid">
                            {corridor.rooms.map(room => (
                              <RoomCard
                                key={room.id}
                                room={room}
                                onClick={setEditingRoom}
                                bulkMode={bulkMode}
                                bulkSelected={bulkSelected}
                                onBulkToggle={toggleBulk}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {editingRoom && (
        <RoomEditModal
          room={editingRoom}
          onSave={r => { dispatch({ type:'UPDATE_ROOM', room:r }); setEditingRoom(null); }}
          onClose={() => setEditingRoom(null)}
        />
      )}
      {editingCorridor && (
        <CorridorEditModal
          corridor={editingCorridor.corridor}
          floors={acc.floors}
          currentFloorId={editingCorridor.floorId}
          affectedGuests={countGuestsInCorridor(editingCorridor.corridor.id)}
          onSave={handleSaveCorridorEdit}
          onClose={() => setEditingCorr(null)}
        />
      )}
    </div>
  );
}

/* ── Floor row (inline name edit) ── */
function FloorRow({ floor, index, onNameChange, onRemove, onLabelChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(floor.name || `Floor ${floor.number}`);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(String(floor.number));

  const save = () => { onNameChange(val.trim() || `Floor ${floor.number}`); setEditing(false); };
  const saveLabel = () => {
    const v = labelVal.trim().toUpperCase();
    if (v) onLabelChange(v);
    setEditingLabel(false);
  };

  return (
    <div className="floor-list-row">
      {editingLabel ? (
        <input
          className="form-input floor-number-badge"
          value={labelVal}
          onChange={e => setLabelVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
          onBlur={saveLabel}
          autoFocus
          style={{ width: 48, textAlign: 'center', padding: '2px 4px', fontSize: 12, fontWeight: 700 }}
        />
      ) : (
        <span className="floor-number-badge" title="Click to edit floor number" onClick={() => { setLabelVal(String(floor.number)); setEditingLabel(true); }} style={{ cursor: 'pointer' }}>
          {floor.number}
        </span>
      )}
      {editing ? (
        <>
          <input
            className="form-input"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') setEditing(false); }}
            autoFocus
            style={{ flex:1, fontSize:13 }}
          />
          <button className="btn btn-primary btn-xs" onClick={save}>✓</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>✕</button>
        </>
      ) : (
        <>
          <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--gray-700)' }}>
            {floor.name || `Floor ${floor.number}`}
          </span>
          <span style={{ fontSize:12, color:'var(--gray-400)' }}>
            {floor.corridors.length} {floor.corridors.length===1?'corridor':'corridors'}
          </span>
          <button className="btn btn-ghost btn-xs" onClick={() => { setVal(floor.name || `Floor ${floor.number}`); setEditing(true); }} title="Rename">
            ✏️
          </button>
          <button className="btn btn-danger-outline btn-xs" onClick={onRemove} title="Delete floor">🗑</button>
        </>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { fmtDate, computeGroupDateRange, computeIntakes } from './groupUtils';
import { GuestModal, EMPTY_GUEST, generateId } from '../components/steps/StepGuests';
import { getAgeBand } from '../utils/ageBands';
import { exportGuestList } from '../utils/excel';

export default function GroupDetailView({ group, allGuests, savedIntakes, savedAccommodations = [], onBack, onEdit, onUpdateGuests, onDeleteGuest }) {
  const ALL_COLS = [
    { id: 'room',      label: 'Room' },
    { id: 'sex',       label: 'Gender' },
    { id: 'age',       label: 'Age' },
    { id: 'dob',       label: 'DOB' },
    { id: 'arrival',   label: 'Arrival' },
    { id: 'departure', label: 'Departure' },
    { id: 'allergy',   label: 'Allergies' },
    { id: 'medical',   label: 'Medical' },
    { id: 'travelWith',label: 'Travel With' },
    { id: 'rawNotes',  label: 'Original Notes' },
  ];

  const [activeTab, setActiveTab]     = useState('guests');
  const [search, setSearch]           = useState('');
  const [hiddenCols, setHiddenCols]   = useState(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const [sortKey, setSortKey]         = useState('surname');
  const [sortDir, setSortDir]         = useState(1);
  const [modal, setModal]             = useState(null); // null | 'add' | guestId
  const [showRolePanel, setShowRolePanel] = useState(false);
  const [roleDrafts, setRoleDrafts]   = useState({});
  const [improverTool, setImproverTool] = useState('travelWith');
  const [flightDir, setFlightDir]     = useState('arrival');
  const [flightForm, setFlightForm]   = useState({ airport: '', date: '', time: '' });
  const [flightSelected, setFlightSelected] = useState(new Set());
  const [expandedFlight, setExpandedFlight] = useState(null);
  const [flightExpandSearch, setFlightExpandSearch] = useState('');
  const [showFlightAssign, setShowFlightAssign] = useState(false);
  const [flightGuestSearch, setFlightGuestSearch] = useState('');
  const [rowSearch, setRowSearch]     = useState({});
  const [allergySearch, setAllergySearch] = useState({});
  const [medicalSearch, setMedicalSearch] = useState({});

  const guests    = allGuests.filter(g => g.group === group.name);

  const roomLookup = useMemo(() => {
    const map = {};
    savedAccommodations.forEach(acc => {
      acc.data?.floors?.forEach(floor => {
        floor.corridors?.forEach(corridor => {
          corridor.rooms?.forEach(room => { map[room.id] = room.number; });
        });
      });
    });
    return map;
  }, [savedAccommodations]);
  const guestLookup = useMemo(() => Object.fromEntries(allGuests.map(g => [g.id, `${g.name || ''} ${g.surname || ''}`.trim()])), [allGuests]);
  const intakes   = computeIntakes(group.name, allGuests, savedIntakes);
  const dateRange = computeGroupDateRange(group.name, allGuests);

  // ── helpers ──────────────────────────────────────────────
  const update = (modifiedGuests) => onUpdateGuests(modifiedGuests);

  const updateOne = (updated) => update([updated]);

  const travelWithNames = (g) => {
    const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
    return ids.map(id => guestLookup[id] || id).filter(Boolean).join(', ');
  };

  // ── sort / filter ─────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const vis = (col) => !hiddenCols.has(col);
  const toggleCol = (col) => setHiddenCols(prev => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n; });

  const shown = useMemo(() => {
    let list = guests;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g => `${g.name} ${g.surname}`.toLowerCase().includes(q) || (g.externalId || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let va, vb;
      if (sortKey === 'name')      { va = `${a.surname} ${a.name}`; vb = `${b.surname} ${b.name}`; }
      else if (sortKey === 'age')  { return ((Number(a.age) || 0) - (Number(b.age) || 0)) * sortDir; }
      else if (sortKey === 'arrival')   { va = a.arrivalDate   || ''; vb = b.arrivalDate   || ''; }
      else if (sortKey === 'departure') { va = a.departureDate || ''; vb = b.departureDate || ''; }
      else { va = String(a[sortKey] || ''); vb = String(b[sortKey] || ''); }
      return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * sortDir;
    });
  }, [guests, search, sortKey, sortDir]);

  const adultsWithoutRole = useMemo(() =>
    guests.filter(g => Number(g.age) >= 18 && !g.role),
  [guests]);

  const openRolePanel = () => {
    const drafts = {};
    adultsWithoutRole.forEach(g => { drafts[g.id] = ''; });
    setRoleDrafts(drafts);
    setShowRolePanel(true);
  };

  const applyRoles = () => {
    const toUpdate = adultsWithoutRole
      .filter(g => roleDrafts[g.id])
      .map(g => ({ ...g, role: roleDrafts[g.id] }));
    if (toUpdate.length) update(toUpdate);
    setShowRolePanel(false);
  };

  const SortTh = ({ col, label, style }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
      {label}
      {sortKey === col
        ? <span style={{ marginLeft: 4, color: 'var(--primary-500)', fontSize: 10 }}>{sortDir > 0 ? '↑' : '↓'}</span>
        : <span style={{ marginLeft: 4, color: 'var(--gray-300)', fontSize: 10 }}>↕</span>}
    </th>
  );

  // ── improver helpers ──────────────────────────────────────
  const linkRoommate = (guestId, targetId) => {
    const gA = allGuests.find(g => g.id === guestId);
    const gB = allGuests.find(g => g.id === targetId);
    if (!gA || !gB) return;
    const addId = (g, id) => {
      const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
      return { ...g, roommateIds: [...new Set([...ids, id])] };
    };
    update([addId(gA, targetId), addId(gB, guestId)]);
    setRowSearch(p => ({ ...p, [guestId]: '' }));
  };

  const unlinkRoommate = (guestId, targetId) => {
    const gA = allGuests.find(g => g.id === guestId);
    const gB = allGuests.find(g => g.id === targetId);
    const removeId = (g, id) => {
      const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
      return { ...g, roommateIds: ids.filter(i => i !== id), roommateId: g.roommateId === id ? null : g.roommateId };
    };
    update([removeId(gA, targetId), ...(gB ? [removeId(gB, guestId)] : [])].filter(Boolean));
  };

  const addTag = (field, guestId, tag) => {
    const g = allGuests.find(x => x.id === guestId);
    if (!g) return;
    const existing = Array.isArray(g[field]) ? g[field] : [];
    if (existing.map(t => t.toLowerCase()).includes(tag.toLowerCase())) return;
    const updates = { [field]: [...existing, tag] };
    // Preserve original string before first conversion to array
    if (field === 'medical' && typeof g.medical === 'string' && g.medical.trim() && !g.medicalRaw) {
      updates.medicalRaw = g.medical;
    }
    if (field === 'allergy' && typeof g.allergy === 'string' && g.allergy.trim() && !g.allergyRaw) {
      updates.allergyRaw = g.allergy;
    }
    updateOne({ ...g, ...updates });
    if (field === 'allergy') setAllergySearch(p => ({ ...p, [guestId]: '' }));
    if (field === 'medical') setMedicalSearch(p => ({ ...p, [guestId]: '' }));
  };

  const removeTag = (field, guestId, tag) => {
    const g = allGuests.find(x => x.id === guestId);
    if (!g) return;
    updateOne({ ...g, [field]: (Array.isArray(g[field]) ? g[field] : []).filter(t => t !== tag) });
  };

  // all tags across the group
  const allAllergyTags = useMemo(() => {
    const map = {};
    guests.forEach(g => (Array.isArray(g.allergy) ? g.allergy : []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return map;
  }, [guests]);

  const allMedicalTags = useMemo(() => {
    const map = {};
    guests.forEach(g => (Array.isArray(g.medical) ? g.medical : []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return map;
  }, [guests]);

  // ── delete guest ──────────────────────────────────────────
  const handleDeleteGuest = (guestId) => {
    const g = allGuests.find(x => x.id === guestId);
    if (!g) return;
    if (!window.confirm(`Delete ${g.name} ${g.surname}?`)) return;
    onDeleteGuest?.(guestId, g._listId);
  };

  // ── modal save ────────────────────────────────────────────
  const handleModalSave = (updated) => {
    if (modal === 'add') {
      // Add to first list that has guests from this group
      const firstGuest = guests[0];
      if (firstGuest?._listId) {
        const { _listId, _listName, ...clean } = { ...updated, _listId: firstGuest._listId, _listName: firstGuest._listName };
        onUpdateGuests([{ ...clean, _listId: firstGuest._listId, _listName: firstGuest._listName }]);
      }
    } else {
      updateOne(updated);
    }
    setModal(null);
  };

  const IMPROVER_TOOLS = [
    { id: 'travelWith', label: 'Travel With' },
    { id: 'allergies',  label: 'Allergies' },
    { id: 'medical',    label: 'Medical' },
    { id: 'flight',     label: 'Flights' },
  ];

  const groupFlights = (dir) => {
    const map = {};
    guests.forEach(g => {
      const airport = dir === 'arrival' ? g.arrivalAirport : g.departureAirport;
      const date    = dir === 'arrival' ? g.arrivalDate    : g.departureDate;
      const time    = dir === 'arrival' ? g.arrivalTime    : g.departureTime;
      if (!airport && !date && !time) return;
      const k = `${airport || '—'}|${date || '—'}|${time || '—'}`;
      if (!map[k]) map[k] = { key: k, airport: airport || '', date: date || '', time: time || '', guests: [] };
      map[k].guests.push(g);
    });
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  };

  const isoToDMY = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return (y && m && d) ? `${d}/${m}/${y}` : iso;
  };

  const assignFlight = () => {
    const date = isoToDMY(flightForm.date);
    const toUpdate = guests
      .filter(g => flightSelected.has(g.id))
      .map(g => flightDir === 'arrival'
        ? { ...g, arrivalAirport: flightForm.airport, arrivalDate: date, arrivalTime: flightForm.time }
        : { ...g, departureAirport: flightForm.airport, departureDate: date, departureTime: flightForm.time }
      );
    if (toUpdate.length) update(toUpdate);
    setShowFlightAssign(false);
    setFlightSelected(new Set());
    setFlightForm({ airport: '', date: '', time: '' });
  };

  return (
    <div className="saas-tab-content">
      {/* ── Header ── */}
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{group.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 1 }}>{guests.length} guests</div>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => onEdit(group)}>✏️ Edit Group</button>
      </div>

      {/* ── Info cards ── */}
      <div style={{ padding: '12px 24px', background: '#fafafa', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 24, flexWrap: 'wrap', flexShrink: 0 }}>
        {[
          { label: 'Arrival',   value: fmtDate(dateRange.arrivalDate   || group.arrivalDate) },
          { label: 'Departure', value: fmtDate(dateRange.departureDate || group.departureDate) },
          { label: 'Structure', value: group.struttura || '—' },
          { label: 'Agent',     value: group.agente    || '—' },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{f.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{f.value}</div>
          </div>
        ))}
        {intakes.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Intake</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {intakes.map(i => <span key={i.id} style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', padding: '1px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{i.name}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--gray-200)', background: '#fff', flexShrink: 0 }}>
        {['guests', 'improver'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 24px', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--primary-600)' : 'transparent'}`, background: 'none', fontWeight: activeTab === tab ? 700 : 500, fontSize: 13, color: activeTab === tab ? 'var(--primary-600)' : 'var(--gray-500)', cursor: 'pointer', textTransform: 'capitalize' }}>
            {tab === 'guests' ? `Guests (${guests.length})` : 'Improver'}
          </button>
        ))}
      </div>

      {/* ── Guests tab ── */}
      {activeTab === 'guests' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 13 }}>🔍</span>
              <input className="form-input" style={{ paddingLeft: 30, height: 34, fontSize: 13 }} placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Column visibility */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowColMenu(s => !s)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
                Columns {hiddenCols.size > 0 && <span style={{ background: 'var(--primary-600)', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{hiddenCols.size}</span>}
              </button>
              {showColMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300, minWidth: 160, padding: '8px 4px' }}
                  onMouseLeave={() => setShowColMenu(false)}>
                  {ALL_COLS.map(col => (
                    <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, borderRadius: 6, background: hiddenCols.has(col.id) ? '#f8fafc' : '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = hiddenCols.has(col.id) ? '#f8fafc' : '#fff'}>
                      <input type="checkbox" checked={!hiddenCols.has(col.id)} onChange={() => toggleCol(col.id)} style={{ accentColor: 'var(--primary-600)' }} />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => exportGuestList(guests.map(({ _listId, _listName, ...g }) => g), group.name)}>⬇ Export</button>
              <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>+ Add Guest</button>
            </div>
          </div>

          {/* 18+ alert */}
          {adultsWithoutRole.length > 0 && !showRolePanel && (
            <div
              onClick={openRolePanel}
              style={{ margin: '0', padding: '10px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
            >
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                {adultsWithoutRole.length} guest{adultsWithoutRole.length !== 1 ? 's' : ''} aged 18+ without a role assigned.
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#b45309', fontWeight: 600, textDecoration: 'underline' }}>Assign roles →</span>
            </div>
          )}

          {/* Role assignment panel */}
          {showRolePanel && (
            <div style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a', flexShrink: 0 }}>
              <div style={{ padding: '12px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>⚠️ Assign roles to guests aged 18+</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => setShowRolePanel(false)}>Cancel</button>
                  <button className="btn btn-primary btn-xs" onClick={applyRoles}>Apply</button>
                </div>
              </div>
              <div style={{ padding: '10px 24px 14px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {adultsWithoutRole.map(g => (
                  <div key={g.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 120 }}>{g.name} {g.surname} <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>({g.age}y)</span></div>
                    {[
                      { value: 'Student', label: 'Student', color: '#16a34a' },
                      { value: 'GL',      label: 'GL',      color: '#1d4ed8' },
                      { value: 'LiA',     label: 'LiA',     color: '#7c3aed' },
                    ].map(({ value, label, color }) => (
                      <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13, fontWeight: roleDrafts[g.id] === value ? 700 : 400, color: roleDrafts[g.id] === value ? color : '#475569' }}>
                        <input
                          type="radio"
                          name={`role-${g.id}`}
                          value={value}
                          checked={roleDrafts[g.id] === value}
                          onChange={() => setRoleDrafts(d => ({ ...d, [g.id]: value }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {shown.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--gray-400)' }}>No guests found.</div>
            ) : (
              <div className="guest-table-wrap" style={{ margin: 0, borderRadius: 0, boxShadow: 'none' }}>
                <table className="guest-table mini-headers">
                  <thead>
                    <tr>
                      <SortTh col="name"      label="Name" />
                      {vis('room')      && <SortTh col="roomId"    label="Room" />}
                      {vis('sex')       && <SortTh col="sex"       label="Gender" />}
                      {vis('age')       && <SortTh col="age"       label="Age" />}
                      {vis('dob')       && <SortTh col="dob"       label="DOB" />}
                      {vis('arrival')   && <SortTh col="arrival"   label="Arrival" />}
                      {vis('departure') && <SortTh col="departure" label="Departure" />}
                      {vis('allergy')   && <th>Allergies</th>}
                      {vis('medical')   && <th>Medical</th>}
                      {vis('travelWith')&& <th>Travel With</th>}
                      {vis('rawNotes')  && <th>Original Notes</th>}
                      <th style={{ width: 60 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((g, i) => (
                      <tr key={g.id || i}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className={`guest-avatar ${g.sex === 'M' ? 'male' : 'female'}`} style={{ width: 28, height: 28, fontSize: 11 }}>
                              {(g.name?.[0] || '') + (g.surname?.[0] || '')}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span>{g.name} {g.surname}</span>
                                <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                                  {Number(g.age) < 12  && <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>⚠ &lt;12</span>}
                                  {g.role === 'GL'      && <span className="badge badge-primary" style={{ fontSize: 10, padding: '1px 6px' }}>GL</span>}
                                  {g.role === 'LiA'     && <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>LiA</span>}
                                  {g.role === 'Student' && <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>18+</span>}
                                  {!g.role && Number(g.age) >= 18 && <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>18+</span>}
                                </span>
                              </div>
                              {g.externalId && <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>#{g.externalId}</div>}
                            </div>
                          </div>
                        </td>
                        {vis('room')       && <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-700)', whiteSpace: 'nowrap' }}>{g.roomId ? (roomLookup[g.roomId] || g.roomId) : <span style={{ color: 'var(--gray-200)', fontWeight: 400 }}>—</span>}</td>}
                        {vis('sex')        && <td style={{ fontSize: 12 }}>{g.sex === 'M' ? '♂ M' : '♀ F'}</td>}
                        {vis('age')        && <td style={{ fontSize: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: getAgeBand(g.age).bg, display: 'inline-block', flexShrink: 0 }} />{g.age}</div></td>}
                        {vis('dob')        && <td style={{ fontSize: 11, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{g.dob || '—'}</td>}
                        {vis('arrival')    && <td style={{ fontSize: 11, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{[g.arrivalDate, g.arrivalTime, g.arrivalAirport && `✈ ${g.arrivalAirport}`].filter(Boolean).join(' · ') || '—'}</td>}
                        {vis('departure')  && <td style={{ fontSize: 11, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{[g.departureDate, g.departureTime, g.departureAirport && `✈ ${g.departureAirport}`].filter(Boolean).join(' · ') || '—'}</td>}
                        {vis('allergy')    && <td>{Array.isArray(g.allergy) && g.allergy.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{g.allergy.map((a, j) => <span key={j} style={{ background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 8, fontSize: 10 }}>{a}</span>)}</div> : <span style={{ color: 'var(--gray-200)', fontSize: 11 }}>—</span>}</td>}
                        {vis('medical')    && <td>{Array.isArray(g.medical) && g.medical.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{g.medical.map((m, j) => <span key={j} style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 8, fontSize: 10 }}>{m}</span>)}</div> : <span style={{ color: 'var(--gray-200)', fontSize: 11 }}>—</span>}</td>}
                        {vis('travelWith') && <td style={{ fontSize: 11, color: 'var(--gray-600)' }}>{travelWithNames(g) || <span style={{ color: 'var(--gray-200)' }}>—</span>}</td>}
                        {vis('rawNotes')   && <td style={{ fontSize: 11, color: 'var(--gray-500)', maxWidth: 160 }}>{(() => { const raw = g.medicalRaw || (typeof g.medical === 'string' ? g.medical : '') || ''; return raw ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={raw}>{raw}</span> : <span style={{ color: 'var(--gray-200)' }}>—</span>; })()}</td>}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => setModal(g.id)}>✏️</button>
                          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger-500)' }} onClick={() => handleDeleteGuest(g.id)} title="Delete guest">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Improver tab ── */}
      {activeTab === 'improver' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tool selector */}
          <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 8, flexShrink: 0 }}>
            {IMPROVER_TOOLS.map(t => (
              <button key={t.id} onClick={() => setImproverTool(t.id)}
                style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${improverTool === t.id ? 'var(--primary-400)' : 'var(--gray-200)'}`, background: improverTool === t.id ? 'var(--primary-50)' : '#fff', color: improverTool === t.id ? 'var(--primary-700)' : 'var(--gray-600)', fontWeight: improverTool === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* ── Travel With ── */}
            {improverTool === 'travelWith' && (() => {
              const linked = guests.flatMap(g => {
                const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
                return ids.map(tid => ({ fromId: g.id, fromName: `${g.name} ${g.surname}`, toId: tid, toName: guestLookup[tid] || tid }));
              });
              return (
                <div>
                  {linked.length > 0 && (
                    <div style={{ padding: '10px 24px', background: 'var(--success-50)', borderBottom: '1px solid var(--success-200)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-700)', marginBottom: 6 }}>🔗 LINKED</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {linked.map((p, i) => <span key={i} style={{ padding: '3px 10px', background: 'var(--success-100)', color: 'var(--success-800)', borderRadius: 20, fontSize: 12, border: '1px solid var(--success-300)' }}>{p.fromName} → {p.toName}</span>)}
                      </div>
                    </div>
                  )}
                  <table className="guest-table mini-headers" style={{ width: '100%' }}>
                    <thead><tr><th style={{ width: '22%' }}>Guest</th><th style={{ width: '30%' }}>Notes</th><th>Link to…</th></tr></thead>
                    <tbody>
                      {guests.filter(g => {
                        const hasNotes = (g.medicalRaw || (typeof g.medical === 'string' ? g.medical : '') || g.privateNotes || '').trim();
                        const hasLinks = (Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : [])).length > 0;
                        return hasNotes || hasLinks;
                      }).map(g => {
                        const linkedIds = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
                        const srch = rowSearch[g.id] || '';
                        const results = srch.length > 0 ? allGuests.filter(c => c.id !== g.id && !linkedIds.includes(c.id) && `${c.name} ${c.surname}`.toLowerCase().includes(srch.toLowerCase())).slice(0, 6) : [];
                        return (
                          <tr key={g.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name} {g.surname}</div>
                              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: getAgeBand(g.age).bg, display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ color: 'var(--gray-500)' }}>{g.age}y</span>
                                <span style={{ color: g.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)' }}>{g.sex === 'M' ? '♂' : '♀'}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                              {(() => {
                                const raw = g.medicalRaw || (typeof g.medical === 'string' ? g.medical : '');
                                const notes = g.privateNotes || '';
                                const parts = [raw && <span key="r" style={{ fontStyle: 'italic' }}>{raw}</span>, notes && <span key="n">{notes}</span>].filter(Boolean);
                                return parts.length ? <>{parts.reduce((a, b) => <>{a} · {b}</>)}</> : <span style={{ color: 'var(--gray-300)' }}>—</span>;
                              })()}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: linkedIds.length ? 6 : 0 }}>
                                {linkedIds.map(tid => (
                                  <span key={tid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--success-100)', color: 'var(--success-800)', border: '1px solid var(--success-300)', borderRadius: 16, fontSize: 12 }}>
                                    {guestLookup[tid] || tid}
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--success-600)', fontWeight: 700 }} onClick={() => unlinkRoommate(g.id, tid)}>×</button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ position: 'relative' }}>
                                <input className="form-input mini" style={{ width: '100%', fontSize: 12 }} placeholder="Search guest…" value={srch} onChange={e => setRowSearch(p => ({ ...p, [g.id]: e.target.value }))} />
                                {results.length > 0 && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 160, overflowY: 'auto' }}>
                                    {results.map(c => (
                                      <div key={c.id} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => linkRoommate(g.id, c.id)}>
                                        <strong>{c.name} {c.surname}</strong>{c.group && c.group !== group.name && <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 6 }}>{c.group}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ── Allergies ── */}
            {improverTool === 'allergies' && (() => {
              const guestsToShow = guests.filter(g =>
                (g.medicalRaw || (typeof g.medical === 'string' ? g.medical : '') || g.privateNotes || '').trim() ||
                (Array.isArray(g.medical) && g.medical.length > 0) ||
                (Array.isArray(g.allergy) && g.allergy.length > 0)
              );
              return (
                <div>
                  {Object.keys(allAllergyTags).length > 0 && (
                    <div style={{ padding: '10px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>⚕️ REGISTERED ALLERGIES</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(allAllergyTags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                          <span key={tag} style={{ padding: '3px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 20, fontSize: 12 }}>{tag} <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{count}</span></span>
                        ))}
                      </div>
                    </div>
                  )}
                  <table className="guest-table mini-headers"><thead><tr><th style={{ width: '20%' }}>Guest</th><th style={{ width: '25%' }}>Raw notes</th><th>Allergies</th></tr></thead>
                    <tbody>
                      {guestsToShow.map(g => {
                        const tags = Array.isArray(g.allergy) ? g.allergy : [];
                        const srch = allergySearch[g.id] || '';
                        const matches = srch.length > 0 ? Object.keys(allAllergyTags).filter(t => t.toLowerCase().includes(srch.toLowerCase()) && !tags.map(x => x.toLowerCase()).includes(t.toLowerCase())).slice(0, 8) : [];
                        const canCreate = srch.trim().length > 1 && !Object.keys(allAllergyTags).some(t => t.toLowerCase() === srch.toLowerCase()) && !tags.some(t => t.toLowerCase() === srch.toLowerCase());
                        return (
                          <tr key={g.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name} {g.surname}</div>
                              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: getAgeBand(g.age).bg, display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ color: 'var(--gray-500)' }}>{g.age}y</span>
                                <span style={{ color: g.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)' }}>{g.sex === 'M' ? '♂' : '♀'}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>{(typeof g.medical === 'string' ? g.medical : '') || g.medicalRaw || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
                                {tags.map(t => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 16, fontSize: 12 }}>{t}<button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#b45309', fontWeight: 700, fontSize: 13 }} onClick={() => removeTag('allergy', g.id, t)}>×</button></span>)}
                              </div>
                              <div style={{ position: 'relative' }}>
                                <input className="form-input mini" style={{ width: '100%', fontSize: 12 }} placeholder="Search or create…" value={srch} onChange={e => setAllergySearch(p => ({ ...p, [g.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && srch.trim()) addTag('allergy', g.id, srch.trim()); }} />
                                {(matches.length > 0 || canCreate) && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 180, overflowY: 'auto' }}>
                                    {matches.map(t => <div key={t} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12 }} onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => addTag('allergy', g.id, t)}>{t} <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10 }}>+{allAllergyTags[t]}</span></div>)}
                                    {canCreate && <div style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--primary-600)', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => addTag('allergy', g.id, srch.trim())}>+ Create "{srch.trim()}"</div>}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ── Medical ── */}
            {improverTool === 'medical' && (() => {
              const guestsToShow = guests.filter(g =>
                (g.medicalRaw || (typeof g.medical === 'string' ? g.medical : '') || g.privateNotes || '').trim() ||
                (Array.isArray(g.medical) && g.medical.length > 0) ||
                (Array.isArray(g.allergy) && g.allergy.length > 0)
              );
              return (
                <div>
                  {Object.keys(allMedicalTags).length > 0 && (
                    <div style={{ padding: '10px 24px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>🏥 REGISTERED CONDITIONS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(allMedicalTags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                          <span key={tag} style={{ padding: '3px 10px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 20, fontSize: 12 }}>{tag} <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{count}</span></span>
                        ))}
                      </div>
                    </div>
                  )}
                  <table className="guest-table mini-headers"><thead><tr><th style={{ width: '20%' }}>Guest</th><th style={{ width: '25%' }}>Raw notes</th><th>Medical</th></tr></thead>
                    <tbody>
                      {guestsToShow.map(g => {
                        const tags = Array.isArray(g.medical) ? g.medical : [];
                        const rawMedical = g.medicalRaw || (Array.isArray(g.medical) ? '' : (g.medical || ''));
                        const srch = medicalSearch[g.id] || '';
                        const matches = srch.length > 0 ? Object.keys(allMedicalTags).filter(t => t.toLowerCase().includes(srch.toLowerCase()) && !tags.map(x => x.toLowerCase()).includes(t.toLowerCase())).slice(0, 8) : [];
                        const canCreate = srch.trim().length > 1 && !Object.keys(allMedicalTags).some(t => t.toLowerCase() === srch.toLowerCase()) && !tags.some(t => t.toLowerCase() === srch.toLowerCase());
                        return (
                          <tr key={g.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name} {g.surname}</div>
                              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: getAgeBand(g.age).bg, display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ color: 'var(--gray-500)' }}>{g.age}y</span>
                                <span style={{ color: g.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)' }}>{g.sex === 'M' ? '♂' : '♀'}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>{rawMedical || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
                                {tags.map(t => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 16, fontSize: 12 }}>{t}<button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2563eb', fontWeight: 700, fontSize: 13 }} onClick={() => removeTag('medical', g.id, t)}>×</button></span>)}
                              </div>
                              <div style={{ position: 'relative' }}>
                                <input className="form-input mini" style={{ width: '100%', fontSize: 12 }} placeholder="Search or create…" value={srch} onChange={e => setMedicalSearch(p => ({ ...p, [g.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && srch.trim()) addTag('medical', g.id, srch.trim()); }} />
                                {(matches.length > 0 || canCreate) && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 180, overflowY: 'auto' }}>
                                    {matches.map(t => <div key={t} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12 }} onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => addTag('medical', g.id, t)}>{t} <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10 }}>+{allMedicalTags[t]}</span></div>)}
                                    {canCreate && <div style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--primary-600)', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => addTag('medical', g.id, srch.trim())}>+ Create "{srch.trim()}"</div>}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* ── Flights ── */}
            {improverTool === 'flight' && (() => {
              const arrFlights = groupFlights('arrival');
              const depFlights = groupFlights('departure');
              const allSelected = guests.length > 0 && guests.every(g => flightSelected.has(g.id));

              return (
                <div style={{ padding: 24 }}>

                  {/* Direction toggle */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {['arrival', 'departure'].map(d => (
                      <button key={d} onClick={() => { setFlightDir(d); setExpandedFlight(null); setShowFlightAssign(false); }}
                        style={{ padding: '7px 20px', borderRadius: 8, border: `1px solid ${flightDir === d ? 'var(--primary-400)' : 'var(--gray-200)'}`, background: flightDir === d ? 'var(--primary-50)' : '#fff', color: flightDir === d ? 'var(--primary-700)' : 'var(--gray-600)', fontWeight: flightDir === d ? 700 : 500, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {d === 'arrival' ? '✈ Arrival' : '✈ Departure'}
                      </button>
                    ))}
                    <button onClick={() => { setShowFlightAssign(s => !s); setFlightSelected(new Set(guests.map(g => g.id))); setFlightForm({ airport: '', date: '', time: '' }); }}
                      style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, border: '1px solid var(--primary-400)', background: 'var(--primary-600)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      + Assign Flight
                    </button>
                  </div>

                  {/* Existing flights — always on top */}
                  {(flightDir === 'arrival' ? arrFlights : depFlights).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)', background: '#fff', borderRadius: 10, border: '1px dashed var(--gray-200)', marginBottom: 16 }}>
                      No {flightDir} flights assigned yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {(flightDir === 'arrival' ? arrFlights : depFlights).map(f => {
                        const isOpen = expandedFlight === f.key;
                        return (
                          <div key={f.key} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, background: isOpen ? 'var(--primary-50)' : '#fff' }}>
                              <span style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => setExpandedFlight(isOpen ? null : f.key)}>✈</span>
                              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedFlight(isOpen ? null : f.key)}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>
                                  {f.airport || '—'}
                                  {f.date && <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 13, color: 'var(--gray-600)' }}>{f.date}</span>}
                                  {f.time && <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 13, color: 'var(--gray-600)' }}>{f.time}</span>}
                                </div>
                              </div>
                              <span style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 10 }}>{f.guests.length} guests</span>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  // DMY → ISO for the date input
                                  const dmyToISO = (dmy) => {
                                    if (!dmy) return '';
                                    const parts = dmy.split('/');
                                    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dmy;
                                  };
                                  setFlightForm({ airport: f.airport, date: dmyToISO(f.date), time: f.time });
                                  setFlightSelected(new Set(f.guests.map(g => g.id)));
                                  setFlightGuestSearch('');
                                  setShowFlightAssign(true);
                                }}
                                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--gray-200)', background: '#fff', color: 'var(--gray-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                              >
                                Edit
                              </button>
                              <span style={{ color: 'var(--gray-400)', fontSize: 12, cursor: 'pointer' }} onClick={() => setExpandedFlight(isOpen ? null : f.key)}>{isOpen ? '▲' : '▼'}</span>
                            </div>
                            {isOpen && (
                              <div style={{ borderTop: '1px solid var(--gray-100)' }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gray-50)' }}>
                                  <input className="form-input" style={{ height: 30, fontSize: 12 }} placeholder="Search…"
                                    value={expandedFlight === f.key ? flightExpandSearch : ''}
                                    onChange={e => setFlightExpandSearch(e.target.value)} />
                                </div>
                                {f.guests
                                  .filter(g => !flightExpandSearch || `${g.name} ${g.surname}`.toLowerCase().includes(flightExpandSearch.toLowerCase()))
                                  .map(g => (
                                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px', borderBottom: '1px solid var(--gray-50)', fontSize: 13 }}>
                                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)', display: 'inline-block', flexShrink: 0 }} />
                                      <span style={{ flex: 1 }}>{g.name} {g.surname}</span>
                                      {g.role && g.role !== 'Student' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-600)' }}>{g.role}</span>}
                                      {g.roomId && <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 500 }}>Room {roomLookup[g.roomId] || g.roomId}</span>}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Assign form — below existing flights */}
                  {showFlightAssign && (
                    <div style={{ background: '#f8fafc', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 18, marginTop: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--gray-800)', textTransform: 'capitalize' }}>
                        Assign {flightDir} flight
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <div style={{ flex: '0 0 100px' }}>
                          <label style={lbl}>Airport</label>
                          <input className="form-input" style={{ height: 34, fontSize: 13 }} placeholder="LHR" value={flightForm.airport} onChange={e => setFlightForm(f => ({ ...f, airport: e.target.value }))} />
                        </div>
                        <div style={{ flex: '0 0 140px' }}>
                          <label style={lbl}>Date</label>
                          <input type="date" className="form-input" style={{ height: 34, fontSize: 13 }} value={flightForm.date} onChange={e => setFlightForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                        <div style={{ flex: '0 0 110px' }}>
                          <label style={lbl}>Time</label>
                          <input type="time" className="form-input" style={{ height: 34, fontSize: 13 }} value={flightForm.time} onChange={e => setFlightForm(f => ({ ...f, time: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <label style={lbl}>Guests ({flightSelected.size} selected)</label>
                          <button className="btn btn-ghost btn-xs" onClick={() => setFlightSelected(allSelected ? new Set() : new Set(guests.map(g => g.id)))}>
                            {allSelected ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <input className="form-input" style={{ height: 32, fontSize: 12, marginBottom: 6 }} placeholder="Search guest…" value={flightGuestSearch} onChange={e => setFlightGuestSearch(e.target.value)} />
                        <div style={{ maxHeight: 180, overflowY: 'auto', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                          {guests.filter(g => !flightGuestSearch || `${g.name} ${g.surname}`.toLowerCase().includes(flightGuestSearch.toLowerCase())).map(g => {
                            const checked = flightSelected.has(g.id);
                            return (
                              <label key={g.id} onClick={() => setFlightSelected(prev => { const n = new Set(prev); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-50)', background: checked ? 'var(--primary-50)' : '#fff' }}>
                                <input type="checkbox" checked={checked} readOnly />
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)', display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, flex: 1 }}>{g.name} {g.surname}</span>
                                {g.role && g.role !== 'Student' && <span style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 700 }}>{g.role}</span>}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" disabled={flightSelected.size === 0} onClick={assignFlight}>Apply to {flightSelected.size} guest{flightSelected.size !== 1 ? 's' : ''}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowFlightAssign(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <GuestModal
          guest={modal === 'add' ? { ...EMPTY_GUEST(), group: group.name, id: generateId() } : guests.find(g => g.id === modal) || EMPTY_GUEST()}
          guestLookup={guestLookup}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };

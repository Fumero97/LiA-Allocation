import { useRef, useState, useMemo } from 'react';
import { useApp } from '../../store';
import { parseGuestExcel, downloadGuestTemplate } from '../../utils/excel';
import { getAgeBand } from '../../utils/ageBands';

export function generateId() {
  return 'g-' + Math.random().toString(36).slice(2, 10);
}

export const EMPTY_GUEST = () => ({
  id: generateId(),
  externalId: '',
  group: '',
  name: '',
  surname: '',
  fullName: '',
  sex: 'M',
  age: '',
  dob: '',
  medical: '',
  privateNotes: '',
  arrivalAirport: '',
  arrivalDate: '',
  arrivalTime: '14:00',
  departureDate: '',
  departureTime: '10:00',
  departureAirport: '',
  roomId: null,
  role: '',
  allergy: [],
  medical_condition: [],
  medication: [],
  learning_difficulty: [],
  roommate_preference: [],
  general_note: '',
  roommateId: null,
});

/* ── Add/Edit Guest Modal ── */
export function GuestModal({ guest, onSave, onClose, guestLookup = {} }) {
  const [draft, setDraft] = useState({ ...guest });
  const [allergyInput, setAllergyInput] = useState('');
  const [medicalInput, setMedicalInput] = useState('');

  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }));

  const setName = (key, val) => {
    const updated = { ...draft, [key]: val };
    if (!updated.fullName || updated.fullName === `${draft.name} ${draft.surname}`.trim()) {
      updated.fullName = `${updated.name} ${updated.surname}`.trim();
    }
    setDraft(updated);
  };

  const addTag = (field, value, setInput) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const existing = Array.isArray(draft[field]) ? draft[field] : [];
    if (!existing.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      set(field, [...existing, trimmed]);
    }
    setInput('');
  };

  const removeTag = (field, tag) => {
    const existing = Array.isArray(draft[field]) ? draft[field] : [];
    set(field, existing.filter(t => t !== tag));
  };

  // Dati importati (read-only reference)
  const rawMedical = guest.medicalRaw || (typeof guest.medical === 'string' ? guest.medical : '');
  const rawPrivateNotes = guest.privateNotes || '';

  // Dati standardizzati
  const travelWithIds = Array.isArray(draft.roommateIds) ? draft.roommateIds : (draft.roommateId ? [draft.roommateId] : []);
  const travelWithNames = travelWithIds.map(id => guestLookup[id] || id);
  const allergyTags = Array.isArray(draft.allergy) ? draft.allergy : [];
  const medicalTags = Array.isArray(draft.medical) ? draft.medical : [];

  const isValid = draft.name.trim() && draft.surname.trim();

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>{guest.name ? 'Edit Guest' : 'Add Guest'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Group</label>
              <input className="form-input" value={draft.group} onChange={e => set('group', e.target.value)} placeholder="e.g. Group A" />
            </div>
            <div className="form-group">
              <label className="form-label">ID</label>
              <input className="form-input" value={draft.externalId} onChange={e => set('externalId', e.target.value)} placeholder="e.g. ST001" />
            </div>
          </div>
          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Forename *</label>
              <input className="form-input" value={draft.name} onChange={e => setName('name', e.target.value)} placeholder="First name" />
            </div>
            <div className="form-group">
              <label className="form-label">Surname *</label>
              <input className="form-input" value={draft.surname} onChange={e => setName('surname', e.target.value)} placeholder="Surname" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={draft.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Auto-generated from Forename + Surname" />
          </div>
          <div className="form-row cols-3">
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select" value={draft.sex} onChange={e => set('sex', e.target.value)}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input type="number" className="form-input" value={draft.age} min={1} max={120} onChange={e => set('age', parseInt(e.target.value) || '')} />
            </div>
            <div className="form-group">
              <label className="form-label">DOB</label>
              <input className="form-input" value={draft.dob} onChange={e => set('dob', e.target.value)} placeholder="dd/mm/yyyy" />
            </div>
            <div className="form-group">
              <label className="form-label">Role (18+)</label>
              <select
                className="form-select"
                value={draft.role || ''}
                disabled={(parseInt(draft.age) || 0) < 18}
                onChange={e => set('role', e.target.value)}
              >
                <option value="">— None</option>
                <option value="GL">GL (Group Leader)</option>
                <option value="LiA">LiA (Leader in Action)</option>
              </select>
            </div>
          </div>

          {/* ── Dati Importati (read-only) ── */}
          {(rawMedical || rawPrivateNotes) && (
            <div style={{ padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: 'var(--gray-50)', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📋 Imported Data
              </div>
              {rawMedical && (
                <div style={{ marginBottom: rawPrivateNotes ? 8 : 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Medical / Allergies</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.5 }}>{rawMedical}</div>
                </div>
              )}
              {rawPrivateNotes && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Private Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.5 }}>{rawPrivateNotes}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Dati Standardizzati ── */}
          <div style={{ padding: '12px 14px', border: '1px solid var(--primary-100)', borderRadius: 8, background: 'var(--primary-50)', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-700)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ✅ Standardised Data
            </div>

            {/* Travel With */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label mini" style={{ fontSize: 10 }}>Travel With</label>
              {travelWithNames.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {travelWithNames.map((name, i) => (
                    <span key={i} style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 }}>
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--gray-300)', fontStyle: 'italic', marginTop: 4 }}>
                  No link — manage from List Improver
                </div>
              )}
            </div>

            {/* Allergies */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label mini" style={{ fontSize: 10 }}>Allergies</label>
              {allergyTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, marginTop: 4 }}>
                  {allergyTags.map(tag => (
                    <span key={tag} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tag}
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#92400e', fontWeight: 700, fontSize: 14 }} onClick={() => removeTag('allergy', tag)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="form-input mini"
                style={{ height: 28, fontSize: 11 }}
                placeholder="Add allergy and press Enter..."
                value={allergyInput}
                onChange={e => setAllergyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && allergyInput.trim()) addTag('allergy', allergyInput, setAllergyInput); }}
              />
            </div>

            {/* Medical */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label mini" style={{ fontSize: 10 }}>Medical</label>
              {medicalTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, marginTop: 4 }}>
                  {medicalTags.map(tag => (
                    <span key={tag} style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tag}
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#1e40af', fontWeight: 700, fontSize: 14 }} onClick={() => removeTag('medical', tag)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="form-input mini"
                style={{ height: 28, fontSize: 11 }}
                placeholder="Add medical condition and press Enter..."
                value={medicalInput}
                onChange={e => setMedicalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && medicalInput.trim()) addTag('medical', medicalInput, setMedicalInput); }}
              />
            </div>
          </div>

          <div className="divider" />
          <div className="form-row cols-3">
            <div className="form-group">
              <label className="form-label">Arrival Airport</label>
              <input className="form-input" value={draft.arrivalAirport} onChange={e => set('arrivalAirport', e.target.value)} placeholder="LHR" />
            </div>
            <div className="form-group">
              <label className="form-label">Arrival Date</label>
              <input className="form-input" value={draft.arrivalDate} onChange={e => set('arrivalDate', e.target.value)} placeholder="dd/mm/yyyy" />
            </div>
            <div className="form-group">
              <label className="form-label">Arrival Time</label>
              <input type="time" className="form-input" value={draft.arrivalTime} onChange={e => set('arrivalTime', e.target.value)} />
            </div>
          </div>
          <div className="form-row cols-3">
            <div className="form-group">
              <label className="form-label">Departure Airport</label>
              <input className="form-input" value={draft.departureAirport} onChange={e => set('departureAirport', e.target.value)} placeholder="LHR" />
            </div>
            <div className="form-group">
              <label className="form-label">Departure Date</label>
              <input className="form-input" value={draft.departureDate} onChange={e => set('departureDate', e.target.value)} placeholder="dd/mm/yyyy" />
            </div>
            <div className="form-group">
              <label className="form-label">Departure Time</label>
              <input type="time" className="form-input" value={draft.departureTime} onChange={e => set('departureTime', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!isValid} onClick={() => onSave(draft)}>
            {guest.name ? 'Save changes' : 'Add guest'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Inline editable cell ── */
function EditableCell({ value, onChange, type = 'text', options }) {
  if (options) {
    return (
      <select className="inline-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <input
      type={type}
      className="inline-input"
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
    />
  );
}

export default function StepGuests() {
  const { state, dispatch } = useApp();
  const guests = state.guests;
  const fileInputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState('surname');
  const [sortDir, setSortDir] = useState(1);

  // Resizable columns
  const DEFAULT_WIDTHS = { group: 110, externalId: 70, surname: 190, gender: 70, age: 60, dob: 100, medical: 140, travelWith: 130, arrival: 120, departure: 120 };
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS);
  const resizeRef = useRef(null);

  const startResize = (e, col) => {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startWidth: colWidths[col] };
    const onMove = (ev) => {
      if (!resizeRef.current) return;
      const w = Math.max(40, resizeRef.current.startWidth + ev.clientX - resizeRef.current.startX);
      setColWidths(p => ({ ...p, [resizeRef.current.col]: w }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const groups = [...new Set(guests.map(g => g.group).filter(Boolean))].sort();

  const guestLookup = useMemo(() => {
    const map = {};
    guests.forEach(g => { map[g.id] = `${g.name || ''} ${g.surname || ''}`.trim(); });
    return map;
  }, [guests]);

  const handleFile = async file => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseGuestExcel(file);
      dispatch({ type: 'SET_GUESTS', payload: parsed });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSaveGuest = guest => {
    if (modal === 'add') {
      dispatch({ type: 'ADD_GUEST', guest: { ...guest, id: generateId() } });
    } else {
      dispatch({ type: 'UPDATE_GUEST', guest });
    }
    setModal(null);
  };

  const handleDelete = id => {
    if (window.confirm('Delete this guest?')) {
      dispatch({ type: 'REMOVE_GUEST', guestId: id });
    }
  };

  const updateField = (id, key, val) => {
    const guest = guests.find(g => g.id === id);
    dispatch({ type: 'UPDATE_GUEST', guest: { ...guest, [key]: val } });
  };

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const resetFilters = () => {
    setSearch('');
    setFilterGroup('all');
    setFilterGender('all');
    setFilterAssigned('all');
    setFilterAgeMin('');
    setFilterAgeMax('');
  };

  const hasActiveFilters = search || filterGroup !== 'all' || filterGender !== 'all' || filterAssigned !== 'all' || filterAgeMin || filterAgeMax;

  const filtered = guests
    .filter(g => {
      if (search) {
        const q = search.toLowerCase();
        if (!(
          (g.name || '').toLowerCase().includes(q) ||
          (g.surname || '').toLowerCase().includes(q) ||
          (g.fullName || '').toLowerCase().includes(q) ||
          (g.group || '').toLowerCase().includes(q) ||
          (g.externalId || '').toLowerCase().includes(q)
        )) return false;
      }
      if (filterGroup !== 'all' && g.group !== filterGroup) return false;
      if (filterGender !== 'all' && g.sex !== filterGender) return false;
      if (filterAssigned === 'assigned' && !g.roomId) return false;
      if (filterAssigned === 'unassigned' && g.roomId) return false;
      if (filterAgeMin !== '' && g.age < parseInt(filterAgeMin)) return false;
      if (filterAgeMax !== '' && g.age > parseInt(filterAgeMax)) return false;
      return true;
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (typeof va === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * sortDir;
    });

  const maleCount = guests.filter(g => g.sex === 'M').length;
  const femaleCount = guests.filter(g => g.sex === 'F').length;

  const rHandle = (col) => (
    <div
      onMouseDown={e => startResize(e, col)}
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-300)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    />
  );

  const SortTh = ({ col, label }) => (
    <th style={{ position: 'relative', width: colWidths[col], overflow: 'hidden', userSelect: 'none' }}>
      <span onClick={() => toggleSort(col)} style={{ cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
        {label}
        {sortKey === col
          ? <span style={{ marginLeft: 4, color: 'var(--primary-500)' }}>{sortDir > 0 ? '↑' : '↓'}</span>
          : <span style={{ marginLeft: 4, color: 'var(--gray-300)' }}>↕</span>}
      </span>
      {rHandle(col)}
    </th>
  );

  const Th = ({ col, label }) => (
    <th style={{ position: 'relative', width: colWidths[col], overflow: 'hidden' }}>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{label}</span>
      {rHandle(col)}
    </th>
  );

  return (
    <div className="step-container wide">
      <div className="step-header">
        <h1>Guest List</h1>
        <p>
          Import guests from your Excel file or add them manually.
          All fields are editable inline.
        </p>
      </div>

      {/* Upload zone */}
      {guests.length === 0 ? (
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ marginBottom: 20 }}
        >
          <span className="upload-icon">📊</span>
          <h3>{loading ? 'Loading…' : 'Drag your Excel file here or click to select'}</h3>
          <p>
            Format: .xlsx or .xls —{' '}
            <button
              className="btn btn-ghost btn-xs"
              style={{ display: 'inline', padding: '2px 6px' }}
              onClick={e => { e.stopPropagation(); downloadGuestTemplate(); }}
            >
              Download template
            </button>
          </p>
          {error && <p style={{ color: 'var(--danger-500)', marginTop: 8, fontSize: 13 }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
            📤 Reload Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadGuestTemplate()}>
            📄 Download template
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }}
      />

      {guests.length > 0 && (
        <>
          {/* Stats chips */}
          <div className="guest-stats">
            <div className="stat-chip"><strong>{guests.length}</strong> total guests</div>
            <div className="stat-chip">
              <span style={{ color: 'var(--male-color)' }}>♂</span>
              <strong>{maleCount}</strong> Male
            </div>
            <div className="stat-chip">
              <span style={{ color: '#ec4899' }}>♀</span>
              <strong>{femaleCount}</strong> Female
            </div>
            <div className="stat-chip">
              <strong>{groups.length}</strong> {groups.length === 1 ? 'group' : 'groups'}
            </div>
            {guests.filter(g => g.roomId).length > 0 && (
              <div className="stat-chip">
                <span style={{ color: 'var(--success-600)' }}>✓</span>
                <strong>{guests.filter(g => g.roomId).length}</strong> assigned
              </div>
            )}
          </div>

          {/* ── Filter bar ── */}
          <div className="filter-bar">
            {/* Text search */}
            <div className="filter-bar-search">
              <span className="filter-search-icon">🔍</span>
              <input
                className="filter-search-input"
                placeholder="Search by name, surname, ID, group…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="filter-clear-btn" onClick={() => setSearch('')}>×</button>
              )}
            </div>

            {/* Group filter */}
            <select
              className="filter-select"
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map(gr => <option key={gr} value={gr}>{gr}</option>)}
            </select>

            {/* Gender filter */}
            <select
              className="filter-select"
              value={filterGender}
              onChange={e => setFilterGender(e.target.value)}
            >
              <option value="all">M + F</option>
              <option value="M">Solo Male</option>
              <option value="F">Solo Female</option>
            </select>

            {/* Assignment filter */}
            <select
              className="filter-select"
              value={filterAssigned}
              onChange={e => setFilterAssigned(e.target.value)}
            >
              <option value="all">All</option>
              <option value="assigned">✓ Assigned</option>
              <option value="unassigned">⚠ Unassigned</option>
            </select>

            {/* Age range */}
            <div className="filter-age-range">
              <span style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>Age</span>
              <input
                type="number"
                className="filter-age-input"
                placeholder="min"
                min={1} max={120}
                value={filterAgeMin}
                onChange={e => setFilterAgeMin(e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>–</span>
              <input
                type="number"
                className="filter-age-input"
                placeholder="max"
                min={1} max={120}
                value={filterAgeMax}
                onChange={e => setFilterAgeMax(e.target.value)}
              />
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters} title="Clear filters">
                ✕ Reset
              </button>
            )}

            {/* Result count + add */}
            <span className="filter-count">
              {filtered.length !== guests.length
                ? <><strong>{filtered.length}</strong> / {guests.length}</>
                : <><strong>{guests.length}</strong> guests</>
              }
            </span>

            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setModal('add')}>
              + Add
            </button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 32 }}>
              <span className="empty-icon">🔍</span>
              <h3>No results</h3>
              <p>Try adjusting the filters.</p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="guest-table-wrap">
              <table className="guest-table" style={{ tableLayout: 'fixed', width: Object.values(colWidths).reduce((a, b) => a + b, 0) + 70 }}>
                <colgroup>
                  <col style={{ width: colWidths.group }} />
                  <col style={{ width: colWidths.externalId }} />
                  <col style={{ width: colWidths.surname }} />
                  <col style={{ width: colWidths.gender }} />
                  <col style={{ width: colWidths.age }} />
                  <col style={{ width: colWidths.dob }} />
                  <col style={{ width: colWidths.medical }} />
                  <col style={{ width: colWidths.travelWith }} />
                  <col style={{ width: colWidths.arrival }} />
                  <col style={{ width: colWidths.departure }} />
                  <col style={{ width: 70 }} />
                </colgroup>
                <thead>
                  <tr>
                    <SortTh col="group" label="Group" />
                    <SortTh col="externalId" label="ID" />
                    <SortTh col="surname" label="Forename / Surname" />
                    <Th col="gender" label="Gender" />
                    <SortTh col="age" label="Age" />
                    <Th col="dob" label="DOB" />
                    <Th col="medical" label="Medical" />
                    <SortTh col="travelWith" label="Travel With" />
                    <Th col="arrival" label="Arrival" />
                    <Th col="departure" label="Departure" />
                    <th style={{ width: 70 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id}>
                      <td>
                        <EditableCell value={g.group} onChange={v => updateField(g.id, 'group', v)} />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                        <EditableCell value={g.externalId || ''} onChange={v => updateField(g.id, 'externalId', v)} />
                      </td>
                      <td>
                        <div className="guest-name-cell">
                          <div className={`guest-avatar ${g.sex === 'M' ? 'male' : 'female'}`}>
                            {(g.name?.[0] || '') + (g.surname?.[0] || '')}
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <EditableCell value={g.name} onChange={v => updateField(g.id, 'name', v)} />
                            <EditableCell value={g.surname} onChange={v => updateField(g.id, 'surname', v)} />
                            {g.role && <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 4px' }}>{g.role}</span>}
                            {Number(g.age) < 12 && <span className="badge" style={{ fontSize: 10, padding: '2px 4px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>⚠ &lt;12</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <EditableCell
                          value={g.sex}
                          onChange={v => updateField(g.id, 'sex', v)}
                          options={[{ value: 'M', label: '♂ M' }, { value: 'F', label: '♀ F' }]}
                        />
                      </td>
                      <td style={{ width: 60 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span title={`Età: ${getAgeBand(g.age).label}`} style={{ width: 10, height: 10, borderRadius: '50%', background: getAgeBand(g.age).bg, border: `1px solid ${getAgeBand(g.age).border}`, display: 'inline-block', flexShrink: 0 }} />
                          <EditableCell value={g.age} type="number" onChange={v => updateField(g.id, 'age', v)} />
                        </div>
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        <EditableCell value={g.dob || ''} onChange={v => updateField(g.id, 'dob', v)} />
                      </td>
                      <td style={{ overflow: 'hidden' }}>
                        {g.medical && (Array.isArray(g.medical) ? g.medical.length > 0 : true) ? (
                          <span
                            className="badge badge-warning"
                            title={Array.isArray(g.medical) ? g.medical.join(', ') : g.medical}
                            style={{ cursor: 'help', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', whiteSpace: 'nowrap' }}
                          >
                            ⚕ {Array.isArray(g.medical) ? g.medical.join(', ') : g.medical}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, overflow: 'hidden' }}>
                        {(() => {
                          const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
                          const names = ids.map(id => guestLookup[id] || id).filter(Boolean).join(', ');
                          return names
                            ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={names}>{names}</span>
                            : <span style={{ color: 'var(--gray-300)' }}>—</span>;
                        })()}
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        <div>{g.arrivalDate} {g.arrivalTime}</div>
                        {g.arrivalAirport && <div style={{ color: 'var(--gray-400)' }}>✈ {g.arrivalAirport}</div>}
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        <div>{g.departureDate} {g.departureTime}</div>
                        {g.departureAirport && <div style={{ color: 'var(--gray-400)' }}>✈ {g.departureAirport}</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => setModal(g.id)}>✏️</button>
                          <button className="btn btn-danger-outline btn-xs" title="Delete" onClick={() => handleDelete(g.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && (
        <GuestModal
          guest={modal === 'add' ? EMPTY_GUEST() : guests.find(g => g.id === modal)}
          onSave={handleSaveGuest}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { getAgeBand } from '../utils/ageBands';
import { GuestModal, EMPTY_GUEST } from './steps/StepGuests';
import HeaderCell from './HeaderCell';

export default function GuestListViewer({ list, onConfirm, onBack, onUpdateList, isPreview = false }) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [colFilters, setColFilters] = useState({});
  const [sortKey, setSortKey] = useState('surname');
  const [sortDir, setSortDir] = useState(1);
  const [modal, setModal] = useState(null);
  const [previewCell, setPreviewCell] = useState(null); // { title, content }

  const groups = [...new Set(list.guests.map(g => g.group).filter(Boolean))].sort();
  const arrivalAirports = [...new Set(list.guests.map(g => g.arrivalAirport).filter(Boolean))].sort();
  const departureAirports = [...new Set(list.guests.map(g => g.departureAirport).filter(Boolean))].sort();

  const airportOptions = (list) => [
    ...list.map(a => ({ value: a, label: a })),
    { value: 'none', label: '— None' },
  ];

  const handleUpdateGuest = (updatedGuest) => {
    let nextGuests;
    if (modal === 'add') {
      nextGuests = [...list.guests, updatedGuest];
    } else {
      nextGuests = list.guests.map(g => g.id === updatedGuest.id ? updatedGuest : g);
    }
    onUpdateList(nextGuests);
    setModal(null);
  };

  const handleDeleteGuest = (id) => {
    if (window.confirm("Delete this guest from the list?")) {
      onUpdateList(list.guests.filter(g => g.id !== id));
    }
  };

  const updateFilter = (col, val) => setColFilters(prev => ({ ...prev, [col]: val }));

  const filtered = list.guests
    .filter(g => {
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        if (!(
          (g.name || '').toLowerCase().includes(q) ||
          (g.surname || '').toLowerCase().includes(q) ||
          (g.externalId || '').toLowerCase().includes(q) ||
          (g.group || '').toLowerCase().includes(q) ||
          String(g.age || '').includes(q) ||
          (Array.isArray(g.medical) ? g.medical.join(' ') : (g.medical || '')).toLowerCase().includes(q) ||
          (g.privateNotes || '').toLowerCase().includes(q)
        )) return false;
      }
      for (const [col, val] of Object.entries(colFilters)) {
        if (!val || val === 'all') continue;
        if (col === 'arrivalAirport' || col === 'departureAirport') {
          if (val === 'none') { if (g[col]) return false; }
          else { if (g[col] !== val) return false; }
        } else {
          const q = val.toLowerCase();
          if (!String(g[col] || '').toLowerCase().includes(q)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      if (sortKey === 'arrival' || sortKey === 'departure') {
        va = (a[`${sortKey}Date`] || '') + (a[`${sortKey}Time`] || '');
        vb = (b[`${sortKey}Date`] || '') + (b[`${sortKey}Time`] || '');
      }
      if (sortKey === 'medical_notes') {
        va = (a.medical || '') + (a.privateNotes || '');
        vb = (b.medical || '') + (b.privateNotes || '');
      }
      if (typeof va === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * sortDir;
    });

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  return (
    <div className="saas-tab-content">
      <div style={{ padding: '16px 32px', background: '#fff', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Exit</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{list.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{list.guests.length} guests · {filtered.length} filtered</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={() => setModal('add')}>➕ Add Manually</button>
          {isPreview && (
            <button className="btn btn-primary" onClick={onConfirm}>✅ Confirm and Save List</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <div className="filter-bar-search" style={{ flex: 1 }}>
            <span className="filter-search-icon">🔍</span>
            <input
              className="filter-search-input"
              placeholder="Search by name, ID, group, age, medical..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
            />
            {globalSearch && <button className="filter-clear-btn" onClick={() => setGlobalSearch('')}>×</button>}
          </div>
        </div>

        <div className="guest-table-wrap" style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table className="guest-table mini-headers">
            <thead>
              <tr>
                <HeaderCell col="group" label="Group" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="externalId" label="ID" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="surname" label="Name / Surname" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="sex" label="Sex" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="age" label="Age" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="dob" label="DOB" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="medical_notes" label="Medical/Notes" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="arrival" label="Arrival" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <HeaderCell col="departure" label="Departure" sortKey={sortKey} sortDir={sortDir} colFilters={colFilters} onSort={toggleSort} onFilter={updateFilter} />
                <th style={{ width: 80, verticalAlign: 'top', paddingTop: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => {
                const med = Array.isArray(g.medical) ? g.medical.join(', ') : (g.medical || '');
                const medFull = [med && `⚕ ${med}`, g.privateNotes && `📝 ${g.privateNotes}`].filter(Boolean).join(' · ');
                const arrFull = [g.arrivalDate, g.arrivalTime].filter(Boolean).join(' ');
                const depFull = [g.departureDate, g.departureTime].filter(Boolean).join(' ');
                const truncStyle = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
                return (
                  <tr key={g.id || i}>
                    <td style={{ maxWidth: 110 }}>
                      <span style={truncStyle} title={g.group || ''}>{g.group || '—'}</span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{g.externalId || '—'}</td>
                    <td>
                      <div className="guest-name-cell">
                        <div className={`guest-avatar ${g.sex === 'M' ? 'male' : 'female'}`}>
                          {(g.name?.[0] || '') + (g.surname?.[0] || '')}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                          {g.name} {g.surname}
                          {g.role && <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 4px' }}>{g.role}</span>}
                          {Number(g.age) < 12 && <span className="badge" style={{ fontSize: 10, padding: '2px 4px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>⚠ &lt;12</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{g.sex === 'M' ? '♂ M' : '♀ F'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getAgeBand(g.age).bg }} />
                        {g.age}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{g.dob || '—'}</td>
                    <td style={{ maxWidth: 160, fontSize: 11 }}>
                      {medFull ? (
                        <span
                          style={{ ...truncStyle, color: med ? 'var(--danger-600)' : 'var(--gray-600)', cursor: 'pointer' }}
                          title={medFull}
                          onClick={() => setPreviewCell({ title: `${g.name} ${g.surname}`, content: medFull })}
                        >
                          {medFull}
                        </span>
                      ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      <div>{arrFull || '—'}</div>
                      {g.arrivalAirport && <div style={{ color: 'var(--gray-500)', marginTop: 1 }}>✈ {g.arrivalAirport}</div>}
                    </td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      <div>{depFull || '—'}</div>
                      {g.departureAirport && <div style={{ color: 'var(--gray-500)', marginTop: 1 }}>✈ {g.departureAirport}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setModal(g.id)}>✏️</button>
                        <button className="btn btn-danger-outline btn-xs" onClick={() => handleDeleteGuest(g.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <GuestModal
          guest={modal === 'add' ? EMPTY_GUEST() : list.guests.find(g => g.id === modal)}
          onSave={handleUpdateGuest}
          onClose={() => setModal(null)}
        />
      )}

      {previewCell && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPreviewCell(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-700)', marginBottom: 10 }}>{previewCell.title}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-800)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{previewCell.content}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setPreviewCell(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

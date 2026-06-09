import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { getAgeBand } from '../utils/ageBands';
import { parseDateShared } from '../lib/dateUtils';
import { GuestModal, EMPTY_GUEST, generateId } from '../components/steps/StepGuests';

function MultiSelect({ values, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const visible = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = val =>
    onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 155 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
          minHeight: 32, padding: values.length ? '3px 6px' : '0 8px',
          border: '1px solid var(--gray-300)', borderRadius: 6,
          background: '#fff', cursor: 'pointer', fontSize: 12,
          outline: open ? '2px solid var(--primary-300)' : 'none',
        }}
      >
        {values.length === 0
          ? <span style={{ color: 'var(--gray-400)', lineHeight: '26px', paddingLeft: 2 }}>{placeholder}</span>
          : values.map(v => {
              const label = options.find(o => o.value === v)?.label || v;
              return (
                <span key={v} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  background: 'var(--primary-100)', color: 'var(--primary-800)',
                  borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
                }}>
                  {label}
                  <span onMouseDown={e => { e.stopPropagation(); toggle(v); }}
                    style={{ cursor: 'pointer', opacity: 0.6, fontWeight: 700, lineHeight: 1 }}>×</span>
                </span>
              );
            })
        }
        <span style={{ marginLeft: 'auto', paddingLeft: 4, color: 'var(--gray-400)', fontSize: 10 }}>▾</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%',
          background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 400,
          maxHeight: 240, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--gray-100)' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..." onKeyDown={e => e.key === 'Escape' && setOpen(false)}
              style={{ width: '100%', border: '1px solid var(--gray-200)', borderRadius: 5,
                padding: '4px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {visible.length === 0
              ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gray-400)' }}>No results</div>
              : visible.map(o => {
                  const sel = values.includes(o.value);
                  return (
                    <div key={o.value}
                      onMouseDown={e => { e.preventDefault(); toggle(o.value); }}
                      style={{
                        padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: sel ? 'var(--primary-50)' : '#fff',
                        color: sel ? 'var(--primary-800)' : 'var(--gray-700)',
                        fontWeight: sel ? 600 : 400,
                      }}
                      onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--gray-50)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = sel ? 'var(--primary-50)' : '#fff'; }}
                    >
                      <span style={{
                        width: 14, height: 14, flexShrink: 0, borderRadius: 3,
                        border: `2px solid ${sel ? 'var(--primary-500)' : 'var(--gray-300)'}`,
                        background: sel ? 'var(--primary-500)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <span style={{ color: '#fff', fontSize: 9, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                      </span>
                      {o.label}
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}
    </div>
  );
}

function emptyRow() {
  return { _id: Math.random().toString(36).slice(2), name: '', surname: '', sex: 'M', age: '', dob: '' };
}

function AddGuestsModal({ savedGroups, savedGuestLists, onSave, onClose }) {
  const existingGroupNames = savedGroups.map(g => g.name);
  const [group, setGroup] = useState('');
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [targetListId, setTargetListId] = useState(savedGuestLists[0]?.id || '__new__');
  const [rows, setRows] = useState([emptyRow()]);

  const updateRow = (_id, key, val) => setRows(prev => prev.map(r => r._id === _id ? { ...r, [key]: val } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = _id => setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== _id) : prev);

  const validRows = rows.filter(r => r.name.trim() && r.surname.trim());

  const handleSave = () => {
    if (!validRows.length) return;
    const groupName = group.trim() || 'No Group';
    const guests = validRows.map(r => ({
      ...EMPTY_GUEST(),
      id: generateId(),
      name: r.name.trim(),
      surname: r.surname.trim(),
      fullName: `${r.name.trim()} ${r.surname.trim()}`,
      sex: r.sex,
      age: parseInt(r.age) || '',
      dob: r.dob,
      group: groupName,
    }));
    onSave(guests, targetListId, groupName, isNewGroup);
  };

  const groupIsNew = group.trim() && !existingGroupNames.includes(group.trim());

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 780, width: '95vw' }}>
        <div className="modal-header">
          <h2>Add Guests</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          {/* Group + Target list */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Group</label>
              <input
                className="form-input"
                list="add-guests-group-list"
                value={group}
                onChange={e => setGroup(e.target.value)}
                placeholder="Group name (e.g. Group A)"
              />
              <datalist id="add-guests-group-list">
                {existingGroupNames.map(n => <option key={n} value={n} />)}
              </datalist>
              {groupIsNew && (
                <div style={{ fontSize: 11, color: '#059669', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>✚</span> A new group will be created
                  <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isNewGroup} onChange={e => setIsNewGroup(e.target.checked)} />
                    Add to Groups
                  </label>
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Add to list</label>
              <select className="form-select" value={targetListId} onChange={e => setTargetListId(e.target.value)}>
                {savedGuestLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="__new__">— New list &quot;Manual Entry&quot;</option>
              </select>
            </div>
          </div>

          {/* Guest rows */}
          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gray-600)', fontSize: 11 }}>Forename *</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gray-600)', fontSize: 11 }}>Surname *</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gray-600)', fontSize: 11 }}>Gender</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gray-600)', fontSize: 11 }}>Age</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--gray-600)', fontSize: 11 }}>DOB</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="form-input"
                        style={{ margin: 0, padding: '5px 8px', fontSize: 13 }}
                        placeholder="Forename"
                        value={r.name}
                        onChange={e => updateRow(r._id, 'name', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addRow(); }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="form-input"
                        style={{ margin: 0, padding: '5px 8px', fontSize: 13 }}
                        placeholder="Surname"
                        value={r.surname}
                        onChange={e => updateRow(r._id, 'surname', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addRow(); }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <select
                        className="form-select"
                        style={{ margin: 0, padding: '5px 8px', fontSize: 13 }}
                        value={r.sex}
                        onChange={e => updateRow(r._id, 'sex', e.target.value)}
                      >
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ margin: 0, padding: '5px 8px', fontSize: 13, width: 64 }}
                        placeholder="16"
                        min={1} max={120}
                        value={r.age}
                        onChange={e => updateRow(r._id, 'age', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="form-input"
                        style={{ margin: 0, padding: '5px 8px', fontSize: 13, width: 110 }}
                        placeholder="dd/mm/yyyy"
                        value={r.dob}
                        onChange={e => updateRow(r._id, 'dob', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--gray-400)', fontSize: 15, lineHeight: 1 }}
                        onClick={() => removeRow(r._id)}
                        title="Remove row"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={addRow}>+ Add row</button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={validRows.length === 0}
            onClick={handleSave}
          >
            Save {validRows.length > 0 ? `${validRows.length} guest${validRows.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabOspiti() {
  const { state, dispatch } = useApp();
  const [globalSearch, setGlobalSearch] = useState('');
  const [sortKey, setSortKey] = useState('surname');
  const [sortDir, setSortDir] = useState(1);
  const [editModal, setEditModal] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [intakeFilter, setIntakeFilter] = useState([]);
  const [groupFilter, setGroupFilter] = useState([]);
  const [agenteFilter, setAgenteFilter] = useState([]);
  const [strutturaFilter, setStrutturaFilter] = useState([]);

  const allGuests = useMemo(() => {
    const guests = [];
    state.savedGuestLists.forEach(list => {
      list.guests.forEach(g => {
        guests.push({ ...g, _sourceListId: list.id, _sourceListName: list.name });
      });
    });
    return guests;
  }, [state.savedGuestLists]);

  const allocLookup = useMemo(() => {
    const lookup = {};
    state.savedAllocations.forEach(alloc => {
      const roomMap = {};
      alloc.accommodation?.floors?.forEach(f =>
        f.corridors?.forEach(c =>
          c.rooms?.forEach(r => { roomMap[r.id] = r.number; })
        )
      );
      alloc.guests?.forEach(g => {
        if (g.roomId) {
          lookup[g.id] = {
            struttura: alloc.accommodation?.name || '',
            roomNumber: roomMap[g.roomId] || '',
          };
        }
      });
    });
    return lookup;
  }, [state.savedAllocations]);

  const guestIdToName = useMemo(() => {
    const map = {};
    allGuests.forEach(g => { map[g.id] = `${g.name || ''} ${g.surname || ''}`.trim(); });
    return map;
  }, [allGuests]);

  const groupInfoLookup = useMemo(() => {
    const lookup = {};
    state.savedGroups.forEach(group => {
      const guests = allGuests.filter(g => g.group === group.name);
      const intakes = state.savedIntakes.filter(intake => {
        if (!intake.startDate || !intake.endDate) return false;
        const effStart = new Date(intake.startDate);
        effStart.setDate(effStart.getDate() + 1);
        effStart.setHours(0, 0, 0, 0);
        const effEnd = new Date(intake.endDate);
        effEnd.setHours(23, 59, 59, 999);
        return guests.some(g => {
          const arr = parseDateShared(g.arrivalDate);
          const dep = parseDateShared(g.departureDate);
          if (!arr || !dep) return false;
          return arr <= effEnd && dep >= effStart;
        });
      });
      lookup[group.name] = { agente: group.agente || '', intakes };
    });
    return lookup;
  }, [state.savedGroups, state.savedIntakes, allGuests]);

  const handleAddGuests = (newGuests, targetListId, groupName, createGroup) => {
    if (createGroup && groupName && groupName !== 'No Group') {
      const exists = state.savedGroups.some(g => g.name === groupName);
      if (!exists) {
        dispatch({ type: 'CREATE_GROUP', group: { id: `grp-${Date.now()}`, name: groupName, struttura: '', agente: '' } });
      }
    }
    if (targetListId === '__new__') {
      dispatch({ type: 'SAVE_GUEST_LIST', name: `Inserimento Manuale ${new Date().toLocaleDateString('it-IT')}`, guests: newGuests });
    } else {
      const list = state.savedGuestLists.find(l => l.id === targetListId);
      if (list) {
        dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: targetListId, guests: [...list.guests, ...newGuests] });
      }
    }
    setShowAddModal(false);
  };

  const handleUpdateGuest = (updatedGuest) => {
    const sourceListId = updatedGuest._sourceListId;
    const list = state.savedGuestLists.find(l => l.id === sourceListId);
    if (!list) return;
    const { _sourceListId, _sourceListName, ...guestData } = updatedGuest;
    const nextGuests = list.guests.map(g => g.id === guestData.id ? guestData : g);
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: sourceListId, guests: nextGuests });
    setEditModal(null);
  };

  const filterOptions = useMemo(() => {
    const intakes = state.savedIntakes.map(i => ({ id: i.id, name: i.name }));
    const groups = [...new Set(allGuests.map(g => g.group).filter(Boolean))].sort();
    const agenti = [...new Set(allGuests.map(g => groupInfoLookup[g.group]?.agente).filter(Boolean))].sort();
    const strutture = [...new Set(allGuests.map(g => allocLookup[g.id]?.struttura).filter(Boolean))].sort();
    return { intakes, groups, agenti, strutture };
  }, [allGuests, state.savedIntakes, groupInfoLookup, allocLookup]);

  const filtered = useMemo(() => {
    let list = allGuests;

    if (intakeFilter.length > 0) {
      list = list.filter(g => intakeFilter.some(id => groupInfoLookup[g.group]?.intakes?.some(i => i.id === id)));
    }
    if (groupFilter.length > 0) {
      list = list.filter(g => groupFilter.includes(g.group));
    }
    if (agenteFilter.length > 0) {
      list = list.filter(g => agenteFilter.includes(groupInfoLookup[g.group]?.agente || ''));
    }
    if (strutturaFilter.length > 0) {
      list = list.filter(g => strutturaFilter.includes(allocLookup[g.id]?.struttura || ''));
    }

    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      list = list.filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.surname || '').toLowerCase().includes(q) ||
        (g.externalId || '').toLowerCase().includes(q) ||
        (g.group || '').toLowerCase().includes(q) ||
        (g._sourceListName || '').toLowerCase().includes(q) ||
        (allocLookup[g.id]?.struttura || '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let va, vb;
      if (sortKey === 'agente') {
        va = groupInfoLookup[a.group]?.agente ?? '';
        vb = groupInfoLookup[b.group]?.agente ?? '';
      } else if (sortKey === 'intake') {
        va = groupInfoLookup[a.group]?.intakes?.[0]?.name ?? '';
        vb = groupInfoLookup[b.group]?.intakes?.[0]?.name ?? '';
      } else if (sortKey === 'struttura') {
        va = allocLookup[a.id]?.struttura ?? '';
        vb = allocLookup[b.id]?.struttura ?? '';
      } else if (sortKey === 'roomNumber') {
        va = allocLookup[a.id]?.roomNumber ?? '';
        vb = allocLookup[b.id]?.roomNumber ?? '';
      } else {
        va = a[sortKey] ?? '';
        vb = b[sortKey] ?? '';
      }
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * sortDir;
    });
  }, [allGuests, intakeFilter, groupFilter, agenteFilter, strutturaFilter, globalSearch, sortKey, sortDir, allocLookup, groupInfoLookup]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  if (state.savedGuestLists.length === 0) {
    return (
      <div className="saas-tab-content">
        <div className="saas-header"><h1>Guests</h1></div>
        <div className="saas-pane">
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--gray-400)', background: '#fff', borderRadius: 8, border: '1px dashed var(--gray-300)' }}>
            No guests imported yet. Go to <strong>Lists</strong> and upload an Excel file to get started.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saas-tab-content">
      <div style={{ padding: '16px 32px', background: '#fff', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Guests</h1>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
            {allGuests.length} total guests · {filtered.length} shown
            {allGuests.filter(g => allocLookup[g.id]).length > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--primary-600)', fontWeight: 600 }}>
                · {allGuests.filter(g => allocLookup[g.id]).length} assigned
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>➕ Add Guests</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="filter-bar-search" style={{ flex: 1, minWidth: 200 }}>
            <span className="filter-search-icon">🔍</span>
            <input
              className="filter-search-input"
              placeholder="Search by name, ID, group, list, structure..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
            />
            {globalSearch && <button className="filter-clear-btn" onClick={() => setGlobalSearch('')}>×</button>}
          </div>
          <MultiSelect values={intakeFilter} onChange={setIntakeFilter} placeholder="All intakes"
            options={filterOptions.intakes.map(i => ({ value: i.id, label: i.name }))} />
          <MultiSelect values={groupFilter} onChange={setGroupFilter} placeholder="All groups"
            options={filterOptions.groups.map(g => ({ value: g, label: g }))} />
          <MultiSelect values={agenteFilter} onChange={setAgenteFilter} placeholder="All agents"
            options={filterOptions.agenti.map(a => ({ value: a, label: a }))} />
          <MultiSelect values={strutturaFilter} onChange={setStrutturaFilter} placeholder="All structures"
            options={filterOptions.strutture.map(s => ({ value: s, label: s }))} />
          {(intakeFilter.length > 0 || groupFilter.length > 0 || agenteFilter.length > 0 || strutturaFilter.length > 0) && (
            <button className="btn btn-ghost btn-xs" onClick={() => { setIntakeFilter([]); setGroupFilter([]); setAgenteFilter([]); setStrutturaFilter([]); }}>× Clear filters</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: allGuests.length, color: 'var(--gray-700)', bg: 'var(--gray-100)' },
            { label: '♂ Male', value: allGuests.filter(g => g.sex === 'M').length, color: '#1d4ed8', bg: '#dbeafe' },
            { label: '♀ Female', value: allGuests.filter(g => g.sex === 'F').length, color: '#be185d', bg: '#fce7f3' },
            { label: 'With room', value: allGuests.filter(g => allocLookup[g.id]).length, color: '#065f46', bg: '#d1fae5' },
            { label: 'Travel With', value: allGuests.filter(g => (Array.isArray(g.roommateIds) ? g.roommateIds.length : (g.roommateId ? 1 : 0)) > 0).length, color: '#0369a1', bg: '#e0f2fe' },
            { label: 'With allergies', value: allGuests.filter(g => Array.isArray(g.allergy) && g.allergy.length > 0).length, color: '#92400e', bg: '#fef3c7' },
            { label: 'With medical', value: allGuests.filter(g => Array.isArray(g.medical) && g.medical.length > 0).length, color: '#1e40af', bg: '#eff6ff' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="guest-table-wrap" style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
          <table className="guest-table mini-headers" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort('struttura')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: 'var(--primary-700)', background: 'var(--primary-50)' }}>Structure <span style={{ fontSize: 10, color: 'var(--primary-400)' }}>{sortKey === 'struttura' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th onClick={() => toggleSort('roomNumber')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: 'var(--primary-700)', background: 'var(--primary-50)' }}>Room Nr. <span style={{ fontSize: 10, color: 'var(--primary-400)' }}>{sortKey === 'roomNumber' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th onClick={() => toggleSort('group')} style={{ cursor: 'pointer', userSelect: 'none' }}>Group <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{sortKey === 'group' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th onClick={() => toggleSort('surname')} style={{ cursor: 'pointer', userSelect: 'none' }}>Name / Surname <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{sortKey === 'surname' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th>Gender</th>
                <th onClick={() => toggleSort('age')} style={{ cursor: 'pointer', userSelect: 'none' }}>Age <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{sortKey === 'age' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ whiteSpace: 'nowrap', color: '#0369a1', background: '#e0f2fe' }}>Travel With</th>
                <th style={{ color: '#92400e', background: '#fef3c7' }}>Allergies</th>
                <th style={{ color: '#1e40af', background: '#eff6ff' }}>Medical</th>
                <th onClick={() => toggleSort('agente')} style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--gray-500)', background: 'var(--gray-50)' }}>Agent <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{sortKey === 'agente' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th onClick={() => toggleSort('intake')} style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--gray-500)', background: 'var(--gray-50)' }}>Intake <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{sortKey === 'intake' ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></th>
                <th style={{ whiteSpace: 'nowrap' }}>Arrival</th>
                <th style={{ whiteSpace: 'nowrap' }}>Departure</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No results found.</td></tr>
              ) : filtered.map((g, i) => {
                const alloc = allocLookup[g.id];
                const travelWithNames = (Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []))
                  .map(id => guestIdToName[id])
                  .filter(Boolean);
                const allergies = Array.isArray(g.allergy) ? g.allergy : [];
                const medical = Array.isArray(g.medical) ? g.medical : [];

                return (
                  <tr key={g.id || i}>
                    <td style={{ background: alloc ? 'var(--primary-50)' : undefined }}>
                      {alloc ? (
                        <span style={{ fontSize: 12, color: 'var(--primary-700)', fontWeight: 600 }}>{alloc.struttura}</span>
                      ) : <span style={{ color: 'var(--gray-200)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ background: alloc ? 'var(--primary-50)' : undefined, textAlign: 'center' }}>
                      {alloc ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-800)', background: 'var(--primary-100)', padding: '2px 8px', borderRadius: 6 }}>
                          {alloc.roomNumber}
                        </span>
                      ) : <span style={{ color: 'var(--gray-200)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{g.group || '—'}</td>
                    <td>
                      <div className="guest-name-cell">
                        <div className={`guest-avatar ${g.sex === 'M' ? 'male' : 'female'}`}>
                          {(g.name?.[0] || '') + (g.surname?.[0] || '')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {g.name} {g.surname}
                            {g.role && <span className="badge badge-primary" style={{ fontSize: 10, padding: '1px 5px', flexShrink: 0 }}>{g.role}</span>}
                            {Number(g.age) < 12 && <span className="badge" style={{ fontSize: 10, padding: '1px 5px', flexShrink: 0, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>⚠ &lt;12</span>}
                          </div>
                          {g.externalId && <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>#{g.externalId}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{g.sex === 'M' ? '♂ M' : '♀ F'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: getAgeBand(g.age).bg, flexShrink: 0 }} />
                        <span style={{ fontSize: 12 }}>{g.age}</span>
                      </div>
                    </td>
                    <td style={{ background: travelWithNames.length ? '#f0f9ff' : undefined }}>
                      {travelWithNames.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {travelWithNames.map((n, j) => (
                            <span key={j} style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>{n}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--gray-200)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ background: allergies.length ? '#fffbeb' : undefined }}>
                      {allergies.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {allergies.map((a, j) => (
                            <span key={j} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>{a}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--gray-200)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ background: medical.length ? '#eff6ff' : undefined }}>
                      {medical.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {medical.map((m, j) => (
                            <span key={j} style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>{m}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--gray-200)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ background: 'var(--gray-50)', fontSize: 12 }}>
                      {groupInfoLookup[g.group]?.agente || <span style={{ color: 'var(--gray-200)' }}>—</span>}
                    </td>
                    <td style={{ background: 'var(--gray-50)' }}>
                      {groupInfoLookup[g.group]?.intakes?.length > 0
                        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {groupInfoLookup[g.group].intakes.map(i => (
                              <span key={i.id} style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{i.name}</span>
                            ))}
                          </div>
                        : <span style={{ color: 'var(--gray-200)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>
                      {g.arrivalAirport && <div style={{ fontWeight: 600 }}>✈ {g.arrivalAirport}</div>}
                      <div>{g.arrivalDate}{g.arrivalTime ? ` ${g.arrivalTime}` : ''}</div>
                    </td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>
                      {g.departureAirport && <div style={{ fontWeight: 600 }}>✈ {g.departureAirport}</div>}
                      <div>{g.departureDate}{g.departureTime ? ` ${g.departureTime}` : ''}</div>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-xs" title="Edit guest" onClick={() => setEditModal(g)}>✏️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <GuestModal
          guest={editModal}
          onSave={handleUpdateGuest}
          onClose={() => setEditModal(null)}
          guestLookup={guestIdToName}
        />
      )}

      {showAddModal && (
        <AddGuestsModal
          savedGroups={state.savedGroups}
          savedGuestLists={state.savedGuestLists}
          onSave={handleAddGuests}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

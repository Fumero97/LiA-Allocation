import { useState } from 'react';
import { fmtDate, computeGroupDateRange, computeIntakes } from './groupUtils';

export default function GroupListView({ savedGroups, allGuests, savedIntakes, unlinked, onView, onDelete, onImport, onNew, onUpdateField, savedAccommodations = [], knownAgenti = [] }) {
  const [editingCell, setEditingCell] = useState(null); // { groupId, field }
  const [editingValue, setEditingValue] = useState('');

  const startEdit = (groupId, field, current) => {
    setEditingCell({ groupId, field });
    setEditingValue(current || '');
  };

  const commitEdit = () => {
    if (!editingCell) return;
    onUpdateField(editingCell.groupId, editingCell.field, editingValue.trim());
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const isEditing = (groupId, field) => editingCell?.groupId === groupId && editingCell?.field === field;

  const InlineCell = ({ groupId, field, value, listId, listItems, placeholder }) => {
    if (isEditing(groupId, field)) {
      return (
        <input
          autoFocus
          value={editingValue}
          list={listId}
          placeholder={placeholder}
          onChange={e => setEditingValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
          style={{ width: '100%', border: '1px solid var(--primary-400)', borderRadius: 5, padding: '3px 7px', fontSize: 13, outline: 'none', background: '#fff' }}
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(groupId, field, value)}
        style={{ cursor: 'text', display: 'block', minWidth: 60, minHeight: 22, borderRadius: 4, padding: '2px 4px',
          color: value ? 'var(--gray-700)' : 'var(--gray-300)', fontStyle: value ? 'normal' : 'italic' }}
        title="Click to edit"
      >
        {value || placeholder}
      </span>
    );
  };

  return (
    <div className="saas-tab-content">
      <div className="saas-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <h1 style={{ margin: 0 }}>Groups</h1>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
              {savedGroups.length} groups · {allGuests.length} total guests
            </div>
          </div>
          <button className="btn btn-primary" onClick={onNew}>➕ New Group</button>
        </div>
      </div>

      <div className="saas-pane">
        {unlinked.length > 0 && (
          <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', borderRadius: 8, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
                {unlinked.length} {unlinked.length === 1 ? 'group found' : 'groups found'} in the guest lists without configuration
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginTop: 2 }}>{unlinked.join(' · ')}</div>
            </div>
            <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', whiteSpace: 'nowrap' }} onClick={onImport}>
              Import all
            </button>
          </div>
        )}

        {savedGroups.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--gray-400)', background: '#fff', borderRadius: 8, border: '1px dashed var(--gray-300)' }}>
            No groups configured. Create a group manually or import automatically from groups found in the guest lists.
          </div>
        ) : (
          <table className="guest-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Guests</th>
                <th>Dates</th>
                <th>Structure</th>
                <th>Agent</th>
                <th>Intake</th>
                <th style={{ width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {savedGroups.map(group => {
                const guests      = allGuests.filter(g => g.group === group.name);
                const intakes     = computeIntakes(group.name, allGuests, savedIntakes);
                const males       = guests.filter(g => g.sex === 'M').length;
                const females     = guests.filter(g => g.sex === 'F').length;
                const staffCount  = guests.filter(g => g.role === 'GL' || g.role === 'LiA').length;
                const studCount   = guests.length - staffCount;
                const medicalCount = guests.filter(g => Array.isArray(g.medical) && g.medical.length > 0).length;
                const allergyCount = guests.filter(g => Array.isArray(g.allergy) && g.allergy.length > 0).length;
                const dateRange   = computeGroupDateRange(group.name, allGuests);
                const dispArrival   = dateRange.arrivalDate   || group.arrivalDate;
                const dispDeparture = dateRange.departureDate || group.departureDate;
                return (
                  <tr key={group.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary-600)', cursor: 'pointer' }} onClick={() => onView(group.id)}>{group.name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: guests.length > 0 ? 'var(--primary-100)' : 'var(--gray-100)', color: guests.length > 0 ? 'var(--primary-700)' : 'var(--gray-400)', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {guests.length}
                          {staffCount > 0 && <span style={{ fontWeight: 400, opacity: 0.75 }}> | {studCount}+{staffCount}</span>}
                        </span>
                        {guests.length > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                            {males}♂/{females}♀
                            {medicalCount > 0 && <span style={{ marginLeft: 5, color: '#1e40af' }}>⚕{medicalCount}</span>}
                            {allergyCount > 0 && <span style={{ marginLeft: 4, color: '#92400e' }}>⚠{allergyCount}</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                      {dispArrival || dispDeparture
                        ? `${fmtDate(dispArrival)} → ${fmtDate(dispDeparture)}`
                        : <span style={{ fontStyle: 'italic', color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <InlineCell groupId={group.id} field="struttura" value={group.struttura} listId="struttura-list" placeholder="—" />
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <InlineCell groupId={group.id} field="agente" value={group.agente} listId="agente-list" placeholder="—" />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {intakes.length > 0
                          ? intakes.map(i => <span key={i.id} style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{i.name}</span>)
                          : <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-danger-outline btn-sm" onClick={() => onDelete(group.id)}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <datalist id="struttura-list">
        {savedAccommodations.map(a => <option key={a.id} value={a.name} />)}
      </datalist>
      <datalist id="agente-list">
        {knownAgenti.map((a, i) => <option key={i} value={a} />)}
      </datalist>
    </div>
  );
}

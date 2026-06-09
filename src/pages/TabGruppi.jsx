import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { EMPTY_GROUP, computeGroupDateRange } from './groupUtils';
import GroupListView   from './GroupListView';
import GroupDetailView from './GroupDetailView';
import GroupFormView   from './GroupFormView';

const toISO = (date) => {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
};

function ImportPreview({ unlinked, allGuests, savedAccommodations, savedIntakes, knownAgenti, onConfirm, onCancel }) {
  const defaultIntake = savedIntakes[0] || null;
  const defaultStruttura = savedAccommodations[0]?.name || '';

  const buildRows = (intakeId) => {
    const intake = savedIntakes.find(i => i.id === intakeId) || defaultIntake;
    return unlinked.map(name => {
      const { arrivalDate, departureDate } = computeGroupDateRange(name, allGuests);
      const hasGuestDates = !!(arrivalDate || departureDate);
      return {
        name,
        guestCount: allGuests.filter(g => g.group === name).length,
        arrivalDate:   intake?.startDate || (hasGuestDates ? toISO(arrivalDate) : ''),
        departureDate: intake?.endDate   || (hasGuestDates ? toISO(departureDate) : ''),
        hasGuestDates,
        struttura: defaultStruttura,
        agente: '',
      };
    });
  };

  const [intakeId, setIntakeId] = useState(defaultIntake?.id || '');
  const [rows, setRows] = useState(() => buildRows(defaultIntake?.id || ''));

  useEffect(() => {
    const intake = savedIntakes.find(i => i.id === intakeId);
    if (!intake) return;
    setRows(prev => prev.map(r => ({
      ...r,
      arrivalDate:   intake.startDate || r.arrivalDate,
      departureDate: intake.endDate   || r.departureDate,
    })));
  }, [intakeId]);

  const updateRow = (i, field, value) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const inputSt = { padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' };

  return (
    <div className="saas-tab-content">
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>← Cancel</button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Import {unlinked.length} Group{unlinked.length !== 1 ? 's' : ''}</h2>

        {savedIntakes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Default dates from intake:</span>
            <select
              style={{ ...inputSt, width: 'auto', minWidth: 140 }}
              value={intakeId}
              onChange={e => setIntakeId(e.target.value)}
            >
              <option value="">— None —</option>
              {savedIntakes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        )}

        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => onConfirm(rows)}
        >
          Create {rows.length} Group{rows.length !== 1 ? 's' : ''} →
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
          Groups found in guest lists but not yet configured. Adjust dates, structure and agent before confirming.
          <span style={{ marginLeft: 8, color: '#94a3b8' }}>Rows with ● have dates derived from the guest list.</span>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thSt}>Group</th>
                <th style={{ ...thSt, width: 60, textAlign: 'center' }}>Guests</th>
                <th style={{ ...thSt, width: 140 }}>Arrival</th>
                <th style={{ ...thSt, width: 140 }}>Departure</th>
                <th style={{ ...thSt, width: 180 }}>Structure</th>
                <th style={{ ...thSt, width: 160 }}>Agent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdSt}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.hasGuestDates && (
                        <span title="Dates from guest list" style={{ color: '#2563eb', fontSize: 10, lineHeight: 1 }}>●</span>
                      )}
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{row.name}</span>
                    </div>
                  </td>
                  <td style={{ ...tdSt, textAlign: 'center', color: '#64748b' }}>{row.guestCount}</td>
                  <td style={tdSt}>
                    <input type="date" style={inputSt} value={row.arrivalDate}
                      onChange={e => updateRow(i, 'arrivalDate', e.target.value)} />
                  </td>
                  <td style={tdSt}>
                    <input type="date" style={inputSt} value={row.departureDate}
                      onChange={e => updateRow(i, 'departureDate', e.target.value)} />
                  </td>
                  <td style={tdSt}>
                    <input
                      style={inputSt}
                      list={`acc-list-${i}`}
                      value={row.struttura}
                      onChange={e => updateRow(i, 'struttura', e.target.value)}
                      placeholder="Structure name…"
                    />
                    <datalist id={`acc-list-${i}`}>
                      {savedAccommodations.map(a => <option key={a.id} value={a.name} />)}
                    </datalist>
                  </td>
                  <td style={tdSt}>
                    <input
                      style={inputSt}
                      list={`agent-list-${i}`}
                      value={row.agente}
                      onChange={e => updateRow(i, 'agente', e.target.value)}
                      placeholder="Agent name…"
                    />
                    <datalist id={`agent-list-${i}`}>
                      {knownAgenti.map(a => <option key={a} value={a} />)}
                    </datalist>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thSt = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' };
const tdSt = { padding: '8px 14px', verticalAlign: 'middle' };

export default function TabGruppi() {
  const { state, dispatch } = useApp();
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [viewingId,  setViewingId]  = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [form,       setForm]       = useState(EMPTY_GROUP());
  const [formError,  setFormError]  = useState('');

  const allGuests = useMemo(() => {
    const out = [];
    state.savedGuestLists.forEach(list => list.guests.forEach(g => out.push({ ...g, _listId: list.id, _listName: list.name })));
    return out;
  }, [state.savedGuestLists]);

  const handleUpdateGroupGuests = (modifiedGuests) => {
    const byList = {};
    modifiedGuests.forEach(g => {
      if (!g._listId) return;
      if (!byList[g._listId]) byList[g._listId] = [];
      byList[g._listId].push(g);
    });
    Object.entries(byList).forEach(([listId, changed]) => {
      const list = state.savedGuestLists.find(l => l.id === listId);
      if (!list) return;
      const nextGuests = list.guests.map(g => {
        const u = changed.find(c => c.id === g.id);
        if (!u) return g;
        const { _listId, _listName, ...clean } = u;
        return clean;
      });
      dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId, guests: nextGuests });
    });
  };

  const rawGroupNames = useMemo(() => [...new Set(allGuests.map(g => g.group).filter(Boolean))], [allGuests]);
  const unlinked      = rawGroupNames.filter(n => !state.savedGroups.some(g => g.name === n));
  const knownAgenti   = useMemo(() => [...new Set(state.savedGroups.map(g => g.agente).filter(Boolean))], [state.savedGroups]);

  const handleSubmit = () => {
    if (!form.name.trim()) { setFormError('Group name is required.'); return; }
    setFormError('');
    if (editingId) {
      const existing = state.savedGroups.find(g => g.id === editingId);
      const updatedGroup = { ...form, id: editingId };
      if (existing && existing.name !== form.name.trim()) {
        dispatch({ type: 'RENAME_GROUP', id: editingId, oldName: existing.name, newName: form.name.trim(), updatedGroup });
      } else {
        dispatch({ type: 'UPDATE_GROUP', group: updatedGroup });
      }
    } else {
      dispatch({ type: 'CREATE_GROUP', group: { ...form, id: `group-${Date.now()}` } });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_GROUP());
  };

  const handleEdit = (group) => {
    setForm({ name: group.name || '', arrivalDate: group.arrivalDate || '', departureDate: group.departureDate || '', struttura: group.struttura || '', agente: group.agente || '' });
    setEditingId(group.id);
    setShowForm(true);
    setViewingId(null);
  };

  const handleCancel = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_GROUP()); setFormError(''); };

  const handleDelete = (id) => {
    if (window.confirm('Delete this group?')) {
      dispatch({ type: 'DELETE_GROUP', id });
      if (viewingId === id) setViewingId(null);
    }
  };

  const handleConfirmImport = (rows) => {
    rows.forEach(row => {
      dispatch({
        type: 'CREATE_GROUP',
        group: {
          id: `group-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: row.name,
          arrivalDate: row.arrivalDate,
          departureDate: row.departureDate,
          struttura: row.struttura,
          agente: row.agente,
        }
      });
    });
    setShowImport(false);
  };

  if (viewingId && !showForm) {
    const group = state.savedGroups.find(g => g.id === viewingId);
    if (!group) { setViewingId(null); return null; }
    return (
      <GroupDetailView
        group={group}
        allGuests={allGuests}
        savedIntakes={state.savedIntakes}
        savedAccommodations={state.savedAccommodations}
        onBack={() => setViewingId(null)}
        onEdit={handleEdit}
        onUpdateGuests={handleUpdateGroupGuests}
      />
    );
  }

  if (showForm) {
    return (
      <GroupFormView
        form={form}
        setForm={setForm}
        editingId={editingId}
        formError={formError}
        rawGroupNames={rawGroupNames}
        knownAgenti={knownAgenti}
        savedAccommodations={state.savedAccommodations}
        savedIntakes={state.savedIntakes}
        allGuests={allGuests}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    );
  }

  if (showImport) {
    return (
      <ImportPreview
        unlinked={unlinked}
        allGuests={allGuests}
        savedAccommodations={state.savedAccommodations}
        savedIntakes={state.savedIntakes}
        knownAgenti={knownAgenti}
        onConfirm={handleConfirmImport}
        onCancel={() => setShowImport(false)}
      />
    );
  }

  return (
    <GroupListView
      savedGroups={state.savedGroups}
      allGuests={allGuests}
      savedIntakes={state.savedIntakes}
      unlinked={unlinked}
      onView={id => setViewingId(id)}
      onDelete={handleDelete}
      onImport={() => setShowImport(true)}
      onNew={() => { setEditingId(null); setForm(EMPTY_GROUP()); setShowForm(true); }}
      onUpdateField={(groupId, field, value) => {
        const grp = state.savedGroups.find(g => g.id === groupId);
        if (grp) dispatch({ type: 'UPDATE_GROUP', group: { ...grp, [field]: value } });
      }}
      savedAccommodations={state.savedAccommodations}
      knownAgenti={knownAgenti}
    />
  );
}

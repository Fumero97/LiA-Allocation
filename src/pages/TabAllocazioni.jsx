import { useState, useMemo } from 'react';
import { useApp } from '../store';
import { parseDateShared } from '../lib/dateUtils';
import { formatDate } from '../lib/dateUtils';
import { exportAllocation } from '../utils/excel';
import StepperView from '../components/StepperView';

export default function TabAllocazioni() {
  const { state, dispatch } = useApp();
  const [showConfigMode, setShowConfigMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedIntakeId, setSelectedIntakeId] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());

  const allGuests = useMemo(() => {
    const out = [];
    state.savedGuestLists.forEach(list => list.guests.forEach(g => out.push(g)));
    return out;
  }, [state.savedGuestLists]);

  const getGroupsForIntake = (intake) => {
    return state.savedGroups.filter(group => {
      const guests = allGuests.filter(g => g.group === group.name);
      if (!guests.length) return false;
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
  };

  const handleIntakeChange = (intakeId) => {
    setSelectedIntakeId(intakeId);
    if (intakeId) {
      const intake = state.savedIntakes.find(i => i.id === intakeId);
      const matched = intake ? getGroupsForIntake(intake) : [];
      setSelectedGroupIds(new Set(matched.map(g => g.id)));
    } else {
      setSelectedGroupIds(new Set(state.savedGroups.map(g => g.id)));
    }
  };

  const toggleGroup = (id) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedIntake = state.savedIntakes.find(i => i.id === selectedIntakeId);
  const selectedAccommodation = selectedTemplate
    ? state.savedAccommodations.find(a => a.id === selectedTemplate)
    : null;

  const chosenGroups = state.savedGroups.filter(g => selectedGroupIds.has(g.id));
  const intakeGuests = chosenGroups.flatMap(group => allGuests.filter(g => g.group === group.name));

  if (state.currentStep > 0 && !showConfigMode) {
    return <StepperView onBackToDashboard={() => dispatch({ type: 'SET_STEP', payload: 0 })} />;
  }

  if (showConfigMode) {
    const allGroupIds = state.savedGroups.map(g => g.id);
    const allChecked = allGroupIds.length > 0 && allGroupIds.every(id => selectedGroupIds.has(id));
    const someChecked = allGroupIds.some(id => selectedGroupIds.has(id));

    return (
      <div className="saas-tab-content">
        <div className="saas-header">
          <h1>New Rooming Project</h1>
        </div>
        <div className="saas-pane">
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginBottom: 20 }} onClick={() => setShowConfigMode(false)}>← Cancel</button>

          <div className="card" style={{ maxWidth: 600, padding: 30 }}>

            {/* Intake */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>Intake <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(optional)</span></label>
              <select className="form-select" value={selectedIntakeId} onChange={e => handleIntakeChange(e.target.value)}>
                <option value="">— All groups —</option>
                {state.savedIntakes.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.startDate} → {i.endDate})</option>
                ))}
              </select>
            </div>

            {/* Groups */}
            {state.savedGroups.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Groups</label>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setSelectedGroupIds(allChecked ? new Set() : new Set(allGroupIds))}
                  >
                    {allChecked ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 10 }}>
                  {state.savedGroups.map(group => {
                    const guestCount = allGuests.filter(g => g.group === group.name).length;
                    const checked = selectedGroupIds.has(group.id);
                    return (
                      <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', background: checked ? 'var(--primary-50)' : '#fff', border: `1px solid ${checked ? 'var(--primary-300)' : 'var(--gray-100)'}` }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{group.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{guestCount} guests</span>
                      </label>
                    );
                  })}
                </div>
                {someChecked && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--primary-700)' }}>
                    {chosenGroups.length} {chosenGroups.length === 1 ? 'group' : 'groups'} selected · {intakeGuests.length} guests
                  </div>
                )}
              </div>
            )}

            {/* Structure */}
            <div style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>Structure</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {state.savedAccommodations.map(acc => (
                  <label key={acc.id} style={{ display: 'flex', gap: 12, padding: 14, border: `1px solid ${selectedTemplate === acc.id ? 'var(--primary-400)' : 'var(--gray-200)'}`, borderRadius: 8, cursor: 'pointer', background: selectedTemplate === acc.id ? 'var(--primary-50)' : '#fff' }}>
                    <input type="radio" name="acc_template" checked={selectedTemplate === acc.id} onChange={() => setSelectedTemplate(acc.id)} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{acc.name || 'Unnamed'}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{acc.data.floors.length} floors configured.</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={!selectedTemplate || !someChecked}
              onClick={() => {
                const startDate = selectedIntake?.startDate || '';
                const endDate = selectedIntake?.endDate || '';
                const guestsToLoad = JSON.parse(JSON.stringify(intakeGuests));
                const tmpl = state.savedAccommodations.find(a => a.id === selectedTemplate);
                dispatch({ type: 'NEW_PROJECT', startStep: 1, accommodationId: tmpl.id, accommodation: JSON.parse(JSON.stringify(tmpl.data)), startDate, endDate });
                if (guestsToLoad.length > 0) {
                  dispatch({ type: 'SET_GUESTS', payload: guestsToLoad });
                }
                setShowConfigMode(false);
              }}
            >Create and Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saas-tab-content">
      <div className="saas-header">
        <h1>Rooming Projects (Allocations)</h1>
      </div>
      <div className="saas-pane">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--gray-600)' }}>Manage guest distributions across structures.</p>
          <button className="btn btn-primary" onClick={() => { setSelectedTemplate(''); setSelectedIntakeId(''); setSelectedGroupIds(new Set(state.savedGroups.map(g => g.id))); setShowConfigMode(true); }}>➕ New Allocation Project</button>
        </div>

        <div className="dashboard-grid">
          {state.savedAllocations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', gridColumn: '1 / -1', background: '#fff', borderRadius: 8, border: '1px dashed var(--gray-300)' }}>
              No projects saved. Create a new one.
            </div>
          ) : state.savedAllocations.map(alloc => (
            <div key={alloc.id} className="card" style={{ padding: 20 }}>
              <div className="card-title">{alloc.name || 'Unnamed allocation'}</div>
              <div className="card-subtitle">Saved on {formatDate(alloc.date)} · Structure: {alloc.accommodation.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
                  dispatch({ type: 'LOAD_ALLOCATION', id: alloc.id });
                }}>📂 Open in Workspace</button>
                <button className="btn btn-success btn-sm" title="Export Excel" onClick={() => exportAllocation(alloc.guests, alloc.accommodation)}>⬇️</button>
                <button className="btn btn-danger-outline btn-sm" title="Delete" onClick={() => {
                  if (window.confirm('Delete this saved allocation?')) dispatch({ type: 'DELETE_ALLOCATION', id: alloc.id });
                }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

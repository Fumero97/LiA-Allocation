import { useState, useRef } from 'react';
import { useApp } from '../store';
import StepAccommodation from '../components/steps/StepAccommodation';
import { formatDate } from '../lib/dateUtils';
import { downloadAccommodationTemplate, parseAccommodationExcel } from '../utils/excel';

const EMPTY_ROW = () => ({ name: '', startDate: '', endDate: '' });

export default function TabSettings() {
  const { state, dispatch } = useApp();
  const [draftRows, setDraftRows] = useState([EMPTY_ROW()]);
  const [batchError, setBatchError] = useState('');
  const [editingIntake, setEditingIntake] = useState(null);
  const [editingAccommodationId, setEditingAccommodationId] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;
    setImportError('');
    setImporting(true);
    try {
      const accommodation = await parseAccommodationExcel(file);
      dispatch({ type: 'SET_ACCOMMODATION', payload: accommodation });
      dispatch({ type: 'SAVE_ACCOMMODATION', name: accommodation.name });
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const updateRow = (i, field, value) =>
    setDraftRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const addRow = () => setDraftRows(rows => [...rows, EMPTY_ROW()]);

  const removeRow = (i) =>
    setDraftRows(rows => rows.length === 1 ? [EMPTY_ROW()] : rows.filter((_, idx) => idx !== i));

  const handleBatchCreate = () => {
    const filledRows = draftRows.filter(r => r.name.trim() || r.startDate || r.endDate);
    if (filledRows.length === 0) { setBatchError('Add at least one intake.'); return; }
    const invalid = filledRows.find(r => !r.name.trim() || !r.startDate || !r.endDate || r.startDate > r.endDate);
    if (invalid) { setBatchError('Some rows have missing data or invalid dates.'); return; }
    setBatchError('');
    filledRows.forEach((r, i) => {
      dispatch({ type: 'CREATE_INTAKE', intake: { ...r, id: `intake-${Date.now()}-${i}` } });
    });
    setDraftRows([EMPTY_ROW()]);
  };

  const handleSaveEdit = () => {
    if (!editingIntake) return;
    if (!editingIntake.name.trim() || !editingIntake.startDate || !editingIntake.endDate) return;
    dispatch({ type: 'UPDATE_INTAKE', intake: editingIntake });
    setEditingIntake(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this intake?')) {
      dispatch({ type: 'DELETE_INTAKE', id });
      if (editingIntake?.id === id) setEditingIntake(null);
    }
  };

  const formatDateRange = (start, end) => {
    const fmt = iso => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(start)} → ${fmt(end)}`;
  };

  const durationDays = (start, end) => {
    if (!start || !end) return null;
    return Math.round((new Date(end) - new Date(start)) / 86400000);
  };

  const inputStyle = {
    border: '1px solid var(--gray-200)',
    borderRadius: 6,
    padding: '5px 8px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff',
  };

  if (state.isEditingAccommodation) {
    return (
      <div className="saas-tab-content">
        <div style={{ padding: '16px 32px', background: '#fff', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'SET_EDITING_ACCOMMODATION', payload: false })}>← Settings</button>
          <button className="btn btn-primary" onClick={() => {
            dispatch({ type: 'SAVE_ACCOMMODATION', id: editingAccommodationId || undefined });
            dispatch({ type: 'SET_EDITING_ACCOMMODATION', payload: false });
            setEditingAccommodationId(null);
          }}>💾 Save Structure</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <StepAccommodation />
        </div>
      </div>
    );
  }

  return (
    <div className="saas-tab-content">
      <div className="saas-header">
        <h1>Settings</h1>
      </div>

      <div className="saas-pane" style={{ maxWidth: 820 }}>

        {/* ── Structures ── */}
        <div style={{ marginBottom: 48 }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 4, height: 22, background: 'var(--primary-600)', borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Structures</h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={downloadAccommodationTemplate}>⬇ Excel Template</button>
              <button className="btn btn-outline btn-sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                {importing ? 'Importing…' : '📂 Import from Excel'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'NEW_ACCOMMODATION' }); setEditingAccommodationId(null); }}>
                ➕ New Structure
              </button>
            </div>
          </div>
          {importError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 6, fontSize: 13 }}>
              {importError}
            </div>
          )}
          <p style={{ margin: '0 0 16px 14px', fontSize: 13, color: 'var(--gray-500)' }}>
            Create and manage hotel or house floor plans. These templates can be used in rooming projects.
          </p>
          {state.savedAccommodations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', background: '#fff', borderRadius: 8, border: '1px dashed var(--gray-300)' }}>
              No structures saved. Create a new one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.savedAccommodations.map(acc => (
                <div key={acc.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{acc.name || 'Unnamed structure'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                      {acc.data.floors.length} floors · {acc.data.floors.reduce((t, f) => t + f.corridors.length, 0)} corridors · created on {formatDate(acc.date)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => {
                      dispatch({ type: 'LOAD_ACCOMMODATION', id: acc.id });
                      dispatch({ type: 'SET_EDITING_ACCOMMODATION', payload: true });
                      setEditingAccommodationId(acc.id);
                    }}>✏️ Edit</button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => {
                      if (window.confirm('Delete this structure?')) dispatch({ type: 'DELETE_ACCOMMODATION', id: acc.id });
                    }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Intake ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 4, height: 22, background: 'var(--primary-600)', borderRadius: 2 }} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Intake</h2>
          </div>
          <p style={{ margin: '0 0 16px 14px', fontSize: 13, color: 'var(--gray-500)' }}>
            Define the intake periods to associate with guests.
          </p>

          {/* Creation table */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', padding: '0 8px 8px 0', letterSpacing: '0.04em' }}>Name</th>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', padding: '0 8px 8px', letterSpacing: '0.04em', width: 150 }}>Start</th>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', padding: '0 8px 8px', letterSpacing: '0.04em', width: 150 }}>End</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px 4px 0' }}>
                      <input
                        style={inputStyle}
                        placeholder="e.g. Intake 1"
                        value={row.name}
                        onChange={e => updateRow(i, 'name', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input
                        type="date"
                        style={inputStyle}
                        value={row.startDate}
                        onChange={e => updateRow(i, 'startDate', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input
                        type="date"
                        style={inputStyle}
                        value={row.endDate}
                        onChange={e => updateRow(i, 'endDate', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '4px 0 4px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeRow(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', fontSize: 16, lineHeight: 1, padding: 2 }}
                        title="Remove row"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {batchError && (
              <div style={{ marginTop: 10, padding: '7px 12px', background: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 6, fontSize: 13 }}>
                {batchError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={addRow}>+ Add row</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={handleBatchCreate}>
                Create intake
              </button>
            </div>
          </div>

          {/* Saved intakes list */}
          {state.savedIntakes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', background: '#fff', borderRadius: 8, border: '1px dashed var(--gray-300)' }}>
              No intakes created.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.savedIntakes.map(intake => {
                const days = durationDays(intake.startDate, intake.endDate);
                const isEditing = editingIntake?.id === intake.id;
                return (
                  <div key={intake.id} className="card" style={{ padding: '14px 18px', borderLeft: `4px solid ${isEditing ? 'var(--primary-500)' : 'var(--gray-200)'}`, background: isEditing ? 'var(--primary-50)' : '#fff' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={editingIntake.name}
                          onChange={e => setEditingIntake(ei => ({ ...ei, name: e.target.value }))}
                        />
                        <input
                          type="date"
                          style={{ ...inputStyle, width: 150 }}
                          value={editingIntake.startDate}
                          onChange={e => setEditingIntake(ei => ({ ...ei, startDate: e.target.value }))}
                        />
                        <input
                          type="date"
                          style={{ ...inputStyle, width: 150 }}
                          value={editingIntake.endDate}
                          onChange={e => setEditingIntake(ei => ({ ...ei, endDate: e.target.value }))}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingIntake(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>{intake.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            {intake.startDate && intake.endDate ? formatDateRange(intake.startDate, intake.endDate) : '—'}
                            {days !== null && (
                              <span style={{ marginLeft: 10, background: 'var(--gray-100)', color: 'var(--gray-600)', padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                                {days} {days === 1 ? 'day' : 'days'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingIntake({ ...intake })}>✏️ Edit</button>
                          <button className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(intake.id)}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

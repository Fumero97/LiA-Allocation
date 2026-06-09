import { computeIntakes } from './groupUtils';

export default function GroupFormView({ form, setForm, editingId, formError, rawGroupNames, knownAgenti, savedAccommodations, savedIntakes, allGuests, onSubmit, onCancel }) {
  const previewIntakes = computeIntakes(form.name, allGuests, savedIntakes);
  const groupGuests    = allGuests.filter(g => g.group === form.name);

  return (
    <div className="saas-tab-content">
      <div style={{ padding: '14px 32px', background: '#fff', borderBottom: '1px solid var(--gray-200)', flexShrink: 0 }}>
        <button className="btn btn-ghost" onClick={onCancel}>← Cancel</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div className="card" style={{ maxWidth: 620, padding: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editingId ? 'Edit Group' : 'New Group'}</h3>

          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input
              className="form-input"
              placeholder="es. Group A, Turno Estate…"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              list="grp-names-dl"
            />
            <datalist id="grp-names-dl">
              {rawGroupNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Arrival Date</label>
              <input type="date" className="form-input" value={form.arrivalDate} onChange={e => setForm(f => ({ ...f, arrivalDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Departure Date</label>
              <input type="date" className="form-input" value={form.departureDate} onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))} />
            </div>
          </div>

          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Structure</label>
              <input className="form-input" placeholder="Structure name…" value={form.struttura} onChange={e => setForm(f => ({ ...f, struttura: e.target.value }))} list="grp-strutt-dl" />
              <datalist id="grp-strutt-dl">
                {savedAccommodations.map(a => <option key={a.id} value={a.name} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Agent</label>
              <input className="form-input" placeholder="Agent name…" value={form.agente} onChange={e => setForm(f => ({ ...f, agente: e.target.value }))} list="agenti-list" autoComplete="off" />
              <datalist id="agenti-list">{knownAgenti.map(a => <option key={a} value={a} />)}</datalist>
            </div>
          </div>

          {savedIntakes.length > 0 && (
            <div style={{ padding: '10px 14px', border: '1px solid #ede9fe', borderRadius: 8, background: '#faf5ff', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Automatically assigned intakes
              </div>
              {previewIntakes.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {previewIntakes.map(i => <span key={i.id} style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{i.name}</span>)}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>
                  {form.name
                    ? groupGuests.length === 0
                      ? `No guests found for "${form.name}" in the lists.`
                      : 'No intake overlapping with guest dates.'
                    : 'Enter the group name to calculate intakes.'}
                </span>
              )}
            </div>
          )}

          {formError && <div style={{ padding: '8px 12px', background: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{formError}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={onSubmit}>{editingId ? '💾 Save changes' : '➕ Create Group'}</button>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

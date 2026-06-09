import { useState, useEffect, useRef } from 'react';
import { getCenters, createCenter, getUsers, loadCenterState, saveCenterState } from '../../firebase';
import { parseAccommodationExcel, downloadAccommodationTemplate } from '../../utils/excel';

export default function AdminCentres({ onEnterCentre }) {
  const [centres, setCentres] = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importState, setImportState] = useState({}); // { [centreId]: 'importing' | 'done' | 'error' }
  const fileRefs = useRef({});

  const load = async () => {
    setLoading(true);
    const [c, u] = await Promise.all([getCenters(), getUsers()]);
    setCentres(c);
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim()) { setError('ID and name are required.'); return; }
    setSaving(true);
    setError('');
    try {
      await createCenter(form.id.trim(), { name: form.name.trim(), location: form.location.trim(), createdAt: new Date().toISOString() });
      setForm({ id: '', name: '', location: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImportStructure = async (centreId, file) => {
    if (!file) return;
    setImportState(s => ({ ...s, [centreId]: 'importing' }));
    try {
      const accommodation = await parseAccommodationExcel(file);
      const newSnap = {
        id: `acc-${Date.now()}`,
        name: accommodation.name,
        date: new Date().toISOString(),
        data: accommodation,
      };
      const currentState = await loadCenterState(centreId) || {};
      const existing = Array.isArray(currentState.savedAccommodations) ? currentState.savedAccommodations : [];
      const merged = { ...currentState, savedAccommodations: [newSnap, ...existing] };
      await saveCenterState(centreId, merged);
      setImportState(s => ({ ...s, [centreId]: 'done' }));
      setTimeout(() => setImportState(s => ({ ...s, [centreId]: null })), 2500);
    } catch (err) {
      setImportState(s => ({ ...s, [centreId]: 'error' }));
      setTimeout(() => setImportState(s => ({ ...s, [centreId]: null })), 3000);
      console.error(err);
    }
    if (fileRefs.current[centreId]) fileRefs.current[centreId].value = '';
  };

  const managersOf = (centreId) => users.filter(u =>
    u.role === 'manager' && (
      (Array.isArray(u.centerIds) && u.centerIds.includes(centreId)) ||
      u.centerId === centreId
    )
  );

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>{centres.length} centre{centres.length !== 1 ? 's' : ''} registered</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadAccommodationTemplate} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            ⬇ Structure Template
          </button>
          <button onClick={() => setShowForm(s => !s)} style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {showForm ? 'Cancel' : '+ New Centre'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid #e2e8f0', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 120px' }}>
            <label style={labelStyle}>Centre ID</label>
            <input style={inputStyle} placeholder="e.g. london-1" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} placeholder="e.g. London Hampstead" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} placeholder="e.g. London, UK" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
            {saving ? 'Saving…' : 'Create Centre'}
          </button>
          {error && <div style={{ width: '100%', color: '#dc2626', fontSize: 13 }}>{error}</div>}
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading centres…</div>
      ) : centres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          No centres yet. Create the first one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {centres.map(c => {
            const managers = managersOf(c.id);
            const iState = importState[c.id];
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏫</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {c.location && <span>{c.location} · </span>}
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.id}</span>
                      {managers.length > 0 && (
                        <span style={{ marginLeft: 8, color: '#2563eb' }}>
                          · {managers.map(m => m.displayName || m.email).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Import structure */}
                  <input
                    ref={el => fileRefs.current[c.id] = el}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={e => handleImportStructure(c.id, e.target.files[0])}
                  />
                  <button
                    onClick={() => fileRefs.current[c.id]?.click()}
                    disabled={iState === 'importing'}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #e2e8f0', flexShrink: 0,
                      background: iState === 'done' ? '#f0fdf4' : iState === 'error' ? '#fef2f2' : '#f8fafc',
                      color: iState === 'done' ? '#16a34a' : iState === 'error' ? '#dc2626' : '#475569',
                      borderColor: iState === 'done' ? '#bbf7d0' : iState === 'error' ? '#fecaca' : '#e2e8f0',
                    }}
                  >
                    {iState === 'importing' ? 'Importing…' : iState === 'done' ? '✓ Imported' : iState === 'error' ? '✗ Error' : '📂 Import Structure'}
                  </button>

                  <button
                    onClick={() => onEnterCentre({ id: c.id, name: c.name })}
                    style={{ padding: '8px 18px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Open →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' };

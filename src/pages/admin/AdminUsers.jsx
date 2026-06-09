import { useState, useEffect } from 'react';
import { getUsers, getCenters, setUserDoc, createUserAsAdmin } from '../../firebase';

const EMPTY_FORM = { displayName: '', email: '', password: '', role: 'manager', centerIds: [] };

export default function AdminUsers() {
  const [users, setUsers]     = useState([]);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [u, c] = await Promise.all([getUsers(), getCenters()]);
    setUsers(u);
    setCentres(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const centreNames = (u) => {
    const ids = Array.isArray(u.centerIds) && u.centerIds.length > 0 ? u.centerIds : (u.centerId ? [u.centerId] : []);
    return ids.map(id => centres.find(c => c.id === id)?.name || id).join(', ') || '—';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.displayName) { setCreateError('All fields are required.'); return; }
    if (form.role === 'manager' && form.centerIds.length === 0) { setCreateError('Please assign at least one centre to the manager.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await createUserAsAdmin(form.email, form.password, {
        displayName: form.displayName,
        role: form.role,
        centerIds: form.role === 'manager' ? form.centerIds : [],
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(
        err.code === 'auth/email-already-in-use' ? 'This email is already registered.' :
        err.code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
        err.message
      );
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (u) => {
    setEditingUid(u.uid);
    const ids = Array.isArray(u.centerIds) && u.centerIds.length > 0 ? u.centerIds : (u.centerId ? [u.centerId] : []);
    setEditForm({ role: u.role || 'manager', centerIds: ids, displayName: u.displayName || '' });
  };

  const saveEdit = async (uid) => {
    setSaving(true);
    await setUserDoc(uid, editForm);
    setEditingUid(null);
    await load();
    setSaving(false);
  };

  const roleColor = (role) => role === 'admin'
    ? { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
    : { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>{users.length} user{users.length !== 1 ? 's' : ''}</div>
        <button onClick={() => { setShowForm(s => !s); setCreateError(''); }} style={btnPrimary}>
          {showForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Create new user</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Full name</label>
              <input style={inputStyle} placeholder="John Smith" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, centerId: '' }))}>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === 'manager' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Centres <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(select one or more)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, maxHeight: 180, overflowY: 'auto' }}>
                  {centres.map(c => {
                    const checked = form.centerIds.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: checked ? '#eff6ff' : '#fff', border: `1px solid ${checked ? '#bfdbfe' : '#f1f5f9'}` }}>
                        <input type="checkbox" checked={checked} onChange={() => setForm(f => ({ ...f, centerIds: checked ? f.centerIds.filter(id => id !== c.id) : [...f.centerIds, c.id] }))} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                        {c.location && <span style={{ fontSize: 11, color: '#94a3b8' }}>{c.location}</span>}
                      </label>
                    );
                  })}
                  {centres.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', padding: 8 }}>No centres available. Create one first.</div>}
                </div>
              </div>
            )}
          </div>
          {createError && <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 7, fontSize: 13, marginBottom: 12, border: '1px solid #fecaca' }}>{createError}</div>}
          <button type="submit" disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Creating…' : 'Create User'}
          </button>
        </form>
      )}

      {/* Users list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading users…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          No users yet. Create the first one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(u => {
            const rc = roleColor(u.role);
            const isEditing = editingUid === u.uid;
            return (
              <div key={u.uid} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#475569', flexShrink: 0 }}>
                  {(u.displayName || u.email || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input style={{ ...inputStyle, minWidth: 140 }} placeholder="Display name" value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} />
                      <select style={inputStyle} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value, centerIds: [] }))}>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      {editForm.role === 'manager' && centres.map(c => {
                        const checked = (editForm.centerIds || []).includes(c.id);
                        return (
                          <label key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: checked ? '#eff6ff' : '#f8fafc', border: `1px solid ${checked ? '#bfdbfe' : '#e2e8f0'}`, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={checked} onChange={() => setEditForm(f => ({ ...f, centerIds: checked ? f.centerIds.filter(id => id !== c.id) : [...(f.centerIds || []), c.id] }))} />
                            {c.name}
                          </label>
                        );
                      })}
                      <button onClick={() => saveEdit(u.uid)} disabled={saving} style={btnPrimary}>{saving ? '…' : 'Save'}</button>
                      <button onClick={() => setEditingUid(null)} style={btnGhost}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{u.displayName || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                        {u.role === 'manager' && <span style={{ marginLeft: 8 }}>· {centreNames(u)}</span>}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, flexShrink: 0 }}>
                      {u.role || 'manager'}
                    </span>
                    <button onClick={() => startEdit(u)} style={btnGhost}>Edit</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const btnPrimary = { padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const btnGhost   = { padding: '8px 14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' };

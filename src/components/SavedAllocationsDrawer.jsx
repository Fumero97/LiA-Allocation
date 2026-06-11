import { useState } from 'react';
import { useApp } from '../store';
import { exportAllocation } from '../utils/excel';
import { getAgeBand } from '../utils/ageBands';

const GROUP_COLORS = ['#6366f1','#f97316','#22c55e','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#06b6d4'];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ── Read-only rooming plan view for a saved allocation ── */
function SavedPlanModal({ alloc, onClose, onExport }) {
  const { accommodation, guests } = alloc;
  const groups = [...new Set(guests.map(g => g.group).filter(Boolean))].sort();
  const colorMap = {};
  groups.forEach((gr, i) => { colorMap[gr] = GROUP_COLORS[i % GROUP_COLORS.length]; });

  const assigned   = guests.filter(g => g.roomId);
  const unassigned = guests.filter(g => !g.roomId);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ alignItems:'flex-start', paddingTop:40 }}>
      <div className="modal" style={{ maxWidth:900, width:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ marginBottom:2 }}>{alloc.name}</h2>
            <span style={{ fontSize:12, color:'var(--gray-400)' }}>Saved on {formatDate(alloc.date)} · {accommodation.name}</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-success btn-sm" onClick={onExport}>⬇️ Export Excel</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{ padding:'10px 24px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)', display:'flex', gap:20, fontSize:13, color:'var(--gray-600)', flexWrap:'wrap' }}>
          <span><strong style={{ color:'var(--gray-900)' }}>{guests.length}</strong> guests</span>
          <span><strong style={{ color:'var(--success-600)' }}>{assigned.length}</strong> assigned</span>
          {unassigned.length > 0 && <span style={{ color:'var(--warning-500)' }}><strong>{unassigned.length}</strong> unassigned</span>}
          {groups.map(gr => (
            <span key={gr} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:colorMap[gr], display:'inline-block' }} />
              {gr}: {guests.filter(g => g.group===gr && g.roomId).length}/{guests.filter(g => g.group===gr).length}
            </span>
          ))}
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'16px 24px' }}>
          {accommodation.floors.map(floor => {
            const floorGuests = guests.filter(g => floor.corridors.some(c => c.rooms.some(r => r.id === g.roomId)));
            const ages = floorGuests.map(g => g.age).filter(a => a > 0);
            const ageRange = ages.length ? `${Math.min(...ages)}–${Math.max(...ages)}y` : null;
            return (
              <div key={floor.id} style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'linear-gradient(135deg, var(--primary-600), var(--primary-800))', borderRadius:'var(--radius-md)', marginBottom:10, color:'#fff' }}>
                  <span style={{ fontWeight:800, fontSize:14 }}>{floor.name || `Floor ${floor.number}`}</span>
                  {ageRange && <span style={{ fontSize:12, background:'rgba(255,255,255,.2)', padding:'2px 8px', borderRadius:99 }}>age {ageRange}</span>}
                  <span style={{ fontSize:12, marginLeft:'auto', opacity:.75 }}>{floorGuests.length} guests</span>
                </div>
                {floor.corridors.map(corridor => (
                  <div key={corridor.id} style={{ marginBottom:10, marginLeft:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                      Corridor {corridor.name}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {corridor.rooms.map(room => {
                        const rg = guests.filter(g => g.roomId === room.id);
                        const isUnavail = room.status === 'unavailable';
                        const hasM = rg.some(g => g.sex==='M'), hasF = rg.some(g => g.sex==='F');
                        let bg = '#fff', border = 'var(--gray-200)';
                        if (hasM && hasF)  { bg='var(--warning-50)'; border='var(--warning-400)'; }
                        else if (hasM)     { bg='#eff6ff'; border='#bfdbfe'; }
                        else if (hasF)     { bg='#fdf2f8'; border='#fbcfe8'; }
                        else if (isUnavail){ bg='var(--gray-50)'; border='var(--gray-300)'; }
                        return (
                          <div key={room.id} style={{ width:160, border:`1.5px solid ${border}`, borderRadius:'var(--radius-md)', background:bg, overflow:'hidden', opacity: isUnavail ? .65 : 1 }}>
                            <div style={{ padding:'5px 8px', borderBottom:`1px solid rgba(0,0,0,.06)`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:13, fontWeight:800, color:'var(--gray-800)' }}>{room.number}</span>
                              <span style={{ fontSize:11, color:'var(--gray-400)' }}>{isUnavail ? 'N/D' : `${rg.length}/${room.capacity}`}</span>
                            </div>
                            <div style={{ padding:'4px 6px 6px' }}>
                              {isUnavail ? (
                                <div style={{ fontSize:11, color:'var(--danger-400)', textAlign:'center', padding:'8px 0' }}>Unavailable</div>
                              ) : rg.length === 0 ? (
                                <div style={{ fontSize:11, color:'var(--gray-300)', textAlign:'center', padding:'8px 0', fontStyle:'italic' }}>Empty</div>
                              ) : rg.map(g => (
                                <div key={g.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 2px', borderRadius:4 }}>
                                  <div style={{
                                    width:20, height:20, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                                    fontSize:9, fontWeight:700,
                                    background: getAgeBand(g.age).bg,
                                    color: getAgeBand(g.age).color,
                                  }}>
                                    {(g.name[0]||'')+(g.surname[0]||'')}
                                  </div>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-800)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                      {g.name} {g.surname}
                                    </div>
                                    <div style={{ fontSize:10, color:'var(--gray-400)' }}>
                                      {g.age ? `${g.age}y` : '—'} · {g.sex}
                                    </div>
                                  </div>
                                  <span style={{ width:7, height:7, borderRadius:'50%', background:colorMap[g.group]||'var(--gray-300)', flexShrink:0 }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {unassigned.length > 0 && (
            <div style={{ background:'var(--warning-50)', border:'1px solid #fde68a', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#92400e', marginBottom:6 }}>⚠ Unassigned guests</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {unassigned.map(g => (
                  <span key={g.id} style={{ background:'#fff', border:'1px solid #fde68a', borderRadius:99, padding:'2px 10px', fontSize:12, color:'#92400e' }}>
                    {g.name} {g.surname} · {g.age}y
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DRAWER
══════════════════════════════════════════ */
export default function SavedAllocationsDrawer({ onClose }) {
  const { state, dispatch } = useApp();
  const { savedAllocations } = state;
  const [viewingAlloc, setViewingAlloc] = useState(null);
  const [newProjectConfirm, setNewProjectConfirm] = useState(false);

  const handleDelete = (id, name) => {
    if (window.confirm(`Delete allocation "${name}"?`)) {
      dispatch({ type: 'DELETE_ALLOCATION', id });
    }
  };

  const handleLoad = (id, name) => {
    if (window.confirm(`Load allocation "${name}" and overwrite the current workspace?`)) {
      dispatch({ type: 'LOAD_ALLOCATION', id });
      onClose();
    }
  };

  const handleNewProject = () => {
    dispatch({ type: 'NEW_PROJECT' });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer panel */}
      <div className="drawer-panel">
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize:16, marginBottom:2 }}>Saved allocations</h2>
            <span style={{ fontSize:12, color:'var(--gray-400)' }}>{savedAllocations.length} {savedAllocations.length===1?'allocation':'allocations'}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* New project button */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--gray-100)' }}>
          {!newProjectConfirm ? (
            <button className="btn btn-outline btn-sm" style={{ width:'100%', justifyContent:'center' }}
              onClick={() => setNewProjectConfirm(true)}>
              🆕 New project
            </button>
          ) : (
            <div style={{ background:'var(--warning-50)', border:'1px solid #fde68a', borderRadius:'var(--radius-md)', padding:'10px 12px' }}>
              <p style={{ fontSize:13, color:'#92400e', marginBottom:8 }}>
                Resets accommodation, guests and rules. Saved allocations will remain intact.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-danger btn-sm" onClick={handleNewProject}>Confirm reset</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setNewProjectConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="drawer-list">
          {savedAllocations.length === 0 ? (
            <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--gray-400)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💾</div>
              <p style={{ fontSize:13 }}>No saved allocations.</p>
              <p style={{ fontSize:12, marginTop:4 }}>Use "Save allocation" in the Allocation view.</p>
            </div>
          ) : savedAllocations.map(alloc => {
            const assigned = alloc.guests.filter(g => g.roomId).length;
            const total    = alloc.guests.length;
            const pct      = total > 0 ? Math.round(assigned/total*100) : 0;
            return (
              <div key={alloc.id} className="drawer-alloc-item">
                <div className="drawer-alloc-top">
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--gray-800)', marginBottom:2 }}>{alloc.name}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)' }}>
                      {formatDate(alloc.date)} · {alloc.accommodation.name}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger-outline btn-xs"
                    onClick={() => handleDelete(alloc.id, alloc.name)}
                    title="Delete"
                  >🗑</button>
                </div>

                {/* Progress */}
                <div style={{ marginTop:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--gray-500)', marginBottom:3 }}>
                    <span>{assigned}/{total} assigned</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height:4, background:'var(--gray-200)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background: pct===100?'var(--success-500)':'var(--primary-400)', borderRadius:4, transition:'width .3s' }} />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:6, marginTop:10 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex:1, justifyContent:'center' }}
                    onClick={() => setViewingAlloc(alloc)}>
                    👁 View
                  </button>
                  <button className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center' }}
                    onClick={() => handleLoad(alloc.id, alloc.name)}>
                    📂 Load
                  </button>
                  <button className="btn btn-success btn-sm"
                    onClick={() => exportAllocation(alloc.guests, alloc.accommodation)}>
                    ⬇️ Excel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewingAlloc && (
        <SavedPlanModal
          alloc={viewingAlloc}
          onClose={() => setViewingAlloc(null)}
          onExport={() => exportAllocation(viewingAlloc.guests, viewingAlloc.accommodation)}
        />
      )}
    </>
  );
}

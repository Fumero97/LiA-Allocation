import { useState } from 'react';
import { useApp } from '../../store';
import { exportAllocation } from '../../utils/excel';

/* ═══════════════════════════════════════════════
   EXPORT TAB
═══════════════════════════════════════════════ */
function GroupBar({ label, value, total, color }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-600)', marginBottom: 4 }}>
        <span>{label}</span>
        <span>{value} / {total}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--gray-200)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function ExportTab({ guests, accommodation }) {
  const assigned    = guests.filter(g => g.roomId);
  const unassigned  = guests.filter(g => !g.roomId);
  const allRooms    = accommodation.floors.flatMap(f => f.corridors.flatMap(c => c.rooms));
  const availRooms  = allRooms.filter(r => r.status !== 'unavailable');
  const occupiedRooms = availRooms.filter(r => guests.some(g => g.roomId === r.id));
  const totalBeds   = availRooms.reduce((s, r) => s + r.capacity, 0);
  const groups      = [...new Set(guests.map(g => g.group).filter(Boolean))];
  const groupStats  = groups.map(gr => ({
    name: gr,
    total: guests.filter(g => g.group === gr).length,
    assigned: guests.filter(g => g.group === gr && g.roomId).length,
  }));

  return (
    <>
      {/* Summary stats */}
      <div className="export-summary-grid" style={{ marginBottom: 24 }}>
        {[
          { value: guests.length, label: 'Total guests', color: 'var(--primary-600)' },
          { value: assigned.length, label: 'Assigned', color: 'var(--success-600)' },
          { value: unassigned.length, label: 'Unassigned', color: unassigned.length > 0 ? 'var(--warning-500)' : 'var(--success-500)' },
          { value: occupiedRooms.length, label: 'Occupied rooms', color: 'var(--gray-700)' },
        ].map(s => (
          <div key={s.label} className="summary-stat">
            <div className="value" style={{ color: s.color }}>{s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className="unassigned-warning" style={{ marginBottom: 24 }}>
          <span>⚠️</span>
          <div>
            <strong>{unassigned.length} unassigned guests:</strong>{' '}
            {unassigned.slice(0, 5).map(g => `${g.name} ${g.surname}`).join(', ')}
            {unassigned.length > 5 && ` and ${unassigned.length - 5} more…`}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 12 }}>Export allocation list</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            One row per guest with building and assigned room as the first columns.
          </p>
          <button
            className="btn btn-success"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 24px', fontSize: 15 }}
            onClick={() => exportAllocation(guests, accommodation)}
            disabled={guests.length === 0}
          >
            ⬇️ Download Excel
          </button>
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 12 }}>Summary</div>
          <div className="card" style={{ marginBottom: 12 }}>
            <GroupBar label="Occupied beds" value={assigned.length} total={totalBeds} color="var(--primary-500)" />
            <GroupBar label="Occupied rooms" value={occupiedRooms.length} total={availRooms.length} color="var(--success-500)" />
          </div>
          {groupStats.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>By group</div>
              {groupStats.map(g => (
                <GroupBar key={g.name} label={g.name} value={g.assigned} total={g.total} color="var(--accent-500)" />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function AuditLogTab({ auditLog, currentUser, onSetUser, onClearLog }) {
  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
           ' ' + d.toLocaleDateString('it-IT');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Operator Identity</h3>
          <button className="btn btn-danger-outline btn-sm" onClick={() => {
            if(window.confirm("Clear the entire history?")) onClearLog();
          }}>🗑 Clear Log</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>Changes made will be recorded under this name.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            className="form-input"
            value={currentUser}
            onChange={e => onSetUser(e.target.value)}
            placeholder="Your name..."
            style={{ maxWidth: 300 }}
          />
        </div>
      </div>

      <div className="audit-timeline">
        {auditLog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)', background: '#fff', borderRadius: 12, border: '1px dashed var(--gray-200)' }}>
            No changes recorded in this session.
          </div>
        ) : (
          auditLog.map((log) => (
            <div key={log.id} style={{ 
              display: 'flex', 
              gap: 16, 
              padding: '12px 16px', 
              background: '#fff', 
              border: '1px solid var(--gray-100)', 
              borderRadius: 8, 
              marginBottom: 8,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: 4, 
                position: 'absolute', 
                left: 0, top: 0, bottom: 0, 
                background: log.type === 'auto_allocate' ? 'var(--primary-400)' : 
                            log.type === 'swap' ? 'var(--warning-400)' : 
                            log.type === 'unassignment' ? 'var(--danger-400)' : 'var(--success-400)' 
              }} />
              
              <div style={{ minWidth: 100, fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>
                {formatDate(log.timestamp)}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 2 }}>
                  {log.guestName ? `${log.guestName} · ` : ''} 
                  <span style={{ 
                    fontSize: 10, 
                    textTransform: 'uppercase', 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    background: 'var(--gray-50)',
                    color: 'var(--gray-500)'
                  }}>{log.type}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{log.details}</div>
              </div>
              
              <div style={{ fontSize: 11, color: 'var(--primary-600)', fontWeight: 700, alignSelf: 'center', background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 99 }}>
                 👤 {log.user}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ROOMING PLAN TAB
═══════════════════════════════════════════════ */
const GROUP_COLORS = [
  '#6366f1','#f97316','#22c55e','#ec4899','#14b8a6',
  '#f59e0b','#8b5cf6','#06b6d4','#84cc16','#ef4444',
];

function ageRange(guestList) {
  const ages = guestList.map(g => g.age).filter(a => a > 0);
  if (ages.length === 0) return null;
  return { min: Math.min(...ages), max: Math.max(...ages) };
}

function AgeRangePill({ guests, style }) {
  const r = ageRange(guests);
  if (!r) return null;
  return (
    <span className="age-range-pill" style={style}>
      {r.min === r.max ? `${r.min}y` : `${r.min}–${r.max}y`}
    </span>
  );
}

function GuestRow({ guest, groupColorMap, isFirst, roomNumber }) {
  const color = groupColorMap[guest.group] || 'var(--gray-400)';
  return (
    <tr className="rp-guest-row">
      <td style={{ textAlign: 'center', width: 60, borderRight: '1px solid var(--gray-200)', background: 'var(--gray-50)', fontWeight: 800, padding: '2px 4px' }}>
        {isFirst ? roomNumber : ''}
      </td>
      <td style={{ borderLeft: `5px solid ${guest.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)'}`, padding: '2px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
           <div className={`rp-guest-avatar ${guest.sex === 'M' ? 'male' : 'female'}`} style={{ width: 18, height: 18, fontSize: 8 }}>
             {(guest.name?.[0] || '') + (guest.surname?.[0] || '')}
           </div>
           <span style={{ fontWeight: 600, fontSize: 12 }}>{guest.name} {guest.surname}</span>
           {guest.role && (
             <span className="badge badge-primary" style={{ fontSize: 9, padding: '0px 4px', height: '14px', lineHeight: '14px' }}>
               {guest.role}
             </span>
           )}
        </div>
      </td>
      <td style={{ fontSize: 11, padding: '2px 8px' }}>{guest.sex === 'M' ? 'Male' : 'Female'}</td>
      <td style={{ fontSize: 11, padding: '2px 8px' }}>{guest.age ? `${guest.age}y` : '—'}</td>
      <td style={{ padding: '2px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
          <span className="rp-group-dot" style={{ background: color }} />
          {guest.group}
        </div>
      </td>
      <td style={{ fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>{guest.arrivalDate || '—'}</td>
      <td style={{ fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>{guest.departureDate || '—'}</td>
    </tr>
  );
}

function RoomRows({ room, roomGuests, groupColorMap }) {
  const isUnavail = room.status === 'unavailable';
  const isEmpty = roomGuests.length === 0;

  if (isUnavail) {
    return (
      <tbody style={{ borderBottom: '2px solid var(--gray-200)', opacity: 0.6 }}>
        <tr>
          <td style={{ textAlign: 'center', width: 60, background: 'var(--gray-100)', fontWeight: 800, padding: '2px 4px' }}>{room.number}</td>
          <td colSpan={6} style={{ padding: '2px 16px', color: 'var(--danger-500)', fontStyle: 'italic', fontSize: 12 }}>
            N/A {room.unavailableUntil === 'permanent' ? '(perm.)' : room.unavailableUntil ? `until ${room.unavailableUntil}` : ''}
          </td>
        </tr>
      </tbody>
    );
  }

  if (isEmpty) {
    return (
      <tbody style={{ borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
        <tr>
          <td style={{ textAlign: 'center', width: 60, fontWeight: 800, padding: '2px 4px' }}>{room.number}</td>
          <td colSpan={6} style={{ padding: '2px 16px', color: 'var(--gray-400)', fontSize: 11 }}>— Empty —</td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody style={{ borderBottom: '1px solid var(--gray-200)' }}>
      {roomGuests.map((g, i) => (
        <GuestRow 
          key={g.id} 
          guest={g} 
          groupColorMap={groupColorMap} 
          isFirst={i === 0}
          roomNumber={room.number}
        />
      ))}
    </tbody>
  );
}

function RoomingPlanTab({ guests, accommodation }) {
  const [filterGroup, setFilterGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(true);
  const [showUnavail, setShowUnavail] = useState(false);

  const groups = [...new Set(guests.map(g => g.group).filter(Boolean))].sort();
  const groupColorMap = {};
  groups.forEach((gr, i) => { groupColorMap[gr] = GROUP_COLORS[i % GROUP_COLORS.length]; });

  // Filter guests for the plan
  const visibleGuests = guests.filter(g => {
    if (filterGroup !== 'all' && g.group !== filterGroup) return false;
    
    if (search) {
      const s = search.toLowerCase();
      const matchName = `${g.name} ${g.surname}`.toLowerCase().includes(s);
      const matchGroup = (g.group || '').toLowerCase().includes(s);
      const matchAge = g.age?.toString().includes(s);
      const matchSex = (g.sex === 'M' ? 'male' : 'female').includes(s);
      
      if (!matchName && !matchGroup && !matchAge && !matchSex) return false;
    }
    
    return true;
  });

  const getRoomGuests = roomId =>
    visibleGuests.filter(g => g.roomId === roomId);

  if (accommodation.floors.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🏨</span>
        <h3>No structure configured</h3>
        <p>Go back to the first step to configure the structure.</p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="rp-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input 
              type="text" 
              className="pool-search" 
              placeholder="🔍 Search by name, group, age or sex (e.g. 'GL', '22', 'M')..."
              style={{ fontSize: 13, width: '100%', padding: '8px 12px 8px 32px' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="toggle-wrap" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              <span className="toggle">
                <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
                <span className="toggle-track" /><span className="toggle-thumb" />
              </span>
              Empty
            </label>

            <label className="toggle-wrap" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              <span className="toggle">
                <input type="checkbox" checked={showUnavail} onChange={e => setShowUnavail(e.target.checked)} />
                <span className="toggle-track" /><span className="toggle-thumb" />
              </span>
              N/A
            </label>

            <div style={{ width: 1, height: 20, background: 'var(--gray-200)', margin: '0 4px' }} />

            <button className="btn btn-outline btn-sm" onClick={() => window.print()} title="Print to PDF">
              🖨️ PDF
            </button>

            <button className="btn btn-ghost btn-sm" onClick={() => {
              navigator.clipboard.writeText(window.location.href + '?viewonly=true');
              alert('View-Only link copied to clipboard!');
            }} title="Copy view link">
              🔗 Share
            </button>
          </div>
        </div>

        {/* Group legend */}
        <div className="rp-legend" style={{ margin: 0, padding: '4px 0', overflowX: 'auto' }}>
          {groups.map(gr => (
            <span
              key={gr}
              className={`rp-legend-item ${filterGroup === gr ? 'active' : ''}`}
              onClick={() => setFilterGroup(filterGroup === gr ? 'all' : gr)}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              <span className="rp-legend-dot" style={{ background: groupColorMap[gr], width: 6, height: 6 }} />
              {gr}
            </span>
          ))}
        </div>
      </div>

      {/* Plan */}
      <div className="rp-plan">
        {accommodation.floors.map(floor => {
          const floorGuests = visibleGuests.filter(g =>
            floor.corridors.some(c => c.rooms.some(r => r.id === g.roomId))
          );
          const floorAgeR = ageRange(floorGuests);

          return (
            <div key={floor.id} className="rp-floor-section">
              <div className="rp-floor-header">
                <span className="rp-floor-title">Floor {floor.number}</span>
                {floorAgeR && (
                  <span className="age-range-pill large">
                    Age range: {floorAgeR.min === floorAgeR.max ? `${floorAgeR.min}` : `${floorAgeR.min}–${floorAgeR.max}`} years
                  </span>
                )}
                <span className="rp-floor-count">
                  {floorGuests.length} guests
                </span>
              </div>

              {floor.corridors.map(corridor => {
                const corrGuests = visibleGuests.filter(g =>
                  corridor.rooms.some(r => r.id === g.roomId)
                );
                const corrAgeR = ageRange(corrGuests);

                return (
                  <div key={corridor.id} className="rp-corridor-section" style={{ marginBottom: 32 }}>
                    <div className="rp-corridor-header" style={{ marginBottom: 10, background: 'var(--gray-100)', padding: '6px 16px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                      <span className="rp-corridor-label" style={{ fontWeight: 800, color: 'var(--gray-700)' }}>Corridor {corridor.name}</span>
                      {corrAgeR && (
                        <AgeRangePill guests={corrGuests} style={{ marginLeft: 12 }} />
                      )}
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto', fontWeight: 600 }}>
                        {corrGuests.length} assigned guests
                      </span>
                    </div>

                    <table className="guest-table mini-headers">
                      <thead>
                        <tr>
                          <th style={{ width: 60, textAlign: 'center', padding: '2px 4px', fontSize: 10 }}>Room</th>
                          <th style={{ padding: '2px 8px', fontSize: 10 }}>Guest</th>
                          <th style={{ padding: '2px 8px', fontSize: 10 }}>Sex</th>
                          <th style={{ padding: '2px 8px', fontSize: 10 }}>Age</th>
                          <th style={{ padding: '2px 8px', fontSize: 10 }}>Group</th>
                          <th style={{ padding: '2px 8px', fontSize: 10 }}>Arrival</th>
                          <th style={{ padding: '2px 8px', fontSize: 10 }}>Departure</th>
                        </tr>
                      </thead>
                      {corridor.rooms.map(room => {
                        const rg = getRoomGuests(room.id);
                        if (!showUnavail && room.status === 'unavailable') return null;
                        if (!showEmpty && rg.length === 0 && room.status !== 'unavailable') return null;
                        return (
                          <RoomRows
                            key={room.id}
                            room={room}
                            roomGuests={rg}
                            groupColorMap={groupColorMap}
                          />
                        );
                      })}
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function StepExport() {
  const { state, dispatch } = useApp();
  const { guests, accommodation, auditLog, currentUser } = state;
  const [tab, setTab] = useState('export');

  return (
    <div className="step-container wide">
      <div className="step-header">
        <h1>Export & Rooming Plan</h1>
        <p>Review the allocation plan or export to Excel.</p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'export' ? 'active' : ''}`}
          onClick={() => setTab('export')}
        >
          📤 Export Excel
        </button>
        <button
          className={`tab-btn ${tab === 'plan' ? 'active' : ''}`}
          onClick={() => setTab('plan')}
        >
          🗺️ Rooming Plan
        </button>
        <button
          className={`tab-btn ${tab === 'audit' ? 'active' : ''}`}
          onClick={() => setTab('audit')}
        >
          📜 History
          {auditLog.length > 0 && <span className="badge badge-primary" style={{ marginLeft: 6 }}>{auditLog.length}</span>}
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        {tab === 'export' && <ExportTab guests={guests} accommodation={accommodation} />}
        {tab === 'plan'   && <RoomingPlanTab guests={guests} accommodation={accommodation} />}
        {tab === 'audit'  && (
          <AuditLogTab 
            auditLog={auditLog} 
            currentUser={currentUser} 
            onSetUser={(val) => dispatch({ type: 'SET_USER', payload: val })}
            onClearLog={() => dispatch({ type: 'CLEAR_AUDIT_LOG' })}
          />
        )}
      </div>
    </div>
  );
}

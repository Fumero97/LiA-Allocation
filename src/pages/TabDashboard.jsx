import { useMemo } from 'react';
import { useApp } from '../store';
import { computeIntakes } from './groupUtils';

const parseDMY = (str) => {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str);
  const p = str.split('/');
  if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  return null;
};
const fmtShort = (str) => {
  const d = parseDMY(str);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export default function TabDashboard() {
  const { state, dispatch } = useApp();

  const allGuests = useMemo(() => {
    const out = [];
    state.savedGuestLists.forEach(l => l.guests.forEach(g => out.push(g)));
    return out;
  }, [state.savedGuestLists]);

  const totalGuests = allGuests.length;
  const maleCount   = allGuests.filter(g => g.sex === 'M').length;
  const femaleCount = allGuests.filter(g => g.sex === 'F').length;

  // ── Pending actions ───────────────────────────────────────
  const pending = useMemo(() => {
    const items = [];
    state.savedGroups.forEach(group => {
      const guests = allGuests.filter(g => g.group === group.name);
      const unreviewed = guests.filter(g => Number(g.age) >= 18 && !g.role);
      if (unreviewed.length) items.push({ type: 'roles', groupId: group.id, groupName: group.name, count: unreviewed.length });
      if (!group.struttura) items.push({ type: 'structure', groupId: group.id, groupName: group.name });
      if (!group.agente)    items.push({ type: 'agent',     groupId: group.id, groupName: group.name });
      if (!group.arrivalDate && !group.departureDate) items.push({ type: 'dates', groupId: group.id, groupName: group.name });
    });
    return items;
  }, [state.savedGroups, allGuests]);

  // ── Intake timeline ───────────────────────────────────────
  const intakesWithGroups = useMemo(() => {
    return state.savedIntakes.map(intake => ({
      ...intake,
      groups: state.savedGroups.filter(g => {
        const guests = allGuests.filter(ag => ag.group === g.name);
        if (!guests.length || !intake.startDate || !intake.endDate) return false;
        const s = new Date(intake.startDate); s.setDate(s.getDate() + 1); s.setHours(0,0,0,0);
        const e = new Date(intake.endDate); e.setHours(23,59,59,999);
        return guests.some(ag => {
          const arr = parseDMY(ag.arrivalDate), dep = parseDMY(ag.departureDate);
          return arr && dep && arr <= e && dep >= s;
        });
      }),
    }));
  }, [state.savedIntakes, state.savedGroups, allGuests]);

  const timelineRange = useMemo(() => {
    const dates = state.savedIntakes.flatMap(i => [parseDMY(i.startDate), parseDMY(i.endDate)]).filter(Boolean);
    if (!dates.length) return null;
    return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
  }, [state.savedIntakes]);

  const timelinePct = (dateStr) => {
    if (!timelineRange) return 0;
    const d = parseDMY(dateStr);
    if (!d) return 0;
    const total = timelineRange.max - timelineRange.min;
    return total ? ((d - timelineRange.min) / total) * 100 : 0;
  };

  // ── Flight summary ────────────────────────────────────────
  const flights = useMemo(() => {
    const arrMap = {}, depMap = {};
    allGuests.forEach(g => {
      const addTo = (map, airport, date, time) => {
        if (!airport && !date) return;
        const k = `${airport || '—'}|${date || '—'}|${time || '—'}`;
        if (!map[k]) map[k] = { airport: airport || '—', date: date || '', time: time || '', count: 0 };
        map[k].count++;
      };
      addTo(arrMap, g.arrivalAirport,   g.arrivalDate,   g.arrivalTime);
      addTo(depMap, g.departureAirport, g.departureDate, g.departureTime);
    });
    const sort = (map) => Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return { arrivals: sort(arrMap), departures: sort(depMap) };
  }, [allGuests]);

  const goTo = (tab) => dispatch({ type: 'SET_TAB', payload: tab });

  const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#65a30d','#e11d48'];

  return (
    <div className="saas-tab-content" style={{ background: 'var(--gray-50)' }}>
      <div className="saas-header" style={{ background: '#fff' }}>
        <h1>Dashboard</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {[
            { label: 'Groups',     value: state.savedGroups.length,        sub: `${state.savedGroups.filter(g => g.struttura).length} with structure`, icon: '🏷️', tab: 'gruppi' },
            { label: 'Guests',     value: totalGuests, sub: `${maleCount}♂  ${femaleCount}♀`, icon: '👤', tab: 'ospiti' },
            { label: 'Intakes',    value: state.savedIntakes.length,       sub: `${state.savedAccommodations.length} structure${state.savedAccommodations.length !== 1 ? 's' : ''}`, icon: '📅', tab: 'settings' },
            { label: 'Allocations',value: state.savedAllocations.length,   sub: 'saved projects',     icon: '🗺️', tab: 'allocazione' },
          ].map(c => (
            <div key={c.label} onClick={() => goTo(c.tab)}
              style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--gray-200)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-900)', lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginTop: 4 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── Pending actions ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Pending Actions</span>
              {pending.length > 0 && <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{pending.length}</span>}
            </div>
            {pending.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>✅ All good — nothing pending.</div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {pending.map((item, i) => (
                  <div key={i} onClick={() => goTo('gruppi')}
                    style={{ padding: '10px 18px', borderBottom: '1px solid var(--gray-50)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>
                      {item.type === 'roles' ? '⚠️' : item.type === 'structure' ? '🏫' : item.type === 'agent' ? '👤' : '📅'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>{item.groupName}</span>
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>
                        {item.type === 'roles'      ? `${item.count} guest${item.count !== 1 ? 's' : ''} aged 18+ without role` :
                         item.type === 'structure'   ? 'No structure assigned' :
                         item.type === 'agent'       ? 'No agent assigned' :
                                                       'No dates set'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--primary-500)' }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Groups at a glance ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Groups</span>
              <button className="btn btn-ghost btn-xs" onClick={() => goTo('gruppi')}>View all →</button>
            </div>
            {state.savedGroups.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No groups yet.</div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {state.savedGroups.map((group, gi) => {
                  const guests = allGuests.filter(g => g.group === group.name);
                  const staff  = guests.filter(g => g.role === 'GL' || g.role === 'LiA').length;
                  const stud   = guests.length - staff;
                  const unrev  = guests.filter(g => Number(g.age) >= 18 && !g.role).length;
                  const intakes = computeIntakes(group.name, allGuests, state.savedIntakes);
                  return (
                    <div key={group.id} onClick={() => goTo('gruppi')} style={{ padding: '10px 18px', borderBottom: '1px solid var(--gray-50)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[gi % COLORS.length], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>
                          {fmtShort(group.arrivalDate)} → {fmtShort(group.departureDate)}
                          {group.struttura && <span style={{ marginLeft: 6 }}>· {group.struttura}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-700)' }}>
                          {guests.length}{staff > 0 && <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 11 }}> | {stud}+{staff}</span>}
                        </div>
                        {unrev > 0 && <div style={{ fontSize: 10, color: '#b45309', fontWeight: 600 }}>⚠ {unrev} unreviewed</div>}
                        {intakes.length > 0 && <div style={{ fontSize: 10, color: '#7c3aed' }}>{intakes.map(i => i.name).join(', ')}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Intake timeline ── */}
        {state.savedIntakes.length > 0 && timelineRange && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Intake Timeline</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Date labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginBottom: -4 }}>
                <span>{fmtShort(timelineRange.min.toISOString())}</span>
                <span>{fmtShort(timelineRange.max.toISOString())}</span>
              </div>
              {intakesWithGroups.map((intake, ii) => {
                const left  = timelinePct(intake.startDate);
                const right = timelinePct(intake.endDate);
                const width = Math.max(right - left, 1);
                const color = COLORS[ii % COLORS.length];
                return (
                  <div key={intake.id}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{intake.name}</div>
                    <div style={{ position: 'relative', height: 28, background: 'var(--gray-50)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--gray-100)' }}>
                      <div style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, background: color, opacity: 0.15, borderRadius: 4 }} />
                      <div style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 3, bottom: 3, background: color, opacity: 0.8, borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                        <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {fmtShort(intake.startDate)} → {fmtShort(intake.endDate)}
                        </span>
                      </div>
                    </div>
                    {intake.groups.length > 0 && (
                      <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {intake.groups.map(g => (
                          <span key={g.id} style={{ fontSize: 10, background: `${color}18`, color, border: `1px solid ${color}44`, padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{g.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Flight summary ── */}
        {(flights.arrivals.length > 0 || flights.departures.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              { label: '✈ Arrivals',   list: flights.arrivals },
              { label: '✈ Departures', list: flights.departures },
            ].map(({ label, list }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                </div>
                {list.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No flights assigned.</div>
                ) : (
                  <div>
                    {list.map((f, i) => (
                      <div key={i} style={{ padding: '10px 18px', borderBottom: '1px solid var(--gray-50)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-800)' }}>{f.airport}</span>
                          {f.date && <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>{f.date}</span>}
                          {f.time && <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 6 }}>{f.time}</span>}
                        </div>
                        <span style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 10 }}>{f.count} guests</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

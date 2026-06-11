import { useState } from 'react';
import { useApp } from '../store';
import { parseItalianDateForBooking } from '../lib/dateUtils';

export default function TabBooking() {
  const { state } = useApp();
  const [selectedIds, setSelectedIds] = useState(
    state.selectedAccommodationId
      ? [state.selectedAccommodationId]
      : state.savedAccommodations.map(a => a.id)
  );
  const [globalSearch, setGlobalSearch] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [viewMode, setViewMode] = useState('rooms');

  const accommodations = state.savedAccommodations.filter(a => selectedIds.includes(a.id));

  const relevantAllocations = state.savedAllocations.filter(a =>
    selectedIds.includes(a.accommodationId) || (accommodations.some(acc => acc.name === a.accommodation?.name))
  );

  const allStays = [];
  relevantAllocations.forEach(alloc => {
    (alloc.guests || []).forEach(g => {
      if (g.roomId) {
        const gStart = g.arrivalDate ? parseItalianDateForBooking(g.arrivalDate) : (alloc.startDate || '');
        const gEnd = g.departureDate ? parseItalianDateForBooking(g.departureDate) : (alloc.endDate || '');
        allStays.push({ ...g, stayStart: gStart, stayEnd: gEnd, projName: alloc.name || 'Unnamed' });
      }
    });
  });

  const allRooms = accommodations.flatMap(acc =>
    acc.data.floors.flatMap(f =>
      f.corridors.flatMap(c =>
        c.rooms.map(r => ({ ...r, floorNum: f.number, accName: acc.name }))
      )
    )
  );

  const groupAgenteMap = {};
  state.savedGroups.forEach(g => { groupAgenteMap[g.name] = g.agente || ''; });

  const groupRowsMap = {};
  allStays.forEach(s => {
    const grp = s.group || '(no group)';
    if (!groupRowsMap[grp]) groupRowsMap[grp] = { name: grp, agente: groupAgenteMap[grp] || '', guests: [], minStart: null, maxEnd: null };
    groupRowsMap[grp].guests.push(s);
    const start = new Date(s.stayStart);
    const end = new Date(s.stayEnd);
    if (!isNaN(start) && (!groupRowsMap[grp].minStart || start < groupRowsMap[grp].minStart)) groupRowsMap[grp].minStart = start;
    if (!isNaN(end) && (!groupRowsMap[grp].maxEnd || end > groupRowsMap[grp].maxEnd)) groupRowsMap[grp].maxEnd = end;
  });
  const groupRows = Object.values(groupRowsMap).sort((a, b) => a.name.localeCompare(b.name));

  const allStops = allStays.flatMap(s => [new Date(s.stayStart), new Date(s.stayEnd)]).filter(d => !isNaN(d.getTime()));
  let minDate = allStops.length > 0 ? new Date(Math.min(...allStops)) : new Date();
  let maxDate = allStops.length > 0 ? new Date(Math.max(...allStops)) : new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000);

  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 5);

  if (startDateFilter) minDate = new Date(startDateFilter);
  if (endDateFilter) maxDate = new Date(endDateFilter);

  const dates = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const getDailyTotal = (day) => {
    return allStays.filter(s => {
      const start = new Date(s.stayStart);
      const end = new Date(s.stayEnd);
      const d = new Date(day); d.setHours(0,0,0,0);
      const s1 = new Date(start); s1.setHours(0,0,0,0);
      const e1 = new Date(end); e1.setHours(0,0,0,0);
      return d >= s1 && d <= e1;
    }).length;
  };

  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

  if (state.savedAccommodations.length === 0) return <div style={{ padding: 40, textAlign: 'center' }}>Create a structure before viewing the timeline.</div>;

  return (
    <div className="saas-tab-content timeline-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--gray-50)' }}>
      <div className="tab-sticky-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-200)', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Timeline Logistica</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setViewMode('rooms')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: viewMode === 'rooms' ? 'var(--primary-600)' : '#fff', color: viewMode === 'rooms' ? '#fff' : 'var(--gray-600)' }}>Rooms</button>
              <button onClick={() => setViewMode('groups')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderLeft: '1px solid var(--gray-200)', cursor: 'pointer', background: viewMode === 'groups' ? 'var(--primary-600)' : '#fff', color: viewMode === 'groups' ? '#fff' : 'var(--gray-600)' }}>Groups</button>
            </div>
            <div className="search-box">
              <input type="text" className="form-input mini" placeholder="Filter guest..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} style={{ width: 220 }} />
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="date" className="form-input mini" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} />
              <span style={{ color: 'var(--gray-300)' }}>/</span>
              <input type="date" className="form-input mini" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Select Structures:</span>
          {state.savedAccommodations.map(a => (
            <label key={a.id} className="chip-selector" style={{ background: selectedIds.includes(a.id) ? 'var(--primary-600)' : '#fff', color: selectedIds.includes(a.id) ? '#fff' : 'var(--gray-600)' }}>
              <input type="checkbox" style={{ display: 'none' }} checked={selectedIds.includes(a.id)} onChange={e => {
                if (e.target.checked) setSelectedIds([...selectedIds, a.id]);
                else setSelectedIds(selectedIds.filter(id => id !== a.id));
              }} />
              {a.name}
            </label>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <div className="gantt-wrapper" style={{ minWidth: 'fit-content', background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--gray-200)' }}>
          <div className="gantt-header-row" style={{ display: 'grid', gridTemplateColumns: `260px repeat(${dates.length}, 80px)`, borderBottom: '2px solid var(--gray-100)', position: 'sticky', top: 0, zIndex: 100, background: '#fff' }}>
            <div className="gantt-label-cell" style={{ padding: '24px', fontWeight: 800, borderRight: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
              {viewMode === 'groups' ? 'Group' : 'Structure / Room'}
            </div>
            {dates.map((d, i) => {
              const t = getDailyTotal(d);
              return (
                <div key={i} className="gantt-date-cell" style={{ borderRight: '1px solid var(--gray-100)', textAlign: 'center', padding: '12px 0', background: isWeekend(d) ? 'var(--gray-50)' : 'transparent' }}>
                  <div style={{ fontSize: 9, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 2 }}>{d.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{d.getDate()}/{d.getMonth() + 1}</div>
                  <div style={{ marginTop: 8, padding: '2px 4px', background: 'var(--primary-100)', color: 'var(--primary-700)', border: '1px solid var(--primary-200)', borderRadius: 4, fontWeight: 700, fontSize: 10, margin: '8px 4px 0' }}>
                    {t} 👤
                  </div>
                </div>
              );
            })}
          </div>

          <div className="gantt-body">
            {viewMode === 'rooms' ? allRooms.map(room => {
              const roomStays = allStays.filter(s => s.roomId === room.id);
              return (
                <div key={`${room.accName}-${room.id}`} className="gantt-row" style={{ display: 'grid', gridTemplateColumns: `260px repeat(${dates.length}, 80px)`, borderBottom: '1px solid var(--gray-50)', height: 60, position: 'relative' }}>
                  <div className="gantt-label-cell" style={{ padding: '10px 20px', borderRight: '1px solid var(--gray-200)', background: '#fff', position: 'sticky', left: 0, zIndex: 50, borderBottom: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-700)' }}>Room {room.name || room.number}</div>
                    <div style={{ fontSize: 9, color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 700 }}>{room.accName} • Floor {room.floorNum}</div>
                  </div>
                  {dates.map((d, i) => (
                    <div key={i} className="gantt-cell-bg" style={{ borderRight: '1px solid var(--gray-100)', background: isWeekend(d) ? 'var(--gray-50)' : 'transparent' }} />
                  ))}
                  <div className="stays-layer" style={{ position: 'absolute', top: 0, left: 260, right: 0, bottom: 0, pointerEvents: 'none' }}>
                    {roomStays.map(s => {
                      const start = new Date(s.stayStart); start.setHours(0,0,0,0);
                      const end = new Date(s.stayEnd); end.setHours(0,0,0,0);
                      const startIdx = dates.findIndex(d => d.getTime() === start.getTime());
                      const endIdx = dates.findIndex(d => d.getTime() === end.getTime());
                      if (startIdx === -1 && endIdx === -1) {
                        const firstDate = dates[0].getTime(); const lastDate = dates[dates.length-1].getTime();
                        if (start.getTime() > lastDate || end.getTime() < firstDate) return null;
                      }
                      const actualStart = Math.max(0, startIdx !== -1 ? startIdx : dates.findIndex(d => d > start));
                      const actualEnd = endIdx !== -1 ? endIdx : dates.length - 1;
                      if (actualStart > actualEnd || actualStart === -1) return null;
                      const isMatch = globalSearch ? (s.name + ' ' + s.surname).toLowerCase().includes(globalSearch.toLowerCase()) : true;
                      return (
                        <div key={s.id} style={{ position: 'absolute', left: actualStart * 80 + 4, width: (actualEnd - actualStart + 1) * 80 - 8, top: 8, height: 44, background: '#fff', border: '1px solid var(--gray-200)', borderLeft: `4px solid ${s.sex === 'M' ? '#3b82f6' : '#ec4899'}`, borderRadius: 6, padding: '4px 8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: isMatch ? 1 : 0.15, zIndex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name} {s.surname}</div>
                          <div style={{ fontSize: 9, color: 'var(--gray-500)', display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>{s.group || '—'}</span>
                            {s.role && <span style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '0 4px', borderRadius: 3, fontSize: 8 }}>{s.role}</span>}
                            {Number(s.age) < 12 && <span style={{ background: '#fef3c7', color: '#92400e', padding: '0 4px', borderRadius: 3, fontSize: 8, fontWeight: 700 }}>⚠ &lt;12</span>}
                            <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{s.age}a</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }) : groupRows.map(grp => {
              const isMatch = globalSearch ? grp.name.toLowerCase().includes(globalSearch.toLowerCase()) || grp.guests.some(s => (s.name + ' ' + s.surname).toLowerCase().includes(globalSearch.toLowerCase())) : true;
              const start = grp.minStart ? new Date(grp.minStart) : null;
              const end = grp.maxEnd ? new Date(grp.maxEnd) : null;
              if (start) start.setHours(0,0,0,0);
              if (end) end.setHours(0,0,0,0);
              const startIdx = start ? dates.findIndex(d => d.getTime() === start.getTime()) : -1;
              const endIdx = end ? dates.findIndex(d => d.getTime() === end.getTime()) : -1;
              const actualStart = start ? Math.max(0, startIdx !== -1 ? startIdx : dates.findIndex(d => d > start)) : -1;
              const actualEnd = end ? (endIdx !== -1 ? endIdx : dates.length - 1) : -1;
              const hasBar = actualStart !== -1 && actualEnd !== -1 && actualStart <= actualEnd;
              return (
                <div key={grp.name} className="gantt-row" style={{ display: 'grid', gridTemplateColumns: `260px repeat(${dates.length}, 80px)`, borderBottom: '1px solid var(--gray-100)', height: 56, position: 'relative', opacity: isMatch ? 1 : 0.25 }}>
                  <div className="gantt-label-cell" style={{ padding: '8px 20px', borderRight: '1px solid var(--gray-200)', background: '#fff', position: 'sticky', left: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grp.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', display: 'flex', gap: 6 }}>
                      <span>{grp.guests.length} guests</span>
                      {grp.agente && <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>· {grp.agente}</span>}
                    </div>
                  </div>
                  {dates.map((d, i) => (
                    <div key={i} style={{ borderRight: '1px solid var(--gray-100)', background: isWeekend(d) ? 'var(--gray-50)' : 'transparent' }} />
                  ))}
                  {hasBar && (
                    <div style={{ position: 'absolute', top: 10, left: 260 + actualStart * 80 + 4, width: (actualEnd - actualStart + 1) * 80 - 8, height: 36, background: 'var(--primary-100)', border: '1px solid var(--primary-300)', borderLeft: '4px solid var(--primary-500)', borderRadius: 6, padding: '4px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--primary-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grp.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--primary-600)', display: 'flex', gap: 6 }}>
                        <span>{grp.guests.length} guests</span>
                        {grp.agente && <span style={{ fontWeight: 600 }}>· {grp.agente}</span>}
                        <span>· {start?.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} → {end?.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

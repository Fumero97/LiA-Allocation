import { useState, useMemo, useEffect, Fragment } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useApp } from '../../store';
import { checkViolations } from '../../utils/allocation';
import { AGE_BANDS, getAgeBand } from '../../utils/ageBands';
import AllocationChat from '../AllocationChat';
import AllocationDiffView from '../AllocationDiffView';
import { applyOperationsToStore } from '../../lib/allocationChat';

const ADULT_AGE = 18;

function AdultBadge() {
  return <span className="adult-badge">18+</span>;
}

/* Helper: returns roommate id array handling both old (roommateId) and new (roommateIds) field */
function getRoommateIds(g) {
  if (Array.isArray(g.roommateIds) && g.roommateIds.length > 0) return g.roommateIds;
  if (g.roommateId) return [g.roommateId];
  return [];
}

/* ── Guest chip in pool panel ── */
function PoolChip({ guest, index, isSelected, isSwapTarget, onSelect }) {
  const isAdult = guest.age >= ADULT_AGE;
  const band = getAgeBand(guest.age);
  return (
    <Draggable draggableId={guest.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`guest-chip ${snapshot.isDragging ? 'dragging' : ''} ${isSelected ? 'chip-selected' : ''} ${isSwapTarget ? 'chip-swap-target' : ''}`}
          style={{ borderLeft: `4px solid ${guest.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)'}` }}
          onClick={e => { e.stopPropagation(); onSelect(guest.id); }}
          title={isSelected ? 'Selected — click a guest to swap' : isSwapTarget ? 'Click to swap with the selected guest' : 'Click to select'}
        >
          <div className="chip-avatar" style={{ background: band.bg, color: band.color }}>
            {(guest.name[0] || '').toUpperCase()}{(guest.surname[0] || '').toUpperCase()}
          </div>
          <div className="chip-info">
            <div className="chip-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
               {guest.name} {guest.surname}
               {getRoommateIds(guest).length > 0 && <span style={{ fontSize: 12 }} title="Has a linked companion">🔗</span>}
            </div>
            <div className="chip-meta">
              <span className="alloc-age-dot" style={{ display:'inline-block', width: 8, height: 8, borderRadius: '50%', background: band.bg, border: `1px solid ${band.border}`, marginRight: 4 }} title={`Età: ${guest.age}y`} />
              <span className={isAdult ? 'adult-age' : ''}>{guest.age}y</span>
              {isAdult && <AdultBadge />}
              {guest.role && <span className="badge badge-primary" style={{ fontSize: 9, padding: '1px 3px', marginLeft: 4 }}>{guest.role}</span>}
              {Number(guest.age) < 12 && <span className="badge" style={{ fontSize: 9, padding: '1px 3px', marginLeft: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>⚠ &lt;12</span>}
              {' · '}{guest.group || '—'}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

/* ── Edit guest modal ── */
function EditGuestModal({ guest, onSave, onClose }) {
  const [form, setForm] = useState({ ...guest });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const medicalStr = Array.isArray(form.medical) ? form.medical.join(', ') : (form.medical || '');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2>✏️ Edit guest</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Surname</label>
            <input className="form-input" value={form.surname || ''} onChange={e => set('surname', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Sex</label>
            <select className="form-input" value={form.sex || 'M'} onChange={e => set('sex', e.target.value)}>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Age</label>
            <input className="form-input" type="number" min="0" max="120" value={form.age || ''} onChange={e => set('age', parseInt(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">Date of birth</label>
            <input className="form-input" value={form.dob || ''} placeholder="DD/MM/YYYY" onChange={e => set('dob', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Group</label>
            <input className="form-input" value={form.group || ''} onChange={e => set('group', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Role
              {(form.age || 0) < 18 && <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>(18+ only)</span>}
            </label>
            <select
              className="form-input"
              value={form.role || ''}
              disabled={(form.age || 0) < 18}
              onChange={e => set('role', e.target.value)}
            >
              <option value="">— None</option>
              <option value="GL">GL – Group Leader</option>
              <option value="LiA">LiA – Leader in Action</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Medical / Allergies</label>
            <input className="form-input" value={medicalStr} onChange={e => set('medical', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Private notes</label>
            <input className="form-input" value={form.privateNotes || ''} onChange={e => set('privateNotes', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Arrival date</label>
            <input className="form-input" value={form.arrivalDate || ''} placeholder="DD/MM/YYYY" onChange={e => set('arrivalDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Arrival time</label>
            <input className="form-input" value={form.arrivalTime || ''} placeholder="HH:MM" onChange={e => set('arrivalTime', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Departure date</label>
            <input className="form-input" value={form.departureDate || ''} placeholder="DD/MM/YYYY" onChange={e => set('departureDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Departure time</label>
            <input className="form-input" value={form.departureTime || ''} placeholder="HH:MM" onChange={e => set('departureTime', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave({ ...form, fullName: `${form.name || ''} ${form.surname || ''}`.trim() })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Guest row inside room ── */
function AllocGuestRow({ guest, index, isSelected, isSwapTarget, onGuestClick, onEdit, roomCellText, roomWarning, allGuests, roomIndex, isDimmed }) {
  const [showRoommateInfo, setShowRoommateInfo] = useState(false);
  const isAdult = guest.age >= ADULT_AGE;
  const band = getAgeBand(guest.age);
  return (
    <Draggable draggableId={guest.id} index={index}>
      {(provided, snapshot) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`${snapshot.isDragging ? 'dragging' : ''} ${isSelected ? 'swap-selected' : ''} ${isSwapTarget ? 'swap-target' : ''}`}
          style={{
            ...provided.draggableProps.style,
            cursor: isDimmed ? 'default' : 'grab',
            opacity: isDimmed ? 0.28 : 1,
            transition: 'opacity 0.15s',
            background: snapshot.isDragging ? '#fff'
              : isSelected ? 'var(--primary-50)'
              : isSwapTarget ? '#fdf4ff'
              : (guest.linkedRoommateIds?.length > 0 || getRoommateIds(guest).length > 0)
                ? guest.isWithRoommate ? 'rgba(34,197,94,0.08)'
                : guest.isNearRoommate ? 'rgba(59,130,246,0.08)'
                : guest.isCorridorRoommate ? 'rgba(234,179,8,0.08)'
                : 'rgba(239,68,68,0.06)'
              : 'inherit'
          }}
          title={isSelected ? 'Selected — click another guest to swap' : isSwapTarget ? 'Click to swap' : 'Drag to move'}
          onClick={e => { e.stopPropagation(); onGuestClick(guest.id); }}
        >
          {roomCellText !== undefined ? (
            <td style={{ fontWeight: 800, textAlign: 'center', background: 'var(--gray-100)', borderRight: '1px solid var(--gray-200)', width: 80 }}>
              {roomCellText}
              {roomWarning && <span title={roomWarning} style={{ marginLeft: 4, cursor: 'help', fontSize: 11 }}>⚠️</span>}
            </td>
          ) : <td style={{ background: 'var(--gray-50)', borderRight: '1px solid var(--gray-200)', width: 80 }}></td>}
          <td style={{ 
            borderLeft: `5px solid ${guest.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)'}`, 
            fontWeight: 600,
            position: 'relative',
            overflow: 'visible'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {guest.name} {guest.surname}
              {guest.role && <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 4px' }}>{guest.role}</span>}
              {Number(guest.age) < 12 && <span className="badge" style={{ fontSize: 10, padding: '2px 4px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>⚠ &lt;12</span>}
              {(guest.linkedRoommateIds?.length > 0 || getRoommateIds(guest).length > 0) && (() => {
                const linkedIds = guest.linkedRoommateIds?.length > 0 ? guest.linkedRoommateIds : getRoommateIds(guest);
                const isWith = guest.isWithRoommate;
                const isNear = guest.isNearRoommate;
                const isCorridor = guest.isCorridorRoommate;
                return (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {/* Same room badge */}
                    {isWith && (
                      <span
                        onClick={e => { e.stopPropagation(); e.preventDefault(); setShowRoommateInfo(v => !v); }}
                        style={{ background: '#16a34a', color: '#fff', fontSize: 11, padding: '3px 9px', borderRadius: 5, fontWeight: 700, cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                        title="Companion in the same room — click for details"
                      >
                        🔗 Together
                      </span>
                    )}
                    {/* Adjacent room badge */}
                    {!isWith && isNear && (
                      <span
                        onClick={e => { e.stopPropagation(); e.preventDefault(); setShowRoommateInfo(v => !v); }}
                        style={{ background: '#2563eb', color: '#fff', fontSize: 11, padding: '3px 9px', borderRadius: 5, fontWeight: 700, cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                        title="Companion in adjacent room — click for details"
                      >
                        🔗 Adjacent
                      </span>
                    )}
                    {/* Same corridor badge */}
                    {!isWith && !isNear && isCorridor && (
                      <span
                        onClick={e => { e.stopPropagation(); e.preventDefault(); setShowRoommateInfo(v => !v); }}
                        style={{ background: '#d97706', color: '#fff', fontSize: 11, padding: '3px 9px', borderRadius: 5, fontWeight: 700, cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                        title="Companion in the same corridor — click for details"
                      >
                        🔗 Nearby
                      </span>
                    )}
                    {/* Separated badge */}
                    {!isWith && !isNear && !isCorridor && (
                      <span
                        onClick={e => { e.stopPropagation(); e.preventDefault(); setShowRoommateInfo(v => !v); }}
                        style={{ background: '#dc2626', color: '#fff', fontSize: 11, padding: '3px 9px', borderRadius: 5, fontWeight: 700, cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                        title="Companion not nearby — click for details"
                      >
                        🔗 Separated
                      </span>
                    )}
                    {/* Popover with roommate details */}
                    {showRoommateInfo && (
                      <div
                        className="roommate-popover"
                        style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 9999, background: '#fff', border: '1px solid var(--primary-200)', borderRadius: 8, padding: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', width: 230, pointerEvents: 'auto', textAlign: 'left' }}
                      >
                        <div style={{ fontSize: 9, color: 'var(--primary-400)', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8, letterSpacing: '0.05em' }}>Travel With</div>
                        {linkedIds.map(rmId => {
                          const rm = allGuests?.find(rg => rg.id === rmId);
                          if (!rm) return null;
                          const rmRoom = rm.roomId && roomIndex?.[rm.roomId];
                          const sameRoom = rm.roomId === guest.roomId;
                          const adjacent = !sameRoom && rmRoom && roomIndex?.[guest.roomId] &&
                            rmRoom.corridorId === roomIndex[guest.roomId].corridorId &&
                            Math.abs(rmRoom.roomIndex - roomIndex[guest.roomId].roomIndex) === 1;
                          return (
                            <div key={rmId} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--gray-100)' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {rm.name} {rm.surname}
                                <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>({rm.sex === 'M' ? 'M' : 'F'}, {rm.age}a)</span>
                              </div>
                              <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                                color: sameRoom ? 'var(--success-600)' : adjacent ? 'var(--primary-600)' : rm.roomId ? 'var(--danger-600)' : 'var(--gray-500)'
                              }}>
                                {sameRoom ? <><span>✅</span> Same room</> :
                                 adjacent ? <><span>↔️</span> Adjacent room</> :
                                 rm.roomId ? <><span>⚠️</span>{rmRoom ? `Room ${rmRoom.number} (F${rmRoom.floorNumber})` : 'Assigned elsewhere'}</> :
                                 <><span>⭕</span> Not yet assigned</>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </td>
          <td style={{ fontSize: 13 }}>{guest.sex === 'M' ? 'Male' : 'Female'}</td>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: band.bg, border: `1px solid ${band.border}`, display: 'inline-block' }} />
              <span style={{ fontSize: 13 }}>{guest.age ? `${guest.age}y` : '—'}</span>
              {isAdult && <AdultBadge />}
            </div>
          </td>
          <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{guest.group || '—'}</td>
          <td style={{ fontSize: 12, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{guest.arrivalDate || '—'}</td>
          <td style={{ fontSize: 12, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{guest.departureDate || '—'}</td>
          <td style={{ textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--gray-400)' }}>
            <span>⠿</span>
            <button
              className="btn btn-ghost btn-xs"
              style={{ marginLeft: 4, padding: '2px 5px', fontSize: 12, lineHeight: 1 }}
              title="Edit guest"
              onClick={e => { e.stopPropagation(); onEdit(guest); }}
            >✏️</button>
          </td>
        </tr>
      )}
    </Draggable>
  );
}

/* ── Room cell ── */
function RoomCell({ room, roomGuests, selectedId, isCompatible, isHighlighted, onRoomClick, onGuestClick, onEditGuest, allGuests, roomIndex, filteredGuestIds }) {
  const isUnavail = room.status === 'unavailable';
  const students  = roomGuests.filter(g => g.role !== 'GL' && g.role !== 'LiA');
  const hasMale   = students.some(g => g.sex === 'M');
  const hasFemale = students.some(g => g.sex === 'F');
  const hasMixed  = hasMale && hasFemale;
  
  // Per lo sfondo di tbody in caso misto o altro
  let tBg = '';
  if (hasMixed) tBg = 'var(--warning-50)';
  if (isHighlighted) tBg = 'var(--yellow-100)';

  return (
    <Droppable droppableId={`room:${room.id}`} isDropDisabled={isUnavail}>
      {(provided, snapshot) => (
        <tbody
          ref={provided.innerRef}
          {...provided.droppableProps}
          style={{
            background: snapshot.isDraggingOver ? 'var(--primary-50)' : tBg,
            borderBottom: '2px solid var(--gray-300)',
            opacity: isUnavail ? 0.6 : 1,
            cursor: isCompatible ? 'pointer' : 'default'
          }}
          onClick={isCompatible ? () => onRoomClick(room.id) : undefined}
        >
          {isUnavail ? (
            <tr>
              <td style={{ fontWeight: 800, textAlign: 'center', background: 'var(--gray-100)', borderRight: '1px solid var(--gray-200)', width: 80 }}>{room.number}</td>
              <td colSpan={5} style={{ padding: '4px 16px', color: 'var(--danger-500)', fontWeight: 600 }}>Unavailable</td>
            </tr>
          ) : (
            <>
              {roomGuests.map((g, i) => (
                <AllocGuestRow
                  key={g.id}
                  guest={g}
                  index={i}
                  isSelected={g.id === selectedId}
                  isSwapTarget={!!selectedId && g.id !== selectedId}
                  onGuestClick={onGuestClick}
                  onEdit={onEditGuest}
                  roomCellText={i === 0 ? room.number : undefined}
                  roomWarning={i === 0 && hasMixed ? 'Mixed room: students of both sexes' : undefined}
                  allGuests={allGuests}
                  roomIndex={roomIndex}
                  isDimmed={filteredGuestIds !== null && !filteredGuestIds.has(g.id)}
                />
              ))}
              {Array.from({ length: Math.max(0, room.capacity - roomGuests.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                   {(i === 0 && roomGuests.length === 0) ? (
                    <td style={{ fontWeight: 800, textAlign: 'center', background: 'var(--gray-100)', borderRight: '1px solid var(--gray-200)', width: 80 }}>{room.number}</td>
                  ) : <td style={{ background: 'var(--gray-50)', borderRight: '1px solid var(--gray-200)', width: 80 }}></td>}
                  <td colSpan={5} style={{ padding: '3px 16px', color: 'var(--gray-400)', fontStyle: 'italic', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}>
                    {snapshot.isDraggingOver && i === 0
                      ? '⬇ drop here'
                      : isCompatible && i === 0
                      ? '→ click to assign'
                      : 'Empty spot'}
                  </td>
                </tr>
              ))}
            </>
          )}
          {provided.placeholder}
        </tbody>
      )}
    </Droppable>
  );
}

/* ── Save allocation modal ── */
function SaveModal({ onSave, onClose, initialName = '' }) {
  const [name, setName] = useState(initialName);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>💾 Save allocation</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Allocation name</label>
            <input
              className="form-input"
              placeholder="e.g. Summer 2025 — Group A"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
              autoFocus
            />
            <p className="form-hint">You can review and export it at any time.</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Violation banner ── */
function ViolationBanner({ violations, onDismiss }) {
  if (!violations?.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#92400e', color: '#fff', padding: '10px 20px', borderRadius: 10,
      fontSize: 13, fontWeight: 600, zIndex: 500, display: 'flex', alignItems: 'center',
      gap: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)', maxWidth: 480,
    }}>
      <span>⚠️</span>
      <span>{violations.join(' · ')}</span>
      <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 13 }}>
        OK
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function StepAllocation() {
  const { state, dispatch } = useApp();
  const { accommodation, guests, rules, undoStack = [], redoStack = [] } = state;

  const [search, setSearch]           = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [sexFilter, setSexFilter]     = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');

  const [violations, setViolations]       = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFlash, setSavedFlash]       = useState('');
  const [selectedId, setSelectedId]       = useState(null);
  const [editingGuest, setEditingGuest]   = useState(null);
  const [twPanelOpen, setTwPanelOpen]     = useState(true);
  const [collapsedCorridors, setCollapsedCorridors] = useState(new Set());
  const [chatOpen, setChatOpen]           = useState(false);
  const [proposal, setProposal]           = useState(null);

  const confirmProposal = () => {
    if (!proposal) return;
    applyOperationsToStore(proposal.operations, dispatch, guests);
    setProposal(null);
    setSavedFlash('Modifiche dell’assistente applicate');
    setTimeout(() => setSavedFlash(''), 3000);
  };

  const toggleCorridor = id => setCollapsedCorridors(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') setSelectedId(null);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  const groups = [...new Set(guests.map(g => g.group).filter(Boolean))];

  const roomIndex = useMemo(() => {
    const idx = {};
    accommodation.floors.forEach((f, fIdx) =>
      f.corridors.forEach(c =>
        c.rooms.forEach((r, rIdx) => {
          idx[r.id] = { ...r, floorNumber: f.number, floorIndex: fIdx, corridorId: c.id, corridorName: c.name, roomIndex: rIdx };
        })
      )
    );
    return idx;
  }, [accommodation]);

  const decoratedGuests = useMemo(() => {
    // Build a reverse lookup: guestId → set of guestIds that link TO this guest
    // This handles old unidirectional links where only the source has roommateIds set
    const reverseLinks = {};
    guests.forEach(g => {
      getRoommateIds(g).forEach(rmId => {
        if (!reverseLinks[rmId]) reverseLinks[rmId] = new Set();
        reverseLinks[rmId].add(g.id);
      });
    });

    return guests.map(g => {
      // Collect all linked IDs: both explicit (g → others) and reverse (others → g)
      const explicitIds = getRoommateIds(g);
      const reverseIds = reverseLinks[g.id] ? [...reverseLinks[g.id]] : [];
      const allLinkedIds = [...new Set([...explicitIds, ...reverseIds])];

      if (allLinkedIds.length === 0 || !g.roomId) {
        return { ...g, linkedRoommateIds: allLinkedIds, isWithRoommate: false, isNearRoommate: false, isCorridorRoommate: false };
      }

      // Determine worst-case proximity across ALL linked roommates.
      // Order (best → worst): same > adjacent > corridor > separated/unassigned
      const rank = { same: 0, adjacent: 1, corridor: 2, separated: 3 };
      let worst = -1; // -1 means no assigned roommate found yet

      for (const rmId of allLinkedIds) {
        const roommate = guests.find(other => other.id === rmId);
        if (!roommate || !roommate.roomId) {
          // Unassigned roommate counts as separated
          worst = Math.max(worst, rank.separated);
          continue;
        }
        let cat;
        if (roommate.roomId === g.roomId) {
          cat = rank.same;
        } else {
          const r1 = roomIndex[g.roomId];
          const r2 = roomIndex[roommate.roomId];
          if (r1 && r2 && r1.corridorId === r2.corridorId) {
            cat = Math.abs(r1.roomIndex - r2.roomIndex) === 1 ? rank.adjacent : rank.corridor;
          } else {
            cat = rank.separated;
          }
        }
        worst = Math.max(worst, cat);
      }

      const isWithRoommate    = worst === rank.same;
      const isNearRoommate    = worst === rank.adjacent;
      const isCorridorRoommate = worst === rank.corridor;
      return { ...g, linkedRoommateIds: allLinkedIds, isWithRoommate, isNearRoommate, isCorridorRoommate };
    });
  }, [guests, roomIndex]);

  const travelWithViolations = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const g of decoratedGuests) {
      if (!g.roomId) continue;
      const linkedIds = g.linkedRoommateIds?.length > 0 ? g.linkedRoommateIds : getRoommateIds(g);
      for (const rmId of linkedIds) {
        const key = [g.id, rmId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const rm = decoratedGuests.find(x => x.id === rmId);
        if (!rm || !rm.roomId) continue;
        const inSameRoom = g.roomId === rm.roomId;
        const r1 = roomIndex[g.roomId];
        const r2 = roomIndex[rm.roomId];
        const isAdjacent = r1 && r2 && r1.corridorId === r2.corridorId && Math.abs(r1.roomIndex - r2.roomIndex) === 1;
        const isSameCorridor = r1 && r2 && r1.corridorId === r2.corridorId;
        if (!inSameRoom && !isAdjacent && !isSameCorridor) {
          result.push({ gA: g, gB: rm, r1, r2 });
        }
      }
    }
    return result;
  }, [decoratedGuests, roomIndex]);

  const selectedGuest  = selectedId ? decoratedGuests.find(g => g.id === selectedId) : null;
  const selectedIsPool = selectedGuest ? selectedGuest.roomId == null : false;

  const compatibleRoomIds = useMemo(() => {
    if (!selectedId) return new Set();
    const ids = new Set();
    accommodation.floors.forEach(floor =>
      floor.corridors.forEach(corridor =>
        corridor.rooms.forEach(room => {
          if (room.status === 'unavailable') return;
          const occupants = decoratedGuests.filter(g => g.roomId === room.id);
          if (selectedIsPool) {
            // Pool guest: suggest only completely empty rooms (existing behavior)
            if (occupants.length > 0) return;
          } else {
            // Assigned guest: any room with a free spot, excluding their current room
            if (room.id === selectedGuest?.roomId) return;
            if (occupants.length >= room.capacity) return;
          }
          ids.add(room.id);
        })
      )
    );
    return ids;
  }, [selectedId, selectedIsPool, selectedGuest, decoratedGuests, accommodation]);

  // Guests matching all active filters — null means no filter active
  const filteredGuestIds = useMemo(() => {
    const hasSearch = globalSearch.trim();
    const hasSex    = sexFilter !== 'all';
    const hasGroup  = groupFilter !== 'all';
    if (!hasSearch && !hasSex && !hasGroup) return null;
    return new Set(decoratedGuests.filter(g => {
      if (hasSex && g.sex !== sexFilter) return false;
      if (hasGroup && g.group !== groupFilter) return false;
      if (hasSearch) {
        const q = globalSearch.trim().toLowerCase();
        if (!`${g.name} ${g.surname} ${g.group || ''} ${g.externalId || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    }).map(g => g.id));
  }, [decoratedGuests, globalSearch, sexFilter, groupFilter]);

  const unassigned = decoratedGuests.filter(g => !g.roomId).filter(g => {
    if (search && !`${g.name} ${g.surname} ${g.group}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filteredGuestIds !== null && !filteredGuestIds.has(g.id)) return false;
    return true;
  });


  const assignedCount = decoratedGuests.filter(g => g.roomId).length;

  const handleGuestClick = (clickedId) => {
    if (!selectedId) {
      setSelectedId(clickedId);
      return;
    }
    if (selectedId === clickedId) {
      setSelectedId(null);
      return;
    }
    dispatch({ type: 'SWAP_GUESTS', guestIdA: selectedId, guestIdB: clickedId });
    setSelectedId(null);
  };

  const handleRoomClick = (roomId) => {
    if (!selectedId) return;
    dispatch({ type: 'ASSIGN_ROOM', guestId: selectedId, roomId });
    setSelectedId(null);
  };

  const handleDragEnd = ({ source, destination, draggableId }) => {
    setSelectedId(null);
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const guest = decoratedGuests.find(g => g.id === draggableId);
    if (!guest) return;

    if (destination.droppableId === 'pool') {
      dispatch({ type: 'UNASSIGN_GUEST', guestId: draggableId });
      return;
    }

    const roomId = destination.droppableId.replace('room:', '');
    const room = roomIndex[roomId];
    if (!room) return;

    const occupants = decoratedGuests.filter(g => g.id !== draggableId && g.roomId === roomId);
    if (occupants.length >= room.capacity) {
      setViolations([`Room ${room.number} is full (${room.capacity} spots)`]);
      return;
    }

    const warns = checkViolations(guest, room, decoratedGuests, accommodation, rules);
    if (warns.length > 0) setViolations(warns);

    const linkRule = rules.find(r => r.id === 'roommate-link' && r.enabled);
    if (linkRule) {
      (guest.linkedRoommateIds?.length > 0 ? guest.linkedRoommateIds : getRoommateIds(guest)).forEach(rmId => {
        const roommate = decoratedGuests.find(r => r.id === rmId);
        if (roommate && roommate.roomId && roommate.roomId !== roomId) {
          setViolations(prev => [...prev, `Warning: you are separating ${guest.name} from their linked companion ${roommate.name}`]);
        }
      });
    }

    dispatch({ type: 'ASSIGN_ROOM', guestId: draggableId, roomId });
  };

  const handleSave = (name) => {
    dispatch({ type: 'SAVE_ALLOCATION', name });
    setShowSaveModal(false);
    const label = state.editingAllocationId ? 'Changes saved' : `"${name}" saved`;
    setSavedFlash(`${label}!`);
    setTimeout(() => setSavedFlash(''), 3000);
  };

  const currentProjectName = state.savedAllocations.find(a => a.id === state.editingAllocationId)?.name || '';

  const triggerSave = () => {
    if (state.editingAllocationId) {
      // Direct save if already exists
      handleSave(currentProjectName);
    } else {
      setShowSaveModal(true);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="allocation-shell">

        <div className="allocation-toolbar">
          <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'AUTO_ALLOCATE' })}>
            ⚡ Auto-assign
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => { if (window.confirm('Remove all assignments?')) dispatch({ type: 'CLEAR_ALLOCATIONS' }); }}>
            🗑 Clear
          </button>

          <button className={`btn btn-sm ${chatOpen ? 'btn-primary' : 'btn-outline'}`} onClick={() => setChatOpen(v => !v)} title="Assistente AI per l'allocazione">
            🤖 Assistente
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
          >↩ Undo</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
          >↪ Redo</button>

          <div style={{ width: 1, height: 22, background: 'var(--gray-200)', margin: '0 4px', flexShrink: 0 }} />

          <select className="form-select" style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }} value={sexFilter} onChange={e => setSexFilter(e.target.value)}>
            <option value="all">Sex</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>

          <select className="form-select" style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }} value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            <option value="all">Groups</option>
            {groups.map(gr => <option key={gr} value={gr}>{gr}</option>)}
          </select>

          <select className="form-select" style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }} value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
            <option value="all">Floors</option>
            {accommodation.floors.map(f => <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>)}
          </select>

          <div style={{ position: 'relative', flex: 1, minWidth: 150, maxWidth: 300 }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="🔍 Search guest..."
              style={{ fontSize: 13, padding: '5px 10px 5px 30px' }}
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          </div>


          <div className="alloc-stat">
            <strong>{assignedCount}</strong>
            <span style={{ color: 'var(--gray-400)' }}>/{decoratedGuests.length} assigned</span>
            {assignedCount < decoratedGuests.length && (
              <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                {decoratedGuests.length - assignedCount} missing
              </span>
            )}
            {assignedCount === decoratedGuests.length && decoratedGuests.length > 0 && (
              <span className="badge badge-success" style={{ marginLeft: 8 }}>Complete ✓</span>
            )}
          </div>

          {selectedId && (
            <div className="swap-hint">
              {selectedIsPool
                ? <>Click a <span style={{ color: '#16a34a', fontWeight: 700 }}>green</span> room to assign <strong>{selectedGuest?.name}</strong></>
                : <>Click a guest to swap, or a <span style={{ color: '#16a34a', fontWeight: 700 }}>green</span> room to move <strong>{selectedGuest?.name}</strong></>
              }
              <button className="btn btn-ghost btn-xs" onClick={() => setSelectedId(null)} style={{ marginLeft: 8 }}>✕ ESC</button>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {savedFlash && (
              <span style={{ fontSize: 13, color: 'var(--success-600)', fontWeight: 600 }}>
                ✓ {savedFlash}
              </span>
            )}
            <button className="btn btn-success btn-sm" onClick={triggerSave}>
              💾 {state.editingAllocationId ? 'Update changes' : 'Save allocation'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_STEP', payload: 4 })}>
              Export →
            </button>
          </div>
        </div>

        {travelWithViolations.length > 0 && (
          <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', padding: '8px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
                ⚠️ {travelWithViolations.length} {travelWithViolations.length === 1 ? 'non-consecutive Travel With pair' : 'non-consecutive Travel With pairs'}
              </span>
              <button
                className="btn btn-ghost btn-xs"
                style={{ color: '#92400e', fontSize: 12 }}
                onClick={() => setTwPanelOpen(v => !v)}
              >
                {twPanelOpen ? '▲ Hide' : '▼ Show'}
              </button>
            </div>
            {twPanelOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 8 }}>
                {travelWithViolations.map(({ gA, gB, r1, r2 }) => (
                  <div key={`${gA.id}-${gB.id}`} style={{ fontSize: 12, color: '#78350f', display: 'flex', alignItems: 'center', gap: 5, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '3px 8px' }}>
                    <span style={{ fontWeight: 600 }}>{gA.name} {gA.surname}</span>
                    <span style={{ opacity: 0.6, fontSize: 11 }}>#{r1?.number ?? '?'}</span>
                    <span style={{ color: '#d97706', fontWeight: 700 }}>↔</span>
                    <span style={{ fontWeight: 600 }}>{gB.name} {gB.surname}</span>
                    <span style={{ opacity: 0.6, fontSize: 11 }}>#{r2?.number ?? '?'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="allocation-body">
          {proposal ? (
            <AllocationDiffView
              accommodation={accommodation}
              currentGuests={guests}
              proposedGuests={proposal.proposedGuests}
              summary={proposal.summary}
              chatOpen={chatOpen}
              onConfirm={confirmProposal}
              onDiscard={() => setProposal(null)}
            />
          ) : (
          <>
            {decoratedGuests.some(g => !g.roomId) && (
                <aside className="guest-pool-panel">
                  <div className="pool-header">
                    <h3>Unassigned ({unassigned.length})</h3>
                    <input className="pool-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                    <div className="age-band-legend">
                      {AGE_BANDS.map(b => (
                        <span key={b.label} className="age-band-chip" style={{ background: b.bg, color: b.color, borderColor: b.border }}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Droppable droppableId="pool">
                    {provided => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="pool-list">
                        {unassigned.length === 0 ? (
                          <div className="pool-empty">
                            {decoratedGuests.filter(g => !g.roomId).length === 0 ? '✅ All assigned!' : 'No results'}
                          </div>
                        ) : unassigned.map((g, i) => (
                          <PoolChip
                            key={g.id}
                            guest={g}
                            index={i}
                            isSelected={g.id === selectedId}
                            isSwapTarget={selectedId && !selectedIsPool && g.id !== selectedId}
                            onSelect={handleGuestClick}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </aside>
              )}

              <div className="floor-plan">
                {accommodation.floors.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">🏨</span>
                    <h3>No structure configured</h3>
                    <p>Go to the first step to configure floors and rooms.</p>
                  </div>
                ) : accommodation.floors
                    .filter(f => floorFilter === 'all' || f.id === floorFilter)
                    .map(floor => (
                  <div key={floor.id} className="floor-section">
                    <div className="floor-section-header">
                      {floor.name || `Floor ${floor.number}`}
                    </div>
                    {floor.corridors.map(corridor => {
                      const corrGuests = decoratedGuests.filter(g => corridor.rooms.some(r => r.id === g.roomId));
                      const corrStudentsOnly = corrGuests.filter(g => g.role !== 'GL' && g.role !== 'LiA');
                      const sexes = [...new Set(corrStudentsOnly.map(g => g.sex))];
                      const sexBadge = sexes.length === 2 ? '⚠️' : sexes[0] === 'M' ? '♂' : sexes[0] === 'F' ? '♀' : '';
                      const ageGuests = corrGuests.filter(g => g.role !== 'GL' && g.role !== 'LiA' && g.age > 0);
                      const ages = ageGuests.map(g => Number(g.age));
                      const ageRange = ages.length > 0
                        ? (Math.min(...ages) === Math.max(...ages) ? `${Math.min(...ages)}y` : `${Math.min(...ages)}–${Math.max(...ages)}y`)
                        : null;
                      const isCollapsed = collapsedCorridors.has(corridor.id);
                      const matchCount  = filteredGuestIds ? corrGuests.filter(g => filteredGuestIds.has(g.id)).length : corrGuests.length;
                      return (
                        <div key={corridor.id} className="corridor-group-alloc" style={{ marginBottom: 20 }}>
                          <div className="corridor-header-mini" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCorridor(corridor.id)}>
                            <span style={{ fontSize: 12, color: 'var(--gray-400)', marginRight: 4, flexShrink: 0 }}>{isCollapsed ? '▶' : '▼'}</span>
                            <span className="corridor-tag">Corridor {corridor.name}</span>
                            {sexBadge && <span className="sex-badge-inline" title={sexes.length === 2 ? 'Mixed corridor: students of both sexes' : sexes[0] === 'M' ? 'Male corridor' : 'Female corridor'}>{sexBadge}</span>}
                            {ageRange && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 6px' }}>{ageRange}</span>}
                            {filteredGuestIds && <span style={{ fontSize: 11, color: 'var(--primary-600)', fontWeight: 600, marginLeft: 4 }}>{matchCount} found</span>}
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)' }}>{corrGuests.length}/{corridor.rooms.reduce((s, r) => s + (r.capacity || 0), 0)} spots</span>
                          </div>
                          {!isCollapsed && (
                          <div className="rooms-row" style={{ overflowX: 'auto' }}>
                            <table className="guest-table alloc-compact-table align-fixed" style={{ background: '#fff', margin: 0, border: '1px solid var(--gray-200)', tableLayout: 'fixed', width: '100%' }}>
                              <colgroup>
                                <col style={{ width: 60 }} />
                                <col />
                                <col style={{ width: 70 }} />
                                <col style={{ width: 80 }} />
                                <col style={{ width: 110 }} />
                                <col style={{ width: 100 }} />
                                <col style={{ width: 100 }} />
                                <col style={{ width: 60 }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'center', background: 'var(--gray-100)', borderRight: '1px solid var(--gray-200)' }}>Room</th>
                                  <th>Guest</th>
                                  <th>Sex</th>
                                  <th>Age</th>
                                  <th>Group</th>
                                  <th>Arrival</th>
                                  <th>Departure</th>
                                  <th></th>
                                </tr>
                              </thead>
                              {corridor.rooms.map(room => (
                                <RoomCell
                                  key={room.id}
                                  room={room}
                                  roomGuests={decoratedGuests.filter(g => g.roomId === room.id)}
                                  selectedId={selectedId}
                                  isCompatible={compatibleRoomIds.has(room.id)}
                                  isHighlighted={filteredGuestIds && decoratedGuests.filter(g => g.roomId === room.id).some(g => filteredGuestIds.has(g.id))}
                                  onRoomClick={handleRoomClick}
                                  onGuestClick={handleGuestClick}
                                  onEditGuest={setEditingGuest}
                                  allGuests={decoratedGuests}
                                  roomIndex={roomIndex}
                                  filteredGuestIds={filteredGuestIds}
                                />
                              ))}
                            </table>
                          </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
          </>
          )}
        </div>

        {chatOpen && (
          <AllocationChat
            state={state}
            onProposal={setProposal}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>

      {showSaveModal && (
        <SaveModal
          onSave={handleSave}
          onClose={() => setShowSaveModal(false)}
          initialName={currentProjectName}
        />
      )}
      {editingGuest && (
        <EditGuestModal
          guest={editingGuest}
          onSave={updated => { dispatch({ type: 'UPDATE_GUEST', guest: updated }); setEditingGuest(null); }}
          onClose={() => setEditingGuest(null)}
        />
      )}
      <ViolationBanner violations={violations} onDismiss={() => setViolations([])} />
    </DragDropContext>
  );
}

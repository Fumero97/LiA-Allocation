import { useState } from 'react';
import { useApp } from '../store';
import { GuestModal, EMPTY_GUEST } from '../components/steps/StepGuests';

export default function TabListImprover({ onClose }) {
  const { state, dispatch } = useApp();
  const [selectedListId] = useState('');
  const [activeTool, setActiveTool] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [aiStep, setAiStep] = useState('idle');
  const [editId, setEditId] = useState(null);
  const [rowSelections] = useState({});
  const [rowSearch, setRowSearch] = useState({});
  const [allergySearch, setAllergySearch] = useState({});
  const [medicalSearch, setMedicalSearch] = useState({});

  const effectiveListId = state.listImproverTarget || selectedListId;
  const list = state.savedGuestLists.find(l => l.id === effectiveListId);

  const curVer = list?.version || 1;
  const lastVer = list?.improverLastVersion || 0;
  const hasVersionAlert = list && curVer > lastVer;

  const handleModalSave = (updated) => {
    const nextGuests = list.guests.map(g => g.id === updated.id ? updated : g);
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
    setEditId(null);
  };

  const addMedicalTag = (guestId, tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const nextGuests = list.guests.map(g => {
      if (g.id !== guestId) return g;
      const existing = Array.isArray(g.medical) ? g.medical : [];
      if (existing.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return g;
      const updates = { medical: [...existing, trimmed] };
      if (typeof g.medical === 'string' && g.medical && !g.medicalRaw) {
        updates.medicalRaw = g.medical;
      }
      return { ...g, ...updates };
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
    setMedicalSearch(prev => ({ ...prev, [guestId]: '' }));
  };

  const removeMedicalTag = (guestId, tag) => {
    const nextGuests = list.guests.map(g => {
      if (g.id !== guestId) return g;
      return { ...g, medical: (Array.isArray(g.medical) ? g.medical : []).filter(t => t !== tag) };
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
  };

  const addAllergyTag = (guestId, tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const nextGuests = list.guests.map(g => {
      if (g.id !== guestId) return g;
      const existing = Array.isArray(g.allergy) ? g.allergy : [];
      if (existing.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) return g;
      return { ...g, allergy: [...existing, trimmed] };
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
    setAllergySearch(prev => ({ ...prev, [guestId]: '' }));
  };

  const removeAllergyTag = (guestId, tag) => {
    const nextGuests = list.guests.map(g => {
      if (g.id !== guestId) return g;
      return { ...g, allergy: (Array.isArray(g.allergy) ? g.allergy : []).filter(t => t !== tag) };
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
  };

  const linkSingle = (guestId, targetId) => {
    const nextGuests = list.guests.map(g => {
      if (g.id === guestId) {
        const existing = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
        return { ...g, roommateIds: [...new Set([...existing, targetId])] };
      }
      if (g.id === targetId) {
        const existing = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
        return { ...g, roommateIds: [...new Set([...existing, guestId])] };
      }
      return g;
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
    setRowSearch(prev => ({ ...prev, [guestId]: '' }));
  };

  const unlinkRoommate = (guestId, targetId) => {
    const nextGuests = list.guests.map(g => {
      if (g.id === guestId) {
        const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
        return { ...g, roommateIds: ids.filter(id => id !== targetId), roommateId: g.roommateId === targetId ? null : g.roommateId };
      }
      if (g.id === targetId) {
        const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
        return { ...g, roommateIds: ids.filter(id => id !== guestId), roommateId: g.roommateId === guestId ? null : g.roommateId };
      }
      return g;
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
  };

  const tools = [
    { id: 'age', name: 'Verifica Età', icon: '🎂', desc: 'Ricalcola l\'età basandosi sulla data di nascita e il giorno di arrivo.' },
    { id: 'names', name: 'Capitalizzazione', icon: '✍️', desc: 'Applica l\'iniziale maiuscola a tutti i nomi e cognomi.' },
    { id: 'fullName', name: 'Sync Nomi / FullName', icon: '🔄', desc: 'Sincronizza: unisce Nome+Cognome o divide il Nome Completo se i campi singoli sono vuoti.' },
    { id: 'roommates', name: 'Travel With', icon: '🔗', desc: 'Analizza preferenze di stanza e crea collegamenti vincolanti tra ospiti.' },
    { id: 'allergies', name: 'Standardizza Allergie', icon: '⚕️', desc: 'Associa tag allergie standardizzati agli ospiti.' },
    { id: 'medical', name: 'Medical', icon: '🏥', desc: 'Associa tag condizioni mediche standardizzati agli ospiti.' }
  ];

  const calculateAgeAtDate = (dobStr, baseDateStr) => {
    if (!dobStr || !baseDateStr) return null;
    const dobParts = dobStr.includes('/') ? dobStr.split('/') : dobStr.split('-');
    const baseParts = baseDateStr.includes('/') ? baseDateStr.split('/') : baseDateStr.split('-');
    if (dobParts.length !== 3 || baseParts.length !== 3) return null;
    let d, b;
    if (dobParts[0].length === 4) d = new Date(dobParts[0], dobParts[1]-1, dobParts[2]);
    else d = new Date(dobParts[2], dobParts[1]-1, dobParts[0]);
    if (baseParts[0].length === 4) b = new Date(baseParts[0], baseParts[1]-1, baseParts[2]);
    else b = new Date(baseParts[2], baseParts[1]-1, baseParts[0]);
    if (isNaN(d.getTime()) || isNaN(b.getTime())) return null;
    let age = b.getFullYear() - d.getFullYear();
    const m = b.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && b.getDate() < d.getDate())) age--;
    return age;
  };

  const titleCase = (s) => {
    if (!s) return '';
    return s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const runTool = (toolId) => {
    if (!list) return;
    setActiveTool(toolId);
    setSuggestions([]);
    setAiStep('idle');
    let results = [];

    list.guests.forEach(g => {
      let suggested = null;
      if (toolId === 'age') {
        const correct = calculateAgeAtDate(g.dob, g.arrivalDate);
        if (correct !== null && correct !== Number(g.age)) suggested = { age: correct };
      } else if (toolId === 'names') {
        const n = titleCase(g.name || '');
        const s = titleCase(g.surname || '');
        if (n !== (g.name || '') || s !== (g.surname || '')) suggested = { name: n, surname: s };
      } else if (toolId === 'fullName') {
        const hasParts = (g.name || '').trim() && (g.surname || '').trim();
        const hasFull = (g.fullName || '').trim();
        if (hasParts && !hasFull) {
          suggested = { fullName: `${g.name} ${g.surname}`.trim() };
        } else if (!hasParts && hasFull) {
          const parts = g.fullName.trim().split(/\s+/);
          if (parts.length >= 2) suggested = { name: titleCase(parts[0]), surname: titleCase(parts.slice(1).join(' ')) };
        } else if (hasParts && hasFull) {
          const joined = `${g.name} ${g.surname}`.trim();
          if (joined.toLowerCase() !== g.fullName.toLowerCase()) suggested = { fullName: joined };
        }
      }
      if (suggested) results.push({ guestId: g.id, original: { ...g }, suggested });
    });

    if (toolId === 'roommates' || toolId === 'allergies' || toolId === 'medical') return;
    setSuggestions(results);
    setAiStep('done');
  };

  const applySingle = (sugIdx) => {
    const sug = suggestions[sugIdx];
    const nextGuests = list.guests.map(g => g.id === sug.guestId ? { ...g, ...sug.suggested } : g);
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
    setSuggestions(prev => prev.filter((_, i) => i !== sugIdx));
  };

  const dismissSingle = (index) => {
    setSuggestions(prev => prev.filter((_, idx) => idx !== index));
  };

  const applyAll = () => {
    let nextGuests = [...list.guests];
    suggestions.forEach(sug => {
      const idx = nextGuests.findIndex(g => g.id === sug.guestId);
      if (idx !== -1) nextGuests[idx] = { ...nextGuests[idx], ...sug.suggested };
    });
    dispatch({ type: 'UPDATE_GUEST_LIST_CONTENT', listId: list.id, guests: nextGuests });
    setSuggestions([]);
  };

  return (
    <div className="saas-tab-content">
      <div className="saas-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>← Torna alle liste</button>
          <h1 style={{ margin: 0 }}>List Improver 🪄</h1>
          {list && <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>{list.name}</span>}
        </div>
      </div>

      <div className="saas-pane">
        {hasVersionAlert && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
                ⚠️ Lista aggiornata dalla v{lastVer === 0 ? '—' : lastVer} → v{curVer}
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginTop: 3 }}>
                Ci sono variazioni non ancora processate. Considera di rieseguire tutti gli strumenti su questa versione.
              </div>
            </div>
            <button
              className="btn btn-sm"
              style={{ background: '#f59e0b', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
              onClick={() => dispatch({ type: 'SET_IMPROVER_VERSION', listId: effectiveListId })}
            >
              Ho capito
            </button>
          </div>
        )}

        {!effectiveListId ? (
          <div className="empty-state">Scegli una lista ospiti per iniziare a ottimizzare i dati.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {tools.map(t => (
                <div key={t.id} className={`card tool-card ${activeTool === t.id ? 'active' : ''}`} style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => runTool(t.id)}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{t.name}</div>
                  <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: 0, lineHeight: 1.4 }}>{t.desc}</p>
                </div>
              ))}
            </div>

            {activeTool && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>
                    {activeTool === 'roommates' ? 'Travel With — Compagni di Stanza' : activeTool === 'allergies' ? 'Standardizza Allergie' : activeTool === 'medical' ? 'Medical' : `Risultati: ${tools.find(t => t.id === activeTool)?.name}`}
                  </h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {suggestions.length > 0 && activeTool !== 'roommates' && (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{suggestions.length} suggerimenti</span>
                        <button className="btn btn-primary btn-sm" onClick={applyAll}>Applica a tutti</button>
                      </>
                    )}
                  </div>
                </div>

                {activeTool === 'roommates' && (() => {
                  const guestsWithNotes = list.guests.filter(g => {
                    const n = `${Array.isArray(g.medical) ? g.medical.join(' ') : (g.medical || '')} ${g.privateNotes || ''}`.trim().toLowerCase();
                    return n && n !== 'none' && n !== '—' && n !== 'no' && n !== 'n/a';
                  });
                  const linkedPairs = list.guests.flatMap(g => {
                    const ids = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
                    return ids.map(tid => ({ fromId: g.id, fromName: `${g.name} ${g.surname}`, toId: tid, toName: (() => { const t = list.guests.find(x => x.id === tid); return t ? `${t.name} ${t.surname}` : tid; })() }));
                  });
                  return (
                    <div>
                      {linkedPairs.length > 0 && (
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--success-200)', background: 'var(--success-50)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-700)', marginBottom: 6 }}>🔗 COLLEGATI</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {linkedPairs.map((p, i) => (
                              <span key={i} style={{ padding: '3px 10px', background: 'var(--success-100)', color: 'var(--success-800)', borderRadius: 20, fontSize: 12, border: '1px solid var(--success-300)' }}>
                                {p.fromName} → {p.toName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ overflowY: 'auto', maxHeight: 520 }}>
                        <table className="guest-table mini-headers">
                          <thead>
                            <tr>
                              <th style={{ width: '18%' }}>Ospite</th>
                              <th style={{ width: '22%' }}>Medical/Allergies</th>
                              <th style={{ width: '22%' }}>Private notes</th>
                              <th>Collega a...</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guestsWithNotes.length === 0 && (
                              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>Nessun ospite con note.</td></tr>
                            )}
                            {guestsWithNotes.map(g => {
                              const linkedIds = Array.isArray(g.roommateIds) ? g.roommateIds : (g.roommateId ? [g.roommateId] : []);
                              const pending = rowSelections[g.id] || [];
                              const search = rowSearch[g.id] || '';
                              const searchResults = search.length > 0
                                ? list.guests.filter(c => c.id !== g.id && !linkedIds.includes(c.id) && !pending.includes(c.id) && `${c.name} ${c.surname}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
                                : [];
                              return (
                                <tr key={g.id}>
                                  <td>
                                    <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => setEditId(g.id)}>{g.name} {g.surname}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                                      {g.age > 0 && `${g.age}y · `}{g.sex === 'M' ? '♂' : '♀'}{g.group ? ` · ${g.group}` : ''}
                                    </div>
                                  </td>
                                  <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic', lineHeight: 1.5 }}>
                                    {Array.isArray(g.medical) ? (g.medical.length ? g.medical.join(', ') : <span style={{ color: 'var(--gray-300)' }}>—</span>) : (g.medical || <span style={{ color: 'var(--gray-300)' }}>—</span>)}
                                  </td>
                                  <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic', lineHeight: 1.5 }}>
                                    {g.privateNotes || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: linkedIds.length ? 6 : 0 }}>
                                      {linkedIds.map(tid => {
                                        const t = list.guests.find(x => x.id === tid);
                                        return (
                                          <span key={tid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--success-100)', color: 'var(--success-800)', border: '1px solid var(--success-300)', borderRadius: 16, fontSize: 12 }}>
                                            {t ? `${t.name} ${t.surname}` : tid}
                                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--success-600)', fontWeight: 700 }} onClick={() => unlinkRoommate(g.id, tid)}>×</button>
                                          </span>
                                        );
                                      })}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        className="form-input mini"
                                        style={{ width: '100%', fontSize: 12 }}
                                        placeholder="Cerca ospite..."
                                        value={search}
                                        onChange={e => setRowSearch(prev => ({ ...prev, [g.id]: e.target.value }))}
                                      />
                                      {searchResults.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 160, overflowY: 'auto' }}>
                                          {searchResults.map(c => (
                                            <div key={c.id}
                                              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}
                                              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                                              onMouseLeave={e => e.currentTarget.style.background = ''}
                                              onClick={() => linkSingle(g.id, c.id)}
                                            >
                                              <strong>{c.name} {c.surname}</strong>
                                              {c.group && <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 6 }}>{c.group}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {activeTool === 'allergies' && (() => {
                  const allergyMap = {};
                  list.guests.forEach(g => {
                    (Array.isArray(g.allergy) ? g.allergy : []).forEach(tag => {
                      if (!allergyMap[tag]) allergyMap[tag] = [];
                      allergyMap[tag].push(`${g.name} ${g.surname}`);
                    });
                  });
                  const hasVal = v => Array.isArray(v) ? v.length > 0 : (!!v && String(v).trim() !== '');
                  const guestsToShow = list.guests.filter(g =>
                    hasVal(g.allergy) || hasVal(g.allergyRaw) ||
                    hasVal(g.medical) || hasVal(g.medicalRaw) ||
                    hasVal(g.privateNotes)
                  );
                  return (
                    <div>
                      {Object.keys(allergyMap).length > 0 && (
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid #fde68a', background: '#fffbeb' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>⚕️ ALLERGIE REGISTRATE</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {Object.entries(allergyMap).sort((a, b) => b[1].length - a[1].length).map(([tag, names]) => (
                              <span key={tag} title={names.join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 20, fontSize: 12 }}>
                                {tag}
                                <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{names.length}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ overflowY: 'auto', maxHeight: 520 }}>
                        <table className="guest-table mini-headers">
                          <thead>
                            <tr>
                              <th style={{ width: '18%' }}>Ospite</th>
                              <th style={{ width: '22%' }}>Medical/Allergies</th>
                              <th style={{ width: '22%' }}>Private notes</th>
                              <th>Allergie standardizzate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guestsToShow.map(g => {
                              const tags = Array.isArray(g.allergy) ? g.allergy : [];
                              const search = allergySearch[g.id] || '';
                              const searchLower = search.toLowerCase();
                              const matchingTags = search.length > 0
                                ? Object.entries(allergyMap)
                                    .filter(([tag]) => tag.toLowerCase().includes(searchLower) && !tags.map(t => t.toLowerCase()).includes(tag.toLowerCase()))
                                    .sort((a, b) => b[1].length - a[1].length).slice(0, 8)
                                : [];
                              const exactExists = Object.keys(allergyMap).some(t => t.toLowerCase() === searchLower) || tags.some(t => t.toLowerCase() === searchLower);
                              const showCreate = search.trim().length > 1 && !exactExists;
                              return (
                                <tr key={g.id}>
                                  <td>
                                    <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => setEditId(g.id)}>{g.name} {g.surname}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{g.age > 0 && `${g.age}y · `}{g.sex === 'M' ? '♂' : '♀'}{g.group ? ` · ${g.group}` : ''}</div>
                                  </td>
                                  <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>
                                    {Array.isArray(g.medical) ? (g.medical.length ? g.medical.join(', ') : <span style={{ color: 'var(--gray-300)' }}>—</span>) : (g.medical || <span style={{ color: 'var(--gray-300)' }}>—</span>)}
                                  </td>
                                  <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>
                                    {g.privateNotes || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
                                      {tags.map(tag => (
                                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 16, fontSize: 12 }}>
                                          {tag}
                                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#b45309', fontWeight: 700, fontSize: 13 }} onClick={() => removeAllergyTag(g.id, tag)}>×</button>
                                        </span>
                                      ))}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <input className="form-input mini" style={{ width: '100%', fontSize: 12 }} placeholder="Cerca o crea allergia..."
                                        value={search} onChange={e => setAllergySearch(prev => ({ ...prev, [g.id]: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter' && search.trim()) addAllergyTag(g.id, search.trim()); }}
                                      />
                                      {(matchingTags.length > 0 || showCreate) && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 200, overflowY: 'auto' }}>
                                          {matchingTags.map(([tag, names]) => (
                                            <div key={tag} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 8 }}
                                              onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
                                              onMouseLeave={e => e.currentTarget.style.background = ''}
                                              onClick={() => addAllergyTag(g.id, tag)}>
                                              <span style={{ fontWeight: 600 }}>{tag}</span>
                                              <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>+{names.length}</span>
                                            </div>
                                          ))}
                                          {showCreate && (
                                            <div style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--primary-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                                              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                                              onMouseLeave={e => e.currentTarget.style.background = ''}
                                              onClick={() => addAllergyTag(g.id, search.trim())}>
                                              <span style={{ fontSize: 14 }}>+</span> Crea "{search.trim()}"
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {activeTool === 'medical' && (() => {
                  const medMap = {};
                  list.guests.forEach(g => {
                    const tags = Array.isArray(g.medical) ? g.medical : [];
                    tags.forEach(tag => {
                      if (!medMap[tag]) medMap[tag] = [];
                      medMap[tag].push(`${g.name} ${g.surname}`);
                    });
                  });
                  return (
                    <div>
                      {Object.keys(medMap).length > 0 && (
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid #bfdbfe', background: '#eff6ff' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>🏥 CONDIZIONI REGISTRATE</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {Object.entries(medMap).sort((a, b) => b[1].length - a[1].length).map(([tag, names]) => (
                              <span key={tag} title={names.join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 20, fontSize: 12 }}>
                                {tag}
                                <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{names.length}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ overflowY: 'auto', maxHeight: 520 }}>
                        <table className="guest-table mini-headers">
                          <thead>
                            <tr>
                              <th style={{ width: '18%' }}>Ospite</th>
                              <th style={{ width: '22%' }}>Medical/Allergies</th>
                              <th style={{ width: '22%' }}>Private notes</th>
                              <th>Medical standardizzato</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.guests.filter(g => {
                              const hasVal = v => Array.isArray(v) ? v.length > 0 : (!!v && String(v).trim() !== '');
                              return hasVal(g.medical) || hasVal(g.medicalRaw) || hasVal(g.allergy) || hasVal(g.allergyRaw) || hasVal(g.privateNotes);
                            }).map(g => {
                              const tags = Array.isArray(g.medical) ? g.medical : [];
                              const rawMedical = g.medicalRaw || (Array.isArray(g.medical) ? '' : (g.medical || ''));
                              const search = medicalSearch[g.id] || '';
                              const searchLower = search.toLowerCase();
                              const matchingTags = search.length > 0
                                ? Object.entries(medMap)
                                    .filter(([tag]) => tag.toLowerCase().includes(searchLower) && !tags.map(t => t.toLowerCase()).includes(tag.toLowerCase()))
                                    .sort((a, b) => b[1].length - a[1].length).slice(0, 8)
                                : [];
                              const exactExists = Object.keys(medMap).some(t => t.toLowerCase() === searchLower) || tags.some(t => t.toLowerCase() === searchLower);
                              const showCreate = search.trim().length > 1 && !exactExists;
                              return (
                                <tr key={g.id}>
                                  <td>
                                    <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => setEditId(g.id)}>{g.name} {g.surname}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{g.age > 0 && `${g.age}y · `}{g.sex === 'M' ? '♂' : '♀'}{g.group ? ` · ${g.group}` : ''}</div>
                                  </td>
                                  <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>
                                    {rawMedical || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                  </td>
                                  <td style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>
                                    {g.privateNotes || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
                                      {tags.map(tag => (
                                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 16, fontSize: 12 }}>
                                          {tag}
                                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#2563eb', fontWeight: 700, fontSize: 13 }} onClick={() => removeMedicalTag(g.id, tag)}>×</button>
                                        </span>
                                      ))}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <input className="form-input mini" style={{ width: '100%', fontSize: 12 }} placeholder="Cerca o crea condizione..."
                                        value={search} onChange={e => setMedicalSearch(prev => ({ ...prev, [g.id]: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter' && search.trim()) addMedicalTag(g.id, search.trim()); }}
                                      />
                                      {(matchingTags.length > 0 || showCreate) && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 200, overflowY: 'auto' }}>
                                          {matchingTags.map(([tag, names]) => (
                                            <div key={tag} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 8 }}
                                              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                              onMouseLeave={e => e.currentTarget.style.background = ''}
                                              onClick={() => addMedicalTag(g.id, tag)}>
                                              <span style={{ fontWeight: 600 }}>{tag}</span>
                                              <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>+{names.length}</span>
                                            </div>
                                          ))}
                                          {showCreate && (
                                            <div style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--primary-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                                              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                                              onMouseLeave={e => e.currentTarget.style.background = ''}
                                              onClick={() => addMedicalTag(g.id, search.trim())}>
                                              <span style={{ fontSize: 14 }}>+</span> Crea "{search.trim()}"
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {suggestions.length === 0 && aiStep !== 'idle' ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--success-600)' }}>✅ Dati già ottimizzati! Nessuna modifica suggerita.</div>
                  ) : suggestions.length > 0 && activeTool !== 'roommates' && activeTool !== 'allergies' && activeTool !== 'medical' ? (
                    <table className="guest-table mini-headers">
                      <thead>
                        <tr>
                          <th>Ospite</th>
                          <th>Prima</th>
                          <th>Dopo / Info</th>
                          <th style={{ width: 110 }}>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suggestions.map((sug, i) => {
                          const changes = Object.entries(sug.suggested || {});
                          return (
                            <tr key={sug.guestId + i}>
                              <td><strong onClick={() => setEditId(sug.guestId)} style={{ cursor: 'pointer', color: 'var(--primary-600)', textDecoration: 'underline' }}>{sug.original.name} {sug.original.surname}</strong></td>
                              <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                                {changes.map(([k]) => <div key={k}><span style={{ opacity: 0.6 }}>{k}:</span> {String(sug.original[k] ?? '—')}</div>)}
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--success-700)', fontWeight: 600 }}>
                                {changes.map(([k, v]) => <div key={k}><span style={{ opacity: 0.6, fontWeight: 400 }}>{k}:</span> {String(v)}</div>)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="btn btn-primary btn-xs" onClick={() => applySingle(i)}>Applica</button>
                                  <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger-600)' }} onClick={() => dismissSingle(i)}>Scarta</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editId && list && (
        <GuestModal
          guest={list.guests.find(g => g.id === editId) || EMPTY_GUEST()}
          onSave={handleModalSave}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

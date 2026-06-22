import { computeGuestChanges } from '../lib/allocationChat';

const KIND_STYLE = {
  assigned:   { bg: '#dcfce7', color: '#166534', label: 'assegnato' },
  moved:      { bg: '#dbeafe', color: '#1e40af', label: 'spostato' },
  unassigned: { bg: '#fee2e2', color: '#991b1b', label: 'rimosso' },
  edited:     { bg: '#fef9c3', color: '#854d0e', label: 'modificato' },
};

function GuestPill({ g, kind }) {
  const style = kind ? KIND_STYLE[kind] : null;
  return (
    <span
      title={`${g.name} ${g.surname} · ${g.sex} · ${g.age}y${g.group ? ` · ${g.group}` : ''}${g.role ? ` · ${g.role}` : ''}`}
      style={{
        fontSize: 11,
        padding: '2px 6px',
        borderRadius: 4,
        border: `1px solid ${g.sex === 'M' ? 'var(--male-color)' : 'var(--female-color)'}`,
        background: style ? style.bg : '#fff',
        color: style ? style.color : 'var(--gray-700)',
        whiteSpace: 'nowrap',
      }}
    >
      {g.name} {(g.surname || '')[0] || ''}.
      {kind && <strong style={{ marginLeft: 4, fontSize: 9 }}>{KIND_STYLE[kind].label}</strong>}
    </span>
  );
}

function Panel({ title, accommodation, guests, changes, side }) {
  const unassigned = guests.filter(g => !g.roomId);
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--gray-200)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontWeight: 700,
          fontSize: 13,
          background: side === 'proposed' ? 'var(--primary-50)' : 'var(--gray-50)',
          borderBottom: '1px solid var(--gray-200)',
        }}
      >
        {title}
      </div>
      <div style={{ overflowY: 'auto', padding: 8, flex: 1 }}>
        {accommodation.floors.map(f => (
          <div key={f.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>
              {f.name || `Piano ${f.number}`}
            </div>
            {f.corridors.map(c => (
              <div key={c.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>Corridoio {c.name}</div>
                {c.rooms.map(r => {
                  const occ = guests.filter(g => g.roomId === r.id);
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '2px 0' }}>
                      <span style={{ minWidth: 34, fontWeight: 700, fontSize: 12, color: 'var(--gray-600)' }}>{r.number}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {occ.length === 0 && <span style={{ fontSize: 11, color: 'var(--gray-300)', fontStyle: 'italic' }}>vuota</span>}
                        {occ.map(g => <GuestPill key={g.id} g={g} kind={changes[g.id]} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 8, borderTop: '1px dashed var(--gray-200)', paddingTop: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>
            Senza stanza ({unassigned.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {unassigned.map(g => <GuestPill key={g.id} g={g} kind={changes[g.id]} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AllocationDiffView({ accommodation, currentGuests, proposedGuests, summary, chatOpen, onConfirm, onDiscard }) {
  const changes = computeGuestChanges(currentGuests, proposedGuests);
  const count = Object.keys(changes).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, width: '100%', paddingRight: chatOpen ? 396 : 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          background: 'var(--primary-50)',
          border: '1px solid var(--primary-200)',
          borderRadius: 8,
          padding: '8px 12px',
        }}
      >
        <div style={{ fontSize: 13, minWidth: 0 }}>
          <strong>Proposta dell'assistente</strong> — {count} {count === 1 ? 'modifica' : 'modifiche'}
          {summary ? `: ${summary}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onDiscard}>✕ Annulla</button>
          <button className="btn btn-success btn-sm" onClick={onConfirm} disabled={count === 0}>✅ Conferma</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        <Panel title="Soluzione attuale" accommodation={accommodation} guests={currentGuests} changes={changes} side="current" />
        <Panel title="Proposta del chatbot" accommodation={accommodation} guests={proposedGuests} changes={changes} side="proposed" />
      </div>
    </div>
  );
}

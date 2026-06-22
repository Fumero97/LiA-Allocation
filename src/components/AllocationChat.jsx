import { useState, useRef, useEffect } from 'react';
import { buildSnapshot, callChat, simulateOperations, SYSTEM_PROMPT, PROPOSE_TOOL } from '../lib/allocationChat';

export default function AllocationChat({ state, onProposal, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        'Ciao! Dimmi cosa vuoi cambiare nell’allocazione (es. "sposta Marco Rossi vicino a ragazzi della sua età") oppure fammi una domanda (es. "chi è ancora senza stanza?").',
    },
  ]);
  const [convo, setConvo] = useState([]); // cronologia in formato API Claude
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const liveState = stateRef.current;
    const newConvo = [...convo, { role: 'user', content: text }];
    setConvo(newConvo);
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);

    try {
      const system = SYSTEM_PROMPT + '\n\n# STATO ATTUALE (JSON)\n' + JSON.stringify(buildSnapshot(liveState));
      const data = await callChat(system, newConvo, [PROPOSE_TOOL]);
      const content = data.content || [];
      const textOut = content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      const tool = content.find(b => b.type === 'tool_use' && b.name === 'propose_operations');

      let after = [...newConvo, { role: 'assistant', content }];

      if (tool) {
        const ops = tool.input?.operations || [];
        const summary = tool.input?.summary || textOut || 'Proposta pronta.';
        const proposedGuests = simulateOperations(liveState, ops);
        onProposal({ operations: ops, proposedGuests, summary });
        // Inserisci un tool_result per mantenere valida la cronologia API.
        after = [
          ...after,
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: tool.id,
                content: 'Proposta mostrata all’utente per revisione; non ancora applicata.',
              },
            ],
          },
        ];
        setMessages(m => [...m, { role: 'assistant', text: summary }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: textOut || '(nessuna risposta)' }]);
      }

      setConvo(after);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: '⚠️ Errore: ' + (e?.message || e) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        background: '#fff',
        borderLeft: '1px solid var(--gray-200)',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 600,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--gray-200)',
          background: 'var(--primary-50)',
        }}
      >
        <strong style={{ fontSize: 14 }}>🤖 Assistente allocazione</strong>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--primary-600)' : 'var(--gray-100)',
              color: m.role === 'user' ? '#fff' : 'var(--gray-800)',
              padding: '7px 10px',
              borderRadius: 10,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', color: 'var(--gray-400)', fontSize: 13, fontStyle: 'italic' }}>sto pensando…</div>}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 6 }}>
        <input
          className="form-input"
          style={{ flex: 1, fontSize: 13 }}
          placeholder="Scrivi una richiesta…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={loading || !input.trim()}>
          Invia
        </button>
      </div>
    </div>
  );
}

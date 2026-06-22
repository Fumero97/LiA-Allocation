import { autoAllocate } from '../utils/allocation';

/* ──────────────────────────────────────────────────────────────
   Chatbot di allocazione: prompt, schema dello strumento, snapshot
   dello stato, simulazione delle operazioni e applicazione reale.
   ────────────────────────────────────────────────────────────── */

export const SYSTEM_PROMPT = `Sei l'assistente di allocazione stanze dell'app LiA. Aiuti il gestore a sistemare gli ospiti nelle stanze di una struttura.
Hai accesso allo STATO ATTUALE (più sotto) con: ospiti (guests), stanze (rooms), regole attive (enabledRules) e date.
Ogni ospite ha: id, name, surname, sex (M/F), age, group, role (GL/LiA o null), roomId (stanza attuale o null), roommateIds (compagni "Travel With").
Ogni stanza ha: id, number, capacity, status, corridor, floor.

Regole di comportamento:
- Per richieste di MODIFICA usa lo strumento propose_operations. Identifica ospiti e stanze tramite i loro id reali presi dallo STATO ATTUALE.
- Restituisci sempre l'insieme COMPLETO di operazioni rispetto allo stato attuale: ogni proposta sostituisce interamente la precedente.
- Non superare la capacità delle stanze (capacity). Rispetta per quanto possibile le regole attive (stesso sesso, vicinanza di età, compagni Travel With, copertura GL, ecc.) e segnala nel summary eventuali compromessi.
- Per DOMANDE (es. chi è senza stanza, quali coppie Travel With sono separate, se una stanza è piena) rispondi solo in testo, senza usare lo strumento.
- Rispondi sempre in italiano, in modo conciso. Non includere ragionamenti passo-passo nel testo finale.
- Se una richiesta è ambigua o un ospite non è identificabile con certezza, chiedi chiarimenti in testo invece di indovinare.`;

export const PROPOSE_TOOL = {
  name: 'propose_operations',
  description:
    "Proponi una serie di modifiche all'allocazione delle stanze. Restituisci SEMPRE l'insieme COMPLETO di operazioni desiderate rispetto allo STATO ATTUALE (ogni proposta sostituisce la precedente). Usa questo strumento solo quando l'utente vuole apportare cambiamenti; per le domande rispondi in testo.",
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Breve spiegazione in italiano delle modifiche proposte.' },
      operations: {
        type: 'array',
        description: 'Lista ordinata di operazioni da applicare in sequenza.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['assign', 'unassign', 'swap', 'update_guest', 'auto_allocate', 'clear'] },
            guestId: { type: 'string', description: 'id ospite (assign, unassign, update_guest)' },
            roomId: { type: 'string', description: 'id stanza (assign)' },
            guestIdA: { type: 'string', description: 'primo ospite (swap)' },
            guestIdB: { type: 'string', description: 'secondo ospite (swap)' },
            fields: {
              type: 'object',
              description: 'Per update_guest: campi da modificare (group, age, role, sex, name, surname).',
            },
          },
          required: ['type'],
        },
      },
    },
    required: ['summary', 'operations'],
  },
};

/* Snapshot compatto dello stato per il modello */
export function buildSnapshot(state) {
  const rooms = [];
  state.accommodation.floors.forEach(f =>
    f.corridors.forEach(c =>
      c.rooms.forEach(r => {
        rooms.push({
          id: r.id,
          number: r.number,
          capacity: r.capacity,
          status: r.status || 'available',
          corridor: c.name,
          floor: f.number,
        });
      })
    )
  );

  const guests = state.guests.map(g => {
    const roommateIds =
      Array.isArray(g.roommateIds) && g.roommateIds.length > 0
        ? g.roommateIds
        : g.roommateId
        ? [g.roommateId]
        : undefined;
    return {
      id: g.id,
      name: g.name,
      surname: g.surname,
      sex: g.sex,
      age: g.age,
      group: g.group,
      role: g.role || null,
      roomId: g.roomId || null,
      ...(roommateIds ? { roommateIds } : {}),
    };
  });

  return {
    rooms,
    guests,
    enabledRules: state.rules.filter(r => r.enabled).map(r => r.label),
    startDate: state.startDate || '',
    endDate: state.endDate || '',
  };
}

/* Chiamata al proxy serverless */
export async function callChat(system, messages, tools) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, messages, tools }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

/* Simula le operazioni su una COPIA degli ospiti (non tocca lo store reale).
   Rispecchia esattamente le azioni del reducer così che l'anteprima a destra
   coincida con il risultato della conferma. */
export function simulateOperations(state, operations) {
  let guests = state.guests.map(g => ({ ...g }));
  const byId = id => guests.find(g => g.id === id);

  for (const op of operations || []) {
    switch (op.type) {
      case 'assign': {
        const g = byId(op.guestId);
        if (g) g.roomId = op.roomId;
        break;
      }
      case 'unassign': {
        const g = byId(op.guestId);
        if (g) g.roomId = null;
        break;
      }
      case 'swap': {
        const a = byId(op.guestIdA);
        const b = byId(op.guestIdB);
        if (a && b) {
          const t = a.roomId;
          a.roomId = b.roomId;
          b.roomId = t;
        }
        break;
      }
      case 'update_guest': {
        const g = byId(op.guestId);
        if (g) Object.assign(g, op.fields || {});
        break;
      }
      case 'clear': {
        guests.forEach(g => {
          g.roomId = null;
        });
        break;
      }
      case 'auto_allocate': {
        const existingStays = [];
        (state.savedAllocations || []).forEach(alloc => {
          if (alloc.accommodationId === state.accommodationId && alloc.id !== state.editingAllocationId) {
            alloc.guests.forEach(g => {
              if (g.roomId) existingStays.push({ ...g, projStart: alloc.startDate, projEnd: alloc.endDate });
            });
          }
        });
        const assignments = autoAllocate(
          guests,
          state.accommodation,
          state.rules,
          existingStays,
          state.startDate,
          state.endDate
        );
        guests = guests.map(g => ({
          ...g,
          roomId: assignments[g.id] !== undefined ? assignments[g.id] : g.roomId,
        }));
        break;
      }
      default:
        break;
    }
  }

  return guests;
}

/* Applica le operazioni allo store reale tramite le azioni esistenti.
   Mantiene undo/redo e audit log funzionanti. */
export function applyOperationsToStore(operations, dispatch, guests) {
  for (const op of operations || []) {
    switch (op.type) {
      case 'assign':
        dispatch({ type: 'ASSIGN_ROOM', guestId: op.guestId, roomId: op.roomId });
        break;
      case 'unassign':
        dispatch({ type: 'UNASSIGN_GUEST', guestId: op.guestId });
        break;
      case 'swap':
        dispatch({ type: 'SWAP_GUESTS', guestIdA: op.guestIdA, guestIdB: op.guestIdB });
        break;
      case 'clear':
        dispatch({ type: 'CLEAR_ALLOCATIONS' });
        break;
      case 'auto_allocate':
        dispatch({ type: 'AUTO_ALLOCATE' });
        break;
      case 'update_guest': {
        const g = (guests || []).find(x => x.id === op.guestId);
        if (!g) break;
        const updated = { ...g, ...(op.fields || {}) };
        if (op.fields && (op.fields.name !== undefined || op.fields.surname !== undefined)) {
          updated.fullName = `${updated.name || ''} ${updated.surname || ''}`.trim();
        }
        dispatch({ type: 'UPDATE_GUEST', guest: updated });
        break;
      }
      default:
        break;
    }
  }
}

/* Confronta stato attuale e proposto: ritorna { [guestId]: kind } */
export function computeGuestChanges(current, proposed) {
  const cur = Object.fromEntries(current.map(g => [g.id, g]));
  const changes = {};
  proposed.forEach(p => {
    const c = cur[p.id];
    if (!c) return;
    const roomChanged = (c.roomId || null) !== (p.roomId || null);
    const fieldsChanged = ['group', 'age', 'role', 'sex', 'name', 'surname'].some(
      k => (c[k] ?? '') !== (p[k] ?? '')
    );
    let kind = null;
    if (roomChanged) {
      if (!c.roomId && p.roomId) kind = 'assigned';
      else if (c.roomId && !p.roomId) kind = 'unassigned';
      else kind = 'moved';
    } else if (fieldsChanged) {
      kind = 'edited';
    }
    if (kind) changes[p.id] = kind;
  });
  return changes;
}

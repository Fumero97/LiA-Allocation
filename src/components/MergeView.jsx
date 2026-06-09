import { MERGE_DIFF_FIELDS } from '../lib/mergeUtils';

export default function MergeView({ list, mergeData, decisions, version, onDecideField, onToggleInclude, onConfirm, onCancel }) {
  const { diffs, newOnes } = mergeData;
  const totalChangedFields = diffs.reduce((s, d) => s + Object.keys(d.fields).length, 0);

  return (
    <div className="saas-tab-content">
      <div className="saas-header">
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>← Annulla</button>
        <h1>Nuova versione — {list.name}</h1>
        <p style={{ color: 'var(--gray-500)', marginTop: 4, marginBottom: 0 }}>
          Sarà salvata come <strong>v{version}</strong>. La versione corrente (v{version - 1}) resterà nello storico.
        </p>
      </div>
      <div className="saas-pane">
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          <div style={{ flex: 1, background: diffs.length ? '#fffbeb' : '#f0fdf4', border: `1px solid ${diffs.length ? '#fde68a' : '#bbf7d0'}`, borderRadius: 10, padding: '14px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{diffs.length}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>ospiti con modifiche</div>
            {diffs.length > 0 && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{totalChangedFields} campi totali</div>}
          </div>
          <div style={{ flex: 1, background: newOnes.length ? '#eff6ff' : '#f9fafb', border: `1px solid ${newOnes.length ? '#bfdbfe' : 'var(--gray-200)'}`, borderRadius: 10, padding: '14px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{newOnes.length}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>nuovi ospiti</div>
          </div>
        </div>

        {diffs.length === 0 && newOnes.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)', background: '#fff', borderRadius: 10, border: '1px solid var(--gray-200)', marginBottom: 24 }}>
            Nessuna differenza trovata tra la lista attuale e il file caricato.
          </div>
        )}

        {diffs.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>Ospiti con modifiche</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {diffs.map(({ existingGuest: eg, fields }) => (
                <div key={eg.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: '#fffbeb', fontWeight: 600, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{eg.fullName || `${eg.name} ${eg.surname}`}</span>
                    {eg.externalId && <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 13 }}>#{eg.externalId}</span>}
                    <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 13 }}>· {eg.group}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <th style={{ padding: '7px 16px', textAlign: 'left', color: 'var(--gray-400)', fontWeight: 500, width: 150 }}>Campo</th>
                        <th style={{ padding: '7px 16px', textAlign: 'left', color: '#b91c1c', fontWeight: 500 }}>Valore attuale</th>
                        <th style={{ padding: '7px 16px', textAlign: 'left', color: '#15803d', fontWeight: 500 }}>Nuovo valore</th>
                        <th style={{ padding: '7px 16px', textAlign: 'center', fontWeight: 500, width: 180 }}>Mantieni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(fields).map(([fk, { old: oldVal, new: newVal }]) => {
                        const label = MERGE_DIFF_FIELDS.find(f => f.key === fk)?.label || fk;
                        const decKey = `${eg.id}__${fk}`;
                        const dec = decisions.fields[decKey] ?? 'new';
                        return (
                          <tr key={fk} style={{ borderBottom: '1px solid #f9fafb' }}>
                            <td style={{ padding: '7px 16px', color: 'var(--gray-600)', fontWeight: 500 }}>{label}</td>
                            <td style={{ padding: '7px 16px', color: dec === 'old' ? '#111' : 'var(--gray-300)', textDecoration: dec === 'new' ? 'line-through' : 'none' }}>
                              {oldVal || <em style={{ color: 'var(--gray-300)' }}>—</em>}
                            </td>
                            <td style={{ padding: '7px 16px', color: dec === 'new' ? '#111' : 'var(--gray-300)', textDecoration: dec === 'old' ? 'line-through' : 'none' }}>
                              {newVal || <em style={{ color: 'var(--gray-300)' }}>—</em>}
                            </td>
                            <td style={{ padding: '7px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', fontSize: 12 }}>
                                <button style={{ padding: '4px 10px', background: dec === 'old' ? '#374151' : '#fff', color: dec === 'old' ? '#fff' : 'var(--gray-600)', border: 'none', cursor: 'pointer' }} onClick={() => onDecideField(decKey, 'old')}>Attuale</button>
                                <button style={{ padding: '4px 10px', background: dec === 'new' ? '#2563eb' : '#fff', color: dec === 'new' ? '#fff' : 'var(--gray-600)', border: 'none', cursor: 'pointer' }} onClick={() => onDecideField(decKey, 'new')}>Nuovo</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {newOnes.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Nuovi ospiti ({newOnes.length})</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => newOnes.forEach(ng => onToggleInclude(ng.id, true))}>Seleziona tutti</button>
                <button className="btn btn-outline btn-sm" onClick={() => newOnes.forEach(ng => onToggleInclude(ng.id, false))}>Deseleziona tutti</button>
              </div>
            </div>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Nome</th>
                  <th>Gruppo</th>
                  <th>Sesso</th>
                  <th>Età</th>
                  <th>DOB</th>
                  <th>Medical/Allergies</th>
                </tr>
              </thead>
              <tbody>
                {newOnes.map(ng => {
                  const included = decisions.include[ng.id] !== false;
                  return (
                    <tr key={ng.id} style={{ opacity: included ? 1 : 0.4 }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={included} onChange={e => onToggleInclude(ng.id, e.target.checked)} />
                      </td>
                      <td style={{ fontWeight: 500 }}>{ng.fullName || `${ng.name} ${ng.surname}`}</td>
                      <td>{ng.group}</td>
                      <td>{ng.sex === 'M' ? '♂' : '♀'}</td>
                      <td>{ng.age}</td>
                      <td>{ng.dob}</td>
                      <td>{Array.isArray(ng.medical) ? ng.medical.join(', ') : (ng.medical || '—')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(diffs.length > 0 || newOnes.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button className="btn btn-outline" onClick={onCancel}>Annulla</button>
            <button className="btn btn-primary" onClick={onConfirm}>✅ Conferma e salva v{version}</button>
          </div>
        )}
      </div>
    </div>
  );
}

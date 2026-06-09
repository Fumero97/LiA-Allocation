import { useApp } from '../../store';

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle" onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track" />
      <span className="toggle-thumb" />
    </label>
  );
}

function RuleCard({ rule, onToggle, onParamChange, index, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div className={`rule-card ${rule.enabled ? 'enabled' : ''} animate-fade-in`}>
      <div className="rule-top">
        <div className="rule-priority">{index + 1}</div>

        <div className="rule-info">
          <h3>{rule.label}</h3>
          <p>{rule.description}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Priority controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              className="btn btn-ghost btn-xs"
              disabled={isFirst}
              onClick={onMoveUp}
              title="Increase priority"
              style={{ padding: '2px 4px', fontSize: 11 }}
            >
              ▲
            </button>
            <button
              className="btn btn-ghost btn-xs"
              disabled={isLast}
              onClick={onMoveDown}
              title="Decrease priority"
              style={{ padding: '2px 4px', fontSize: 11 }}
            >
              ▼
            </button>
          </div>

          <Toggle
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
          />
        </div>
      </div>

      {/* Params (shown when rule is enabled and has params) */}
      {rule.enabled && rule.type === 'age_proximity' && (
        <div className="rule-params">
          <label>Maximum age difference:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={rule.params.maxAgeDiff ?? 3}
            onChange={e => onParamChange(rule.id, 'maxAgeDiff', parseInt(e.target.value) || 1)}
          />
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>years</span>
        </div>
      )}
    </div>
  );
}

export default function StepRules() {
  const { state, dispatch } = useApp();
  const rules = [...state.rules].sort((a, b) => a.priority - b.priority);

  const toggle = id => {
    const rule = state.rules.find(r => r.id === id);
    dispatch({ type: 'UPDATE_RULE', rule: { ...rule, enabled: !rule.enabled } });
  };

  const updateParam = (id, key, value) => {
    const rule = state.rules.find(r => r.id === id);
    dispatch({ type: 'UPDATE_RULE', rule: { ...rule, params: { ...rule.params, [key]: value } } });
  };

  const moveRule = (id, direction) => {
    const sorted = [...state.rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(r => r.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const newRules = sorted.map(r => ({ ...r }));
    const tmpPriority = newRules[idx].priority;
    newRules[idx].priority = newRules[swapIdx].priority;
    newRules[swapIdx].priority = tmpPriority;

    dispatch({ type: 'SET_RULES', payload: newRules });
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <div className="step-container">
      <div className="step-header">
        <h1>Allocation Rules</h1>
        <p>
          Define the rules that the automatic assignment algorithm must respect.
          Rules are sorted by priority — use the arrows to change it.
        </p>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span
          className={`badge ${enabledCount > 0 ? 'badge-success' : 'badge-gray'}`}
          style={{ fontSize: 13, padding: '4px 12px' }}
        >
          {enabledCount} {enabledCount === 1 ? 'active rule' : 'active rules'}
        </span>
        {enabledCount === 0 && (
          <span className="text-muted">
            No active rules — automatic assignment will be unconstrained.
          </span>
        )}
      </div>

      <div className="rules-list">
        {rules.map((rule, i) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={i}
            isFirst={i === 0}
            isLast={i === rules.length - 1}
            onToggle={toggle}
            onParamChange={updateParam}
            onMoveUp={() => moveRule(rule.id, -1)}
            onMoveDown={() => moveRule(rule.id, 1)}
          />
        ))}
      </div>

      <div className="card" style={{ marginTop: 28, background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--primary-700)', marginBottom: 6, fontSize: 14 }}>
              How rules work
            </div>
            <ul style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.7, paddingLeft: 16 }}>
              <li><strong>Enabled</strong> rules are checked in priority order during automatic assignment.</li>
              <li>A rule violation <strong>excludes</strong> a room as a candidate for a guest.</li>
              <li>Even with auto-assignment, you can always <strong>move guests manually</strong> in the Allocation view.</li>
              <li>Manual moves show a warning if an active rule is violated.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

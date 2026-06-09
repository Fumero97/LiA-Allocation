import { useApp } from '../store';
import StepAccommodation from './steps/StepAccommodation';
import StepRules from './steps/StepRules';
import StepGuests from './steps/StepGuests';
import StepAllocation from './steps/StepAllocation';
import StepExport from './steps/StepExport';
const STEPS = [
  { id: 0, label: 'Structure' },
  { id: 1, label: 'Rules' },
  { id: 2, label: 'Guests' },
  { id: 3, label: 'Allocation' },
  { id: 4, label: 'Export' },
];

export default function StepperView({ onBackToDashboard }) {
  const { state, dispatch } = useApp();
  const step = state.currentStep;
  const goTo = s => dispatch({ type: 'SET_STEP', payload: s });

  const canContinue = () => {
    if (step === 0) return state.accommodation.name && state.accommodation.floors.length > 0;
    if (step === 2) return state.guests.length > 0;
    return true;
  };

  return (
    <div className="saas-tab-content">
      <div className="saas-stepper-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBackToDashboard}>← Exit</button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{state.accommodation.name || 'Allocation Project'}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
              {state.startDate ? new Date(state.startDate).toLocaleDateString() : '—'} → {state.endDate ? new Date(state.endDate).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
        <nav className="step-nav" style={{ margin: 0, padding: 0 }}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`step-btn${step === s.id ? ' active' : ''}${step > s.id ? ' done' : ''}`}
              onClick={() => goTo(s.id)}
              style={{ padding: '4px 8px' }}
            >
              <span className="step-circle" style={{ width: 24, height: 24, fontSize: 12 }}>
                {step > s.id ? '✓' : i + 1}
              </span>
              <span className="step-label" style={{ fontSize: 12 }}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="step-connector" />}
            </button>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gray-50)', position: 'relative' }}>
        {step === 0 && <StepAccommodation />}
        {step === 1 && <StepRules />}
        {step === 2 && <StepGuests />}
        {step === 3 && <StepAllocation />}
        {step === 4 && <StepExport />}
      </div>

      {step !== 3 && step !== 0 && (
        <footer className="app-footer" style={{ flexShrink: 0, padding: '12px 32px' }}>
          <button className="btn btn-ghost" onClick={() => goTo(step === 1 ? 4 : step - 1)} disabled={step === 1}>← Back</button>
          <div className="footer-steps"></div>
          {step < STEPS[STEPS.length - 1].id ? (
            <button className="btn btn-primary" onClick={() => goTo(step + 1)} disabled={!canContinue()}>
              {step === 3 ? 'Go to export →' : 'Continue →'}
            </button>
          ) : <span />}
        </footer>
      )}
    </div>
  );
}

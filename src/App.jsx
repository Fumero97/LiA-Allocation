import './App.css';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './auth';
import liaLogo from './assets/lia-logo.png';
import { AppProvider } from './store';
import AppShell from './AppShell';
import LoginPage from './pages/LoginPage';
import AdminShell from './pages/admin/AdminShell';
import { getCenters } from './firebase';

// Returns the list of centre IDs for a manager profile (supports both centerId and centerIds)
function getManagerCentreIds(profile) {
  if (Array.isArray(profile?.centerIds) && profile.centerIds.length > 0) return profile.centerIds;
  if (profile?.centerId) return [profile.centerId];
  return [];
}

function CentrePicker({ centreIds, onSelect }) {
  const { logout, profile } = useAuth();
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCenters().then(all => {
      setCentres(all.filter(c => centreIds.includes(c.id)));
      setLoading(false);
    });
  }, [centreIds]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src={liaLogo} alt="Language in Action" style={{ height: 32, width: 'auto', objectFit: 'contain', marginBottom: 16 }} />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            Welcome, {profile?.displayName || profile?.email}. Select a centre to continue.
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading centres…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {centres.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s', width: '100%' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <div style={{ width: 44, height: 44, background: '#2563eb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏫</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{c.name}</div>
                  {c.location && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{c.location}</div>}
                </div>
                <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>→</div>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, profile, loading, logout } = useAuth();
  const [activeCentreId, setActiveCentreId] = useState(null);

  const centreIds = getManagerCentreIds(profile);

  // Auto-select if only one centre
  useEffect(() => {
    if (centreIds.length === 1) setActiveCentreId(centreIds[0]);
    else setActiveCentreId(null);
  }, [profile]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', flexDirection: 'column', gap: 20 }}>
        <img src={liaLogo} alt="Language in Action" style={{ height: 36, width: 'auto', objectFit: 'contain', opacity: 0.9 }} />
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (profile?.role === 'admin') return <AdminShell />;

  // Manager with no centres assigned
  if (centreIds.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>No centre assigned to your account.</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Contact your administrator.</div>
        <button onClick={logout} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>
    );
  }

  // Manager with multiple centres — show picker if no active centre selected
  if (centreIds.length > 1 && !activeCentreId) {
    return <CentrePicker centreIds={centreIds} onSelect={setActiveCentreId} />;
  }

  return (
    <AppProvider centerId={activeCentreId}>
      <AppShell
        multiCentre={centreIds.length > 1}
        onSwitchCentre={() => setActiveCentreId(null)}
      />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

import { useState } from 'react';
import { useAuth } from '../../auth';
import liaLogo from '../../assets/lia-logo.png';
import { AppProvider } from '../../store';
import AppShell from '../../AppShell';
import AdminCentres from './AdminCentres';
import AdminUsers from './AdminUsers';

const NAV = [
  { id: 'centres', label: 'Centres', icon: <BuildingIcon /> },
  { id: 'users',   label: 'Users',   icon: <UsersIcon /> },
];

export default function AdminShell() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab]       = useState('centres');
  const [overrideCentre, setOverrideCentre] = useState(null); // { id, name }

  if (overrideCentre) {
    return (
      <div style={{ position: 'relative', height: '100vh' }}>
        {/* Admin override banner */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#dc2626', color: '#fff', padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 600 }}>
          <img src={liaLogo} alt="LiA" style={{ height: 18, width: 'auto', objectFit: 'contain', opacity: 0.9 }} />
          <span style={{ opacity: 0.7 }}>·</span>
          <span>Admin override — viewing: <strong>{overrideCentre.name}</strong></span>
          <button onClick={() => setOverrideCentre(null)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ← Back to Admin
          </button>
        </div>
        <div style={{ paddingTop: 36, height: '100vh', boxSizing: 'border-box' }}>
          <AppProvider centerId={overrideCentre.id}>
            <AppShell />
          </AppProvider>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width: 240, background: '#0f172a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <img src={liaLogo} alt="Language in Action" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
            <div style={{ color: '#dc2626', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Panel</div>
          </div>
        </div>

        <nav style={{ padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: 14, fontWeight: 500,
                background: activeTab === item.id ? '#2563eb' : 'transparent',
                color: activeTab === item.id ? '#fff' : 'rgba(255,255,255,0.6)',
                transition: 'all 0.15s',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</div>
          <button onClick={logout} style={{ width: '100%', padding: '8px 0', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, background: '#f8fafc', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 32px', borderBottom: '1px solid #e2e8f0', background: '#fff', height: 60, display: 'flex', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            {NAV.find(n => n.id === activeTab)?.label}
          </h1>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'centres' && <AdminCentres onEnterCentre={setOverrideCentre} />}
          {activeTab === 'users'   && <AdminUsers />}
        </div>
      </main>

    </div>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <path d="M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

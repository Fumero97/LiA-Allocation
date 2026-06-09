import { useState } from 'react';
import { useApp } from './store';
import { useAuth } from './auth';
import liaLogo from './assets/lia-logo.png';
import TabDashboard from './pages/TabDashboard';
import TabBooking from './pages/TabBooking';
import TabOspiti from './pages/TabOspiti';
import TabGuestLists from './pages/TabGuestLists';
import TabAllocazioni from './pages/TabAllocazioni';
import TabListImprover from './pages/TabListImprover';
import TabGruppi from './pages/TabGruppi';
import TabSettings from './pages/TabSettings';

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  dashboard:  <Icon d={['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z']} />,
  booking:    <Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
  guests:     <Icon d={['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z']} />,
  lists:      <Icon d={['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2', 'M9 12h6M9 16h4']} />,
  groups:     <Icon d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75']} />,
  allocation: <Icon d={['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z', 'M17.5 17.5m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0']} />,
  settings:   <Icon d={['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z']} />,
  signout:    <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  chevLeft:   <Icon d="M15 18l-6-6 6-6" size={16} />,
  chevRight:  <Icon d="M9 18l6-6-6-6" size={16} />,
  switch:     <Icon d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']} />,
};

const NAV_ITEMS = [
  { id: 'dashboard',   icon: ICONS.dashboard,  label: 'Dashboard' },
  { id: 'gruppi',      icon: ICONS.groups,     label: 'Groups' },
  { id: 'ospiti',      icon: ICONS.guests,     label: 'Guests' },
  { id: 'booking',     icon: ICONS.booking,    label: 'Timeline' },
  { id: 'allocazione', icon: ICONS.allocation, label: 'Allocation' },
];

export default function AppShell({ multiCentre = false, onSwitchCentre }) {
  const { state, dispatch } = useApp();
  const { profile, logout } = useAuth();
  const activeTab = state.activeTab || 'ospiti';
  const setActiveTab = (tab) => dispatch({ type: 'SET_TAB', payload: tab });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="saas-layout">
      <aside className={`saas-sidebar${collapsed ? ' collapsed' : ''}`}>

        {/* Header: logo + collapse arrow */}
        <div className="saas-logo">
          {collapsed
            ? <div className="logo-mark">LiA</div>
            : <img src={liaLogo} alt="Language in Action" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
          }
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? ICONS.chevRight : ICONS.chevLeft}
          </button>
        </div>

        {/* Main nav */}
        <nav className="saas-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`saas-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom: user info + settings + sign out */}
        <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!collapsed && (
            <div style={{ padding: '6px 14px 10px', fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.displayName || profile?.email}
            </div>
          )}
          {multiCentre && (
            <button className="saas-nav-item" onClick={onSwitchCentre}>
              {ICONS.switch}
              <span className="nav-label">Switch Centre</span>
            </button>
          )}
          <button className={`saas-nav-item${activeTab === 'settings' ? ' active' : ''}`} onClick={() => setActiveTab('settings')}>
            {ICONS.settings}
            <span className="nav-label">Settings</span>
          </button>
          <button className={`saas-nav-item${activeTab === 'liste' ? ' active' : ''}`} onClick={() => setActiveTab('liste')}>
            {ICONS.lists}
            <span className="nav-label">Import List</span>
          </button>
          <button className="saas-nav-item" onClick={logout}>
            {ICONS.signout}
            <span className="nav-label">Sign Out</span>
          </button>
        </div>

      </aside>
      <main className="saas-main">
        {activeTab === 'dashboard'    && <TabDashboard />}
        {activeTab === 'booking'      && <TabBooking />}
        {activeTab === 'ospiti'       && <TabOspiti />}
        {activeTab === 'liste'        && <TabGuestLists />}
        {activeTab === 'allocazione'  && <TabAllocazioni />}
        {activeTab === 'listimprover' && <TabListImprover onClose={() => setActiveTab('liste')} />}
        {activeTab === 'gruppi'       && <TabGruppi />}
        {activeTab === 'settings'     && <TabSettings />}
      </main>
    </div>
  );
}

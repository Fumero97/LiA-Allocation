import { useState } from 'react';
import { useAuth } from '../auth';
import liaLogo from '../assets/lia-logo.png';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
          ? 'Invalid email or password.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ width: 380, background: '#fff', borderRadius: 16, padding: '40px 40px 36px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={liaLogo} alt="Language in Action" style={{ height: 36, width: 'auto', objectFit: 'contain', marginBottom: 20, filter: 'invert(1)' }} />
          <div style={{ fontSize: 13, color: '#64748b' }}>Rooming Tool · Sign in to your account</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Email</label>
            <input style={inputStyle} type="email" placeholder="you@languageinaction.co.uk" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Password</label>
            <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '11px 0', background: loading ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Please wait…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Contact your administrator to get access.
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#0f172a' };

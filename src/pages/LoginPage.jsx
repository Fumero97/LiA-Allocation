import { useState } from 'react';
import { useAuth } from '../auth';
import liaLogo from '../assets/lia-logo.png';

export default function LoginPage() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
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

  const handleReset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Enter your email above, then click “Forgot password?” to receive a reset link.');
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email.trim());
      setInfo(`Reset link sent to ${email.trim()}. Check your inbox (and spam folder).`);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-email'
          ? 'That email address is not valid.'
          : err.code === 'auth/user-not-found'
          ? 'No account found with that email.'
          : err.message
      );
    } finally {
      setResetting(false);
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
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}>
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 6 }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: resetting ? 'not-allowed' : 'pointer' }}
              >
                {resetting ? 'Sending link…' : 'Forgot password?'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          {info && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', color: '#16a34a', borderRadius: 8, fontSize: 13, border: '1px solid #bbf7d0' }}>
              {info}
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

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function Account({ mode = 'login' }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');
      if (mode === 'register') setMessage('Account created. Email verification will be required before account features are enabled.');
      else navigate('/account');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="ef-auth"><h1>{mode === 'register' ? 'Create your account' : 'Sign in'}</h1>
    <form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy} type="submit">{busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}</button></form>
    {message && <p role="status">{message}</p>}
    <p>{mode === 'register' ? <Link to="/login">Already have an account?</Link> : <Link to="/register">Create an account</Link>}</p>
  </main>;
}
export function AccountHome({ admin = false }) {
  const [state, setState] = useState({ loading: true, user: null });
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.json()).then(data => { if (active) setState({ loading: false, user: data.user }); })
      .catch(() => { if (active) setState({ loading: false, user: null }); });
    return () => { active = false; };
  }, []);
  if (state.loading) return <main className="ef-auth" role="status">Checking your session…</main>;
  if (!state.user) return <main className="ef-auth"><h1>Sign in required</h1><Link to="/login">Sign in</Link></main>;
  if (admin && state.user.role !== 'admin') return <main className="ef-auth"><h1>Access denied</h1></main>;
  return <main className="ef-auth"><h1>{admin ? 'Administration' : 'Your account'}</h1>
    <p>Signed in as {state.user.email}</p>
    {admin ? <p>Administration is being configured. No production actions are available yet.</p> : <p>Your account is ready for email verification.</p>}
    <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' }); location.assign('/'); }}>Sign out</button>
  </main>;
}

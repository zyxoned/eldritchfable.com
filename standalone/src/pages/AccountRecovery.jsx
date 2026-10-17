import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export function AccountRecovery({ mode = 'request' }) {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.get('token') || '';
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch(mode === 'request' ? '/api/auth/request-password-reset' : '/api/auth/reset-password', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'request' ? { email } : { token, password })
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to process request');
      setMessage(mode === 'request' ? result.message : 'Password updated. You can now sign in.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="ef-auth"><h1>{mode === 'request' ? 'Reset your password' : 'Choose a new password'}</h1>
    <form onSubmit={submit}>
      {mode === 'request'
        ? <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        : <label>New password<input required type="password" minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <button type="submit" disabled={busy || (mode === 'reset' && !token)}>{busy ? 'Working…' : mode === 'request' ? 'Request reset' : 'Change password'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <p><Link to="/login">Back to sign in</Link></p>
  </main>;
}

export function EmailVerification() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.get('token') || '' })
      });
      const result = await response.json();
      setMessage(response.ok ? 'Email verified. You can now sign in.' : result.error || 'Verification failed');
    } catch { setMessage('Verification failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="ef-auth"><h1>Verify your email</h1><p>Confirm your address to activate your account.</p>
    <button type="button" disabled={busy || !params.get('token')} onClick={verify}>Verify email</button>
    {message && <p role="status">{message}</p>}
    <p><Link to="/login">Sign in</Link></p>
  </main>;
}

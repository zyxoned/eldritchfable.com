import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authRequest } from '../api/auth.js';
import { AuthShell, ResendVerification } from './Account.jsx';

export function AccountRecovery({ mode = 'request' }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const token = params.get('token') || '';
  const reset = mode === 'reset';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (reset && password !== confirmation) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await authRequest(reset ? 'reset-password' : 'request-password-reset', reset ? { token, password } : { email });
      setMessage(reset ? 'Password updated. Sign in with your new password.' : result.message);
      if (reset) { setComplete(true); setPassword(''); setConfirmation(''); navigate('/reset-password', { replace: true }); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <AuthShell title={reset ? 'Choose a new password' : 'Reset your password'}>
    {reset && !token && !complete && <p role="alert">This reset link is missing or invalid. Request a new link below.</p>}
    {!complete && <form onSubmit={submit}>
      {reset ? <><label>New password<input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></>
        : <label>Email<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>}
      <button type="submit" disabled={busy || (reset && !token)}>{busy ? 'Working…' : reset ? 'Change password' : 'Send reset link'}</button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {reset && !complete && <p><Link to="/forgot-password">Request a new reset link</Link></p>}
    <p><Link to="/login">Back to sign in</Link></p>
  </AuthShell>;
}

export function EmailVerification() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const token = params.get('token') || '';
  async function verify() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await authRequest('verify-email', { token });
      setMessage('Your email is verified. You can now sign in.');
      setComplete(true);
      navigate('/verify-email', { replace: true });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <AuthShell title={complete ? 'Email verified' : 'Verify your email'}>
    {!complete && <><p>Confirm your address to activate your account.</p>
      {token ? <button type="button" disabled={busy} onClick={verify}>{busy ? 'Verifying…' : 'Verify email'}</button> : <p role="alert">This verification link is missing. Request a new one below.</p>}</>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {(!token || error) && !complete && <ResendVerification />}
    <p><Link to="/login">Sign in</Link></p>
  </AuthShell>;
}

export function VerificationRecovery() {
  return <AuthShell title="Verify your account"><ResendVerification /><p><Link to="/login">Back to sign in</Link></p></AuthShell>;
}

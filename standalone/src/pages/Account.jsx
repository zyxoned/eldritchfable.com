import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authRequest } from '../api/auth.js';

export function AuthShell({ title, children }) {
  return <main className="ef-auth"><Link className="auth-brand" to="/" aria-label="Eldritch Fable home">ELDRITCH <span>FABLE</span></Link><h1>{title}</h1>{children}<p className="auth-home"><Link to="/">Return to the storefront</Link></p></main>;
}

export function ResendVerification({ initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function resend(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { const result = await authRequest('resend-verification', { email }); setMessage(result.message); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="auth-resend" aria-label="Request a verification email"><h2>Need a new verification link?</h2><p>Use the email you registered with. Allow a minute before requesting another link.</p>
    <form onSubmit={resend}><label>Email for verification<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <button type="submit" disabled={busy}>{busy ? 'Requesting…' : 'Send verification link'}</button></form>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}

export function Account({ mode = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState(location.state?.notice || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const register = mode === 'register';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (register && password !== confirmation) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await authRequest(mode, { email, password });
      setPassword(''); setConfirmation('');
      if (register) { setPending(true); setMessage(result.message); }
      else navigate('/account', { replace: true });
    } catch (failure) { setError(failure.message); setUnverified(failure.code === 'EMAIL_UNVERIFIED'); }
    finally { setBusy(false); }
  }
  return <AuthShell title={pending ? 'Check your inbox' : register ? 'Create your account' : 'Welcome back'}>
    {!pending && <form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} aria-describedby={register ? 'password-help' : undefined} /></label>
      {register && <><small id="password-help">Use at least 12 characters. A few unrelated words make a good passphrase.</small><label>Confirm password<input required type="password" autoComplete="new-password" minLength={12} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></>}
      <button disabled={busy} type="submit">{busy ? 'Working…' : register ? 'Create account' : 'Sign in'}</button></form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {(pending || unverified) && <ResendVerification key={email} initialEmail={email} />}
    <p>{register ? <Link to="/login">Already registered? Sign in</Link> : <Link to="/register">Create an account</Link>}</p>
    {!register && <p><Link to="/forgot-password">Forgot your password?</Link> · <Link to="/resend-verification">Verify your email</Link></p>}
    {pending && <button type="button" className="auth-secondary" onClick={() => { setPending(false); setMessage(''); }}>Use another email</button>}
  </AuthShell>;
}

export function AccountHome({ admin = false }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, user: null, error: '' });
  const [reload, setReload] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, user: null, error: '' });
    authRequest('me', undefined, controller.signal)
      .then(data => setState({ loading: false, user: data.user, error: '' }))
      .catch(failure => { if (!controller.signal.aborted) setState({ loading: false, user: null, error: failure.message }); });
    return () => controller.abort();
  }, [reload]);
  async function changePassword(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (password !== confirmation) { setError('Your new passwords do not match.'); return; }
    setBusy(true);
    try {
      await authRequest('change-password', { currentPassword, password });
      setCurrentPassword(''); setPassword(''); setConfirmation('');
      setState({ loading: false, user: null, error: '' });
      setMessage('Your password has been changed and your sessions have been signed out. Sign in with your new password.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true); setError('');
    try { await authRequest('logout', {}); navigate('/login', { replace: true, state: { notice: 'You have been signed out.' } }); }
    catch (failure) { setError(failure.message); setBusy(false); }
  }
  if (state.loading) return <AuthShell title="Your account"><p role="status">Checking your session…</p></AuthShell>;
  if (state.error) return <AuthShell title="Your account"><p role="alert">{state.error}</p><button onClick={() => setReload(value => value + 1)}>Try again</button></AuthShell>;
  if (!state.user) return <AuthShell title={message ? 'Password updated' : 'Sign in to your account'}>{message && <p role="status">{message}</p>}<Link to="/login">Sign in</Link><p><Link to="/register">Create an account</Link></p></AuthShell>;
  if (admin && state.user.role !== 'admin') return <AuthShell title="Access denied"><p>This page requires an administrator account.</p><Link to="/account">Your account</Link></AuthShell>;
  return <AuthShell title={admin ? 'Administration' : 'Your account'}>
    <dl className="account-details"><div><dt>Email</dt><dd>{state.user.email}</dd></div><div><dt>Email status</dt><dd>{state.user.email_verified_at ? 'Verified' : 'Verification required'}</dd></div></dl>
    {admin && <p>Store administration features will be added separately.</p>}
    <section className="auth-resend"><h2>Change your password</h2><p>Changing your password signs out all your devices.</p><form onSubmit={changePassword}>
      <label>Current password<input required type="password" autoComplete="current-password" maxLength={256} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
      <label>New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label>Confirm new password<input required type="password" autoComplete="new-password" minLength={12} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      <button disabled={busy} type="submit">{busy ? 'Working…' : 'Change password'}</button></form>
    </section>
    {error && <p role="alert">{error}</p>}
    <button className="auth-secondary" disabled={busy} onClick={logout}>Sign out</button>
  </AuthShell>;
}

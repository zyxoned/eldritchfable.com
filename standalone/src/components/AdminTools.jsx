import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart3, Coins, RefreshCw, Settings2, Shield, Sparkles, X } from 'lucide-react';
import { authRequest } from '../api/auth.js';
import '../styles/admin-tools.css';

const number = value => Number(value || 0).toLocaleString();
const emptyProfile = { visitorName: '', heroClass: 'death-knight', testingEnabled: false, testXp: 0, testCopper: 0 };

async function adminRequest(path, body, signal) {
  const response = await fetch('/api/admin/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    signal,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(data.error || 'The admin tools could not complete that request.');
    failure.status = response.status;
    failure.code = data.code;
    throw failure;
  }
  return data;
}

function positiveInteger(value, maximum) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error('Enter a whole amount greater than zero.');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > maximum) throw new Error('Enter an amount no greater than ' + number(maximum) + '.');
  return result;
}

export default function AdminTools() {
  const location = useLocation();
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const focusRef = useRef(null);
  const identityRef = useRef(null);
  const aliasDirty = useRef(false);
  const pendingRef = useRef(null);
  const requestEpoch = useRef(0);
  const overviewSequence = useRef(0);
  const writeInFlight = useRef(false);
  const [allowed, setAllowed] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [data, setData] = useState(null);
  const [alias, setAlias] = useState('');
  const [currency, setCurrency] = useState('XP');
  const [amount, setAmount] = useState('10000');
  const [lots, setLots] = useState('1');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const profile = data?.profile || emptyProfile;
  const counts = data?.overview?.counts || {};

  const loseAccess = useCallback(() => {
    requestEpoch.current += 1; overviewSequence.current += 1; writeInFlight.current = false;
    pendingRef.current = null;
    setAllowed(false); setOpen(false); setData(null);
    setRetryPending(false); setResetConfirm(false); setBusy(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setOpen(false);
    const check = async () => {
      try {
        const result = await authRequest('me', undefined, controller.signal);
        if (controller.signal.aborted) return;
        const user = result.user;
        if (identityRef.current !== user?.id) {
          requestEpoch.current += 1; overviewSequence.current += 1; writeInFlight.current = false;
          pendingRef.current = null;
          setData(null); setRetryPending(false); setError(''); setNotice('');
          setAlias(''); aliasDirty.current = false; setResetConfirm(false); setBusy(false);
          setIdentity(user?.id || null);
          identityRef.current = user?.id || null;
        }
        const isAdmin = user?.role === 'admin' && Boolean(user.email_verified_at);
        setAllowed(isAdmin);
        if (!isAdmin) loseAccess();
        else if (location.pathname === '/admin') setOpen(true);
      } catch {
        if (!controller.signal.aborted) loseAccess();
      }
    };
    void check();
    window.addEventListener('focus', check);
    return () => { controller.abort(); window.removeEventListener('focus', check); };
  }, [location.key, location.pathname, loseAccess]);

  const refresh = useCallback(async (signal, afterMutation = false) => {
    if (writeInFlight.current && !afterMutation) return;
    const epoch = requestEpoch.current;
    const sequence = ++overviewSequence.current;
    setLoading(true);
    try {
      const result = await adminRequest('overview', undefined, signal);
      if (signal?.aborted || epoch !== requestEpoch.current || sequence !== overviewSequence.current) return;
      setData(result);
      if (!aliasDirty.current) setAlias(result.profile?.visitorName || '');
      setError('');
    } catch (failure) {
      if (signal?.aborted || epoch !== requestEpoch.current || sequence !== overviewSequence.current) return;
      if ([401, 403].includes(failure.status)) loseAccess();
      else setError(failure.message);
    } finally {
      if (!signal?.aborted && epoch === requestEpoch.current && sequence === overviewSequence.current) setLoading(false);
    }
  }, [loseAccess]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && allowed) {
      if (!dialog.open) {
        focusRef.current = document.activeElement;
        dialog.showModal();
      }
      window.dispatchEvent(new CustomEvent('eldritch:admin-panel', { detail: { open: true } }));
      const controller = new AbortController();
      void refresh(controller.signal);
      const interval = setInterval(() => void refresh(controller.signal), 30000);
      return () => { controller.abort(); clearInterval(interval); };
    }
    if (dialog.open) dialog.close();
    window.dispatchEvent(new CustomEvent('eldritch:admin-panel', { detail: { open: false } }));
  }, [open, allowed, refresh, identity]);

  useEffect(() => {
    const show = () => { if (allowed) setOpen(true); };
    const keydown = event => {
      if (allowed && event.ctrlKey && event.shiftKey && event.code === 'Backquote') {
        event.preventDefault(); setOpen(value => !value);
      }
    };
    window.addEventListener('eldritch:open-admin-tools', show);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('eldritch:open-admin-tools', show);
      window.removeEventListener('keydown', keydown);
      window.dispatchEvent(new CustomEvent('eldritch:admin-panel', { detail: { open: false } }));
    };
  }, [allowed]);

  function close() {
    setOpen(false); setResetConfirm(false);
    setAlias(profile.visitorName || ''); aliasDirty.current = false;
    window.dispatchEvent(new CustomEvent('eldritch:admin-panel', { detail: { open: false } }));
    queueMicrotask(() => {
      const target = focusRef.current?.isConnected ? focusRef.current : triggerRef.current;
      target?.focus({ preventScroll: true });
    });
  }

  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const controls = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  async function mutate(path, input, retry = false) {
    if (busy || writeInFlight.current) return;
    setError(''); setNotice('');
    const signature = path + ':' + JSON.stringify(input);
    if (pendingRef.current && !retry && pendingRef.current.signature !== signature) {
      setError('Retry the pending change before starting a different one.');
      return;
    }
    const request = pendingRef.current || { path, input, signature, requestId: crypto.randomUUID() };
    pendingRef.current = request;
    setRetryPending(false); setBusy(true);
    writeInFlight.current = true; overviewSequence.current += 1; setLoading(false);
    const epoch = requestEpoch.current;
    try {
      const result = await adminRequest(request.path, { ...request.input, requestId: request.requestId });
      if (epoch !== requestEpoch.current) return;
      pendingRef.current = null;
      setRetryPending(false); setResetConfirm(false);
      if (result.profile) setData(previous => ({ ...previous, profile: result.profile }));
      if (request.path === 'profile') {
        aliasDirty.current = false;
        setAlias(result.profile?.visitorName || request.input.visitorName);
        window.dispatchEvent(new Event('eldritch:guardian-identity'));
      }
      setNotice(result.notice || 'Your change is saved.');
      await refresh(undefined, true);
    } catch (failure) {
      if (epoch !== requestEpoch.current) return;
      if (failure.status === 401) {
        loseAccess();
      } else if (failure.status === 403) {
        pendingRef.current = null; setRetryPending(false);
        await refresh(undefined, true);
        if (epoch === requestEpoch.current) setError(failure.message);
      } else {
        const uncertain = !failure.status || failure.status >= 500;
        if (!uncertain) pendingRef.current = null;
        setRetryPending(uncertain);
        setError(uncertain ? 'The connection ended before confirmation. Retry the pending change to check its result.' : failure.message);
      }
    } finally {
      if (epoch === requestEpoch.current) { writeInFlight.current = false; setBusy(false); }
    }
  }

  function grant(event) {
    event.preventDefault();
    try { void mutate('testing/grant', { currency, amount: positiveInteger(amount, 1000000000) }); }
    catch (failure) { setError(failure.message); }
  }
  function exchange(event) {
    event.preventDefault();
    try { void mutate('testing/exchange', { lots: positiveInteger(lots, 1000000) }); }
    catch (failure) { setError(failure.message); }
  }

  function auditText(entry) {
    const detail = entry.detail || {};
    if (typeof detail === 'string') return detail;
    if (entry.action === 'visitor_name') return 'Visitor name set to ' + detail.visitorName;
    if (entry.action === 'test_grant') return 'Added ' + number(detail.amount) + ' test ' + (detail.currency === 'GOLD' ? 'gold' : 'XP');
    if (entry.action === 'test_exchange') return 'Exchanged ' + number(detail.xpSpent) + ' test XP for ' + number(Number(detail.copperAdded || 0) / 1000) + ' test gold';
    if (entry.action === 'test_reset') return 'Cleared test balances';
    if (entry.action === 'operator_configure') return 'Administrator profile configured';
    return entry.action.replaceAll('_', ' ');
  }

  function renameVisitor(event) {
    event.preventDefault();
    const visitorName = alias.trim();
    if (!/^[a-zA-Z0-9 _-]{2,16}$/.test(visitorName)) {
      setError('Use 2–16 letters, numbers, spaces, dashes or underscores for your visitor name.');
      return;
    }
    void mutate('profile', { visitorName });
  }

  if (!allowed) return null;
  const daily = data?.overview?.daily || [];
  const largest = Math.max(1, ...daily.map(day => Number(day.accounts) || 0));
  return <>
    <button ref={triggerRef} type="button" className="admin-tools-toggle" aria-label="Open admin tools" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Shield size={16} /><span>Admin</span>
    </button>
    <dialog ref={dialogRef} className="admin-tools-drawer" data-admin-drawer aria-labelledby="admin-tools-title" onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); close(); }} onClose={close}>
      <header className="admin-tools-header">
        <div><span className="admin-tools-eyebrow">THE KEEPER'S GRIMOIRE</span><h2 id="admin-tools-title">Admin tools</h2></div>
        <button type="button" className="admin-tools-icon" aria-label="Close admin tools" onClick={close}><X size={20} /></button>
      </header>
      <div className="admin-tools-body">
        <div className="admin-tools-identity"><Shield size={22} /><div><strong>{profile.visitorName || 'Your guardian'}</strong><span>Death Knight · Administrator</span></div><span className="admin-tools-private">PRIVATE</span></div>
        {loading && !data && <p role="status">Opening your grimoire…</p>}
        {error && <p role="alert" className="admin-tools-error">{error}</p>}
        {notice && <p role="status" className="admin-tools-notice">{notice}</p>}
        {retryPending && <button type="button" className="admin-tools-primary" disabled={busy} onClick={() => {
          const request = pendingRef.current;
          if (request) void mutate(request.path, request.input, true);
        }}>Retry pending change</button>}
        <section aria-labelledby="admin-realm-heading">
          <div className="admin-tools-section-title"><h3 id="admin-realm-heading"><BarChart3 size={16} /> Realm overview</h3><button type="button" className="admin-tools-icon" aria-label="Refresh admin analytics" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={15} /></button></div>
          <div className="admin-tools-metrics">
            {[
              ['Accounts', counts.accounts], ['Verified', counts.verifiedAccounts],
              ['Active players', counts.activePlayers], ['Active parties', counts.activeParties],
              ['Visiting admins', counts.activeVisitors], ['Active sessions', counts.activeSessions],
            ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value === undefined ? '—' : number(value)}</strong></div>)}
          </div>
          <div className="admin-tools-activity" aria-label="Account signups over seven days">
            <h4>New accounts · last 7 days</h4>
            {daily.length ? <div className="admin-tools-bars">{daily.map(day => <div key={day.date} title={day.date + ': ' + number(day.accounts) + ' accounts'}>
              <span className="admin-tools-bar" style={{ height: Math.max(3, (Number(day.accounts) || 0) / largest * 64) + 'px' }} />
              <strong>{number(day.accounts)}</strong><small>{day.date.slice(5)}</small>
            </div>)}</div> : <p className="admin-tools-muted">No activity is available yet.</p>}
          </div>
          <dl className="admin-tools-facts">
            <div><dt>XP awarded · 7 days</dt><dd>{number(data?.overview?.economy?.xpAwarded7d)}</dd></div>
            <div><dt>Published wares</dt><dd>{number(counts.publishedProducts)}</dd></div>
            <div><dt>Mail pending / failed</dt><dd>{number(data?.overview?.mail?.pending)} / {number(data?.overview?.mail?.failed)}</dd></div>
          </dl>
          {(data?.overview?.classes || []).length > 0 && <p className="admin-tools-muted">Callings: {data.overview.classes.map(value => value.classId + ' ' + number(value.count)).join(' · ')}</p>}
        </section>
        <section aria-labelledby="admin-testing-heading">
          <h3 id="admin-testing-heading"><Coins size={16} /> Testing resources <span className="admin-tools-unlimited">{profile.testingEnabled ? '∞ ACCESS' : 'LOCKED'}</span></h3>
          <p className="admin-tools-muted">Repeatable test grants, separate from your Secret Stash and customer earnings.</p>
          <div className="admin-tools-wallet">
            <div><span>Test XP</span><strong data-testid="admin-test-xp">{number(profile.testXp)}</strong></div>
            <div><span>Test gold</span><strong data-testid="admin-test-gold">{(Number(profile.testCopper || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong></div>
          </div>
          {profile.testingEnabled ? <>
            <form onSubmit={grant} className="admin-tools-grant">
              <label>Test resource<select value={currency} disabled={busy} onChange={event => setCurrency(event.target.value)}><option value="XP">XP</option><option value="GOLD">Gold</option></select></label>
              <label>Grant amount<input type="text" inputMode="numeric" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} required maxLength={16} /></label>
              <button type="submit" className="admin-tools-primary" disabled={busy}>Grant test resources</button>
            </form>
            <form onSubmit={exchange} className="admin-tools-exchange"><label>Exchange lots<input type="text" inputMode="numeric" value={lots} disabled={busy} onChange={event => setLots(event.target.value)} required maxLength={13} /></label><button type="submit" disabled={busy || Number(profile.testXp) < 1250}>Exchange test XP</button></form>
            <p className="admin-tools-muted">Each lot exchanges 1,250 test XP for 1 test gold.</p>
            {resetConfirm ? <div className="admin-tools-confirm"><p>Clear only your test balances? Your normal stash and audit history stay intact.</p><button type="button" disabled={busy} onClick={() => setResetConfirm(false)}>Keep test balances</button><button type="button" className="admin-tools-danger" disabled={busy} onClick={() => void mutate('testing/reset', {})}>Clear test balances</button></div> : <button type="button" className="admin-tools-text" disabled={busy} onClick={() => setResetConfirm(true)}>Reset test balances…</button>}
          </> : <p className="admin-tools-muted">Testing access is not enabled for this administrator.</p>}
        </section>
        <section aria-labelledby="admin-identity-heading">
          <h3 id="admin-identity-heading"><Settings2 size={16} /> Guardian identity</h3>
          <form onSubmit={renameVisitor}>
            <label>Visitor name<input value={alias} onChange={event => { setAlias(event.target.value); aliasDirty.current = true; }} disabled={busy} minLength={2} maxLength={16} required /></label>
            <button type="submit" disabled={busy || alias.trim() === profile.visitorName}>Save visitor name</button>
          </form>
          <a className="admin-tools-visit" href="/play?visitor=1" onClick={close}><Sparkles size={16} /> Visit a random party</a>
          <p className="admin-tools-muted">Party visits keep your invulnerability, healing boon and party-scaled offense.</p>
        </section>
        <section aria-labelledby="admin-audit-heading"><h3 id="admin-audit-heading">Your recent changes</h3>
          {(data?.audit || []).length ? <ol className="admin-tools-audit">{data.audit.map(entry => <li key={entry.id}><strong>{auditText(entry)}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ol> : <p className="admin-tools-muted">No admin changes recorded yet.</p>}
        </section>
      </div>
      <footer className="admin-tools-footer">Only signed-in administrators can open these tools. <kbd>Ctrl + Shift + ~</kbd></footer>
    </dialog>
  </>;
}

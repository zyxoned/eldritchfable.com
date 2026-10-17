import { useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
export default function NewsletterAction({ action }) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.get('token') || '';
  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/newsletter/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'The link is invalid or has already been used.');
      setStatus(action === 'confirm' ? 'Subscription confirmed.' : 'You have been unsubscribed.');
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  return <main className="ef-auth">
    <h1>{action === 'confirm' ? 'Confirm your subscription' : 'Unsubscribe from emails'}</h1>
    <p>{action === 'confirm' ? 'Confirm that you wish to receive Eldritch Fable updates.' : 'Stop receiving Eldritch Fable promotional emails.'}</p>
    <button type="button" disabled={!token || busy} onClick={submit}>{busy ? 'Processing…' : action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe'}</button>
    {status && <p role="status">{status}</p>}
    <p><Link to="/">Return to Eldritch Fable</Link></p>
  </main>;
}

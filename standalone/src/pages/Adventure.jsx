import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Map as MapIcon, Sparkles } from 'lucide-react';
import { authRequest } from '../api/auth.js';
import Mossvale from '../game/Mossvale.tsx';
import SecretStash from './SecretStash.jsx';
import '../game/game.css';

export default function Adventure({ stash = false }) {
  const [state, setState] = useState({ loading: true, user: null, error: '' });
  const [newsletter, setNewsletter] = useState({ email: '', busy: false, status: '', error: '' });
  const [retry, setRetry] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, user: null, error: '' });
    authRequest('me', undefined, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) {
          setState({ loading: false, user: data.user, error: '' });
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setState({ loading: false, user: null, error: error.message });
        }
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const before = document.title;
    document.title = (stash ? 'Secret Stash' : 'Mossvale Adventure') + ' | Eldritch Fable';
    return () => { document.title = before; };
  }, [stash]);

  const expired = () => setState({ loading: false, user: null, error: '' });

  async function subscribeNewsletter(event) {
    event.preventDefault();
    if (newsletter.busy) return;
    setNewsletter(current => ({ ...current, busy: true, status: '', error: '' }));
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: newsletter.email.trim(), consent: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Newsletter request failed.');
      if (res.status !== 202 || typeof data?.message !== 'string' || !data.message.trim()) {
        throw new Error('We could not confirm your newsletter request. Please try again.');
      }
      setNewsletter({ email: '', busy: false, status: data.message, error: '' });
    } catch (error) {
      setNewsletter(current => ({ ...current, busy: false, error: error.message || 'Newsletter request failed.' }));
    }
  }

  if (state.user) {
    return stash
      ? <SecretStash onSessionExpired={expired} />
      : <Mossvale user={state.user} onSessionExpired={expired} />;
  }

  const next = encodeURIComponent(stash ? '/stash' : '/play');
  return (
    <div className="ef-rpg">
      <main className="adventure-entry-shell">
        <section className="adventure-entry">
          <span className="adventure-entry-frame" aria-hidden="true" />
          <div className="adventure-entry-layout">
            <div className="adventure-entry-copy">
              <div className="eyebrow">ELDRITCH FABLE · CHRONICLE GATE</div>
              <h1>{state.loading ? 'Opening the gate…' : stash ? 'The Secret Stash awaits.' : 'Enter Èterna'}</h1>
              <p>{stash
                ? 'Sign in to open your private rewards ledger, coin balance, and progression records.'
                : 'Sign in to begin your chapter, keep your adventurer saved, and continue into the realm from any supported desktop or mobile browser.'}</p>
              {state.loading ? <p role="status">Checking your Eldritch Fable account…</p> : <>
                {state.error && <p role="alert">{state.error}</p>}
                {state.error
                  ? <button className="primary-button" onClick={() => setRetry(value => value + 1)}>Try again</button>
                  : <>
                    <div className="gate-actions">
                      <Link className="primary-button" to={'/login?next=' + next} state={{ from: location.pathname }}>Sign in to Eldritch Fable</Link>
                      <Link className="secondary-button" to={'/register?next=' + next}>Create an account</Link>
                    </div>
                    <form className="adventure-newsletter" onSubmit={subscribeNewsletter}>
                      <h2><Mail size={16} /> Optional weekly newsletter</h2>
                      <p>Get weekly stock updates, promotions, and world notes. Subscription requires inbox confirmation.</p>
                      <label htmlFor="adventure-newsletter-email">Email</label>
                      <div className="adventure-newsletter-actions">
                        <input id="adventure-newsletter-email" type="email" autoComplete="email" required maxLength={254} readOnly={newsletter.busy}
                          value={newsletter.email} onChange={event => setNewsletter(current => ({ ...current, email: event.target.value }))}
                          placeholder="you@example.com" />
                        <button className="secondary-button" type="submit" disabled={newsletter.busy}>{newsletter.busy ? 'Submitting…' : 'Subscribe'}</button>
                      </div>
                      {newsletter.status && <p role="status">{newsletter.status}</p>}
                      {newsletter.error && <p role="alert">{newsletter.error}</p>}
                    </form>
                  </>}
              </>}
              <div className="adventure-entry-footer">
                <Link className="gate-home" to="/">Return to the storefront</Link>
                <span>Keyboard and touch controls are fully supported in the realm.</span>
              </div>
            </div>
            <aside className="adventure-entry-map" aria-label="Basic map view of Èterna">
              <div className="adventure-map-title"><MapIcon size={15} /> Èterna</div>
              <svg viewBox="0 0 460 300" role="img" aria-label="A simple world map silhouette for Èterna">
                <path d="M28 117C45 81 85 72 122 63C162 53 203 57 237 74C274 92 286 131 289 164C292 198 277 226 245 242C208 261 165 259 128 247C89 235 47 220 28 189C15 169 11 140 28 117Z" />
                <path d="M313 85C332 74 352 74 372 82C394 92 408 113 415 137C423 162 421 190 406 211C391 233 365 245 340 242C317 238 302 222 296 202C289 182 289 160 293 140C297 119 297 96 313 85Z" />
                <path d="M149 262C162 248 184 246 201 252C220 258 228 275 226 291H130C129 281 136 271 149 262Z" />
              </svg>
              <p><Sparkles size={13} /> Basic map preview. Additional named regions unlock through progression and future world-building slices.</p>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

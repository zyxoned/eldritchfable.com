import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { authRequest } from '../api/auth.js';
import Mossvale from '../game/Mossvale.tsx';
import SecretStash from './SecretStash.jsx';
import '../game/game.css';

export default function Adventure({ stash = false }) {
  const [state, setState] = useState({ loading: true, user: null, error: '' });
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

  if (state.user) {
    return stash
      ? <SecretStash onSessionExpired={expired} />
      : <Mossvale user={state.user} onSessionExpired={expired} />;
  }

  const next = encodeURIComponent(stash ? '/stash' : '/play');
  return (
    <div className="ef-rpg">
      <main className="account-gate">
        <LockKeyhole aria-hidden="true" />
        <div className="eyebrow">ELDRITCH FABLE · MEMBERS OF THE REALM</div>
        <h1>{state.loading ? 'Opening the gate…' : stash ? 'Your treasures are yours alone.' : 'Every legend needs a name.'}</h1>
        {state.loading ? <p role="status">Checking your Eldritch Fable account…</p> : <>
          <p>{stash
            ? 'Sign in to see your private XP balance, adventure rewards, and future exchanges.'
            : 'Choose from eight callings and play with up to five other adventurers. Sign in to watch the opening story, create your persistent character, and keep your earned XP with your account.'}</p>
          {state.error && <p role="alert">{state.error}</p>}
          {state.error
            ? <button className="primary-button" onClick={() => setRetry(value => value + 1)}>Try again</button>
            : <div className="gate-actions">
              <Link className="primary-button" to={'/login?next=' + next} state={{ from: location.pathname }}>Sign in to Eldritch Fable</Link>
              <Link className="secondary-button" to={'/register?next=' + next}>Create an account</Link>
            </div>}
        </>}
        <Link className="gate-home" to="/">Return to the storefront</Link>
      </main>
    </div>
  );
}
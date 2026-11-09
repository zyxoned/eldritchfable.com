import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Maximize, Smartphone } from 'lucide-react';
import './landscape-gate.css';

const TOUCH = '(pointer: coarse) and (hover: none)';
const PORTRAIT = '(orientation: portrait)';
const PHONE_SHORT_EDGE = 600;

function readPortraitPhone() {
  const { width, height, orientation } = window.screen;
  const shortEdge = Math.min(width || window.innerWidth, height || window.innerHeight);
  const portrait = orientation?.type?.startsWith('portrait') || window.matchMedia(PORTRAIT).matches;
  return shortEdge <= PHONE_SHORT_EDGE && window.matchMedia(TOUCH).matches && portrait;
}

function watchOrientation(update) {
  const queries = [window.matchMedia(TOUCH), window.matchMedia(PORTRAIT)];
  const orientation = window.screen.orientation;
  for (const query of queries) query.addEventListener('change', update);
  orientation?.addEventListener('change', update);
  window.addEventListener('resize', update);
  return () => {
    for (const query of queries) query.removeEventListener('change', update);
    orientation?.removeEventListener('change', update);
    window.removeEventListener('resize', update);
  };
}

const unblocked = () => false;
const noSubscription = () => () => {};

export function useMobileLandscapeBlocked(active = true) {
  return useSyncExternalStore(active ? watchOrientation : noSubscription, active ? readPortraitPhone : unblocked, unblocked);
}

function releaseLandscape(session) {
  if (session.fullscreen && document.fullscreenElement === document.documentElement) {
    // Exiting our fullscreen session also releases its orientation lock.
    void document.exitFullscreen().catch(() => {});
  } else if (session.locked) {
    try { window.screen.orientation?.unlock?.(); } catch { /* The document may be leaving. */ }
  }
  session.fullscreen = session.locked = false;
}

export default function LandscapeGate({ active = true, onBlockedChange }) {
  const blocked = useMobileLandscapeBlocked(active);
  const [attempt, setAttempt] = useState('idle');
  const dialog = useRef(null), session = useRef(null);
  const title = useId(), instructions = useId();

  useLayoutEffect(() => { onBlockedChange?.(blocked); }, [blocked, onBlockedChange]);

  useLayoutEffect(() => {
    if (!blocked) return;
    const prompt = dialog.current;
    prompt.showModal();
    return () => prompt.close();
  }, [blocked]);

  useLayoutEffect(() => {
    if (!active) { setAttempt('idle'); return; }
    const owner = { fullscreen: false, locked: false };
    session.current = owner;
    return () => {
      session.current = null;
      releaseLandscape(owner);
    };
  }, [active]);

  if (!blocked) return null;

  const canLock = typeof window.screen.orientation?.lock === 'function' &&
    (document.fullscreenElement || (document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function'));

  async function enterLandscape() {
    const owner = session.current;
    if (!owner || attempt === 'pending') return;
    setAttempt('pending');
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        owner.fullscreen = true;
      }
      if (session.current !== owner) { releaseLandscape(owner); return; }
      await window.screen.orientation.lock('landscape');
      owner.locked = true;
      if (session.current !== owner) { releaseLandscape(owner); return; }
      setAttempt('idle');
    } catch {
      releaseLandscape(owner);
      if (session.current === owner) setAttempt('failed');
    }
  }

  return (
    <dialog ref={dialog} className="landscape-gate" aria-labelledby={title} aria-describedby={instructions}
      onCancel={event => event.preventDefault()}>
      <div className="landscape-gate-panel">
        <Smartphone className="landscape-gate-phone" size={44} aria-hidden="true" />
        <h2 id={title}>Rotate your phone</h2>
        <p id={instructions}>Turn your phone sideways to continue. If the screen stays upright, enable auto-rotate.</p>
        {canLock && <button type="button" disabled={attempt === 'pending'} onClick={() => void enterLandscape()}>
          <Maximize size={17} aria-hidden="true" /> {attempt === 'pending' ? 'Opening fullscreen…' : 'Play fullscreen'}
        </button>}
        <p className="landscape-gate-status" role="status">
          {attempt === 'failed' ? 'Fullscreen rotation is unavailable. Turn your phone sideways to play.' : ''}
        </p>
      </div>
    </dialog>
  );
}

import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Maximize, Minimize, Smartphone } from 'lucide-react';
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

function releaseFullscreen(owner) {
  if (owner.fullscreen && document.fullscreenElement === document.documentElement) {
    // Exiting fullscreen also releases its orientation lock.
    void document.exitFullscreen().catch(() => {});
  }
  owner.fullscreen = false;
}

export function usePlayFullscreen(active) {
  const session = useRef(null);
  const [entered, setEntered] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  useLayoutEffect(() => {
    setPending(false);
    setNotice('');
    if (!active) { setEntered(false); return; }

    const owner = { fullscreen: false, pending: false };
    session.current = owner;
    const changed = () => {
      const fullscreen = document.fullscreenElement === document.documentElement;
      if (!fullscreen) owner.fullscreen = false;
      setEntered(fullscreen);
    };
    changed();
    document.addEventListener('fullscreenchange', changed);
    return () => {
      session.current = null;
      document.removeEventListener('fullscreenchange', changed);
      releaseFullscreen(owner);
    };
  }, [active]);

  async function toggle() {
    const owner = session.current;
    if (!owner || owner.pending) return;
    owner.pending = true;
    setPending(true);
    setNotice('');

    const root = document.documentElement;
    const exiting = document.fullscreenElement === root;
    try {
      if (exiting) {
        await document.exitFullscreen();
        return;
      }
      await root.requestFullscreen({ navigationUI: 'hide' });
      owner.fullscreen = document.fullscreenElement === root;
      if (session.current !== owner) { releaseFullscreen(owner); return; }
      if (owner.fullscreen && window.matchMedia(TOUCH).matches) {
        try {
          void window.screen.orientation?.lock?.('landscape').catch(() => {});
        } catch { /* Fullscreen still works with manual rotation. */ }
      }
    } catch {
      if (session.current === owner) setNotice(exiting
        ? 'Your browser did not exit fullscreen.'
        : 'Your browser did not allow fullscreen here.');
    } finally {
      owner.pending = false;
      if (session.current === owner) setPending(false);
    }
  }

  return { entered, pending, notice, toggle };
}

export function PlayFullscreenButton({ fullscreen }) {
  const { entered, pending, notice, toggle } = fullscreen;
  const label = entered ? 'Exit fullscreen' : 'Enter fullscreen';
  const Icon = entered ? Minimize : Maximize;
  return <div className="play-fullscreen-control">
    <button type="button" className="play-fullscreen-button" aria-label={label} title={label}
      disabled={pending} onClick={() => void toggle()}>
      <Icon size={18} aria-hidden="true" />
    </button>
    <p className="play-fullscreen-status" role="status">{notice}</p>
  </div>;
}

export default function LandscapeGate({ active = true, fullscreen }) {
  const blocked = useMobileLandscapeBlocked(active);
  const dialog = useRef(null);
  const title = useId(), instructions = useId();

  useLayoutEffect(() => {
    if (!blocked) return;
    const prompt = dialog.current;
    prompt.showModal();
    return () => prompt.close();
  }, [blocked]);

  if (!blocked) return null;

  const Icon = fullscreen.entered ? Minimize : Maximize;

  return (
    <dialog ref={dialog} className="landscape-gate" aria-labelledby={title} aria-describedby={instructions}
      onCancel={event => event.preventDefault()}>
      <div className="landscape-gate-panel">
        <Smartphone className="landscape-gate-phone" size={44} aria-hidden="true" />
        <h2 id={title}>Rotate your phone</h2>
        <p id={instructions}>Turn your phone sideways to continue. If the screen stays upright, enable auto-rotate.</p>
        <button type="button" disabled={fullscreen.pending} onClick={() => void fullscreen.toggle()}>
          <Icon size={17} aria-hidden="true" /> {fullscreen.entered ? 'Exit fullscreen' : 'Enter fullscreen'}
        </button>
        <p className="landscape-gate-status" role="status">{fullscreen.notice}</p>
      </div>
    </dialog>
  );
}

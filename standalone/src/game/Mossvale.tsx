import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MOVE_INTERVAL_MS, createMovementGate, thumbDirection } from './mobile-input.js';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check,
  ChevronRight, Compass, Flame, Gem, Hand, Leaf, LogOut, MessageCircle, Radio,
  RotateCw, Send, Shield, Sparkles, Sword, Users, X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from './transport';
import { sendWithTravelRetry } from './travel-retry.js';
import {
  CLASSES, PLAYER_CLASS_IDS, REGIONS, DEFAULT_REGION_ID, regionById, WIDTH, HEIGHT, level, questReady, walkable,
  type HeroClass, type Realm, type Appearance, type GatheringProfile,
} from './shared/game';
import GameCanvas from './GameCanvas';
import AnalogStick from './bellhouse/AnalogStick.jsx';
import AdventureJournal from './AdventureJournal.jsx';
import LandscapeGate, { PlayFullscreenButton, useMobileLandscapeBlocked, usePlayFullscreen } from './LandscapeGate.jsx';
import AppearanceEditor from './AppearanceEditor';
import FieldNotes from './FieldNotes';
import SkillsPanel from './SkillsPanel';
import JourneyPanel from './JourneyPanel';
import CharacterPath, { type Development } from './CharacterPath';
import { renderCharacterPreview } from '../../shared/hero-renderer.mjs';
import IntroCutscene from './IntroCutscene';
import { CallingPreview, CharacterCalling, EquipmentList, SkillBar } from './ClassDetails';
import { useDialogFocus } from './useDialogFocus';
import './game.css';
import './expansion.css';
import './adventure-play.css';

const BellhouseStage = lazy(() => import('./bellhouse/BellhouseStage.jsx'));

type Identity = {
  name: string;
  heroClass: HeroClass;
  joined: boolean;
  partyMode?: 'open' | 'solo';
};
type Profile = {
  playerId: string | null;
  active: boolean;
  partyId: string | null;
  balanceXp: number;
  balanceCopper?: number;
  lifetimeXp: number;
  character: Realm['players'][number] | null;
  regularCharacter?: Realm['players'][number] | null;
  adminAccess?: boolean;
  adminActive?: boolean;
  development?: Development | null;
  gathering?: GatheringProfile | null;
  cooldowns?: Record<string, number>;
};
type Reply = { realm: Realm; profile: Profile; notice?: string; playerId?: string | null };

function readIdentity(userId: string): Identity {
  try {
    const old = JSON.parse(sessionStorage.getItem('eldritch-character-' + userId) || 'null');
    if (old && (PLAYER_CLASS_IDS as readonly string[]).includes(old.heroClass)) return old;
  } catch { /* Use fresh character preferences if storage is unavailable. */ }
  return { name: '', heroClass: 'ranger', joined: false };
}

function saveIdentity(identity: Identity, userId: string) {
  try { sessionStorage.setItem('eldritch-character-' + userId, JSON.stringify(identity)); }
  catch { /* Playing still works without browser storage. */ }
}

function errorMessage(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { error?: unknown; message?: unknown } }; message?: string };
  const message = e.response?.data?.error || e.response?.data?.message;
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object' && 'message' in message) return String(message.message);
  return e.message || 'Could not reach the realm. Please reconnect and try again.';
}

function nextStep(start: { x: number; y: number }, target: { x: number; y: number }, regionId = DEFAULT_REGION_ID) {
  const key = (x: number, y: number) => x + ',' + y;
  const queue = [{ ...start, first: null as { x: number; y: number } | null }];
  const seen = new Set([key(start.x, start.y)]);
  for (let i = 0; i < queue.length && i < WIDTH * HEIGHT; i++) {
    const current = queue[i];
    if (current.x === target.x && current.y === target.y) return current.first;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (!walkable(x, y, regionId) || seen.has(key(x, y))) continue;
      seen.add(key(x, y));
      queue.push({ x, y, first: current.first || { x, y } });
    }
  }
  return null;
}

function CharacterPortrait({ heroClass, appearance, large }: { heroClass: HeroClass; appearance?: Appearance; large: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderCharacterPreview(ref.current, { classId: heroClass, appearance }, { facing: Math.PI / 2, reducedMotion: true, classColor: CLASSES[heroClass].color });
  }, [heroClass, appearance]);
  return <canvas ref={ref} className={'pixel-hero hero-portrait' + (large ? ' large' : '')} width={64} height={76} aria-hidden="true" />;
}

function PixelHero({ heroClass = 'ranger', appearance, empty = false, large = false }: {
  heroClass?: HeroClass; appearance?: Appearance; empty?: boolean; large?: boolean;
}) {
  if (!empty && heroClass !== 'death-knight') return <CharacterPortrait heroClass={heroClass} appearance={appearance} large={large} />;

  const color = empty ? '#8e8798' : CLASSES[heroClass].color;
  const draconian = !empty && heroClass === 'death-knight';
  const caster = ['mage', 'wizard', 'sorcerer'].includes(heroClass);
  return <svg className={'pixel-hero hero-portrait' + (large ? ' large' : '')} viewBox="0 0 64 76" aria-hidden="true">
    <ellipse cx="32" cy="70" rx="22" ry="4" fill="#030209" opacity=".45" />
    {draconian && <path d="M25 31 4 17 8 46 22 41M39 31 60 17 56 46 42 41" fill="#372d50" stroke="#a58ece" strokeWidth="1.2" />}
    <path d="M19 34Q32 27 45 34L49 65Q32 73 15 65Z" fill={color} opacity={empty ? '.55' : '.9'} />
    <path d="m23 55-3 14h10l2-12 3 12h10l-4-14" fill="#282332" />
    <path d="M20 35q12-5 24 0l-2 23H22Z" fill={draconian ? '#30313e' : color} stroke="#e5d2ad" strokeOpacity=".35" />
    <path d="m24 37 8 8 8-8M23 53h18" fill="none" stroke="#e5d2ad" strokeWidth="2" opacity=".7" />
    <path d="M20 34 15 49 21 52M44 34l5 15-6 3" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
    <ellipse cx="32" cy="23" rx={draconian ? 12 : 10} ry="13" fill={empty ? '#a49cab' : draconian ? '#6d7890' : '#d8b392'} />
    {!empty && <path d="M21 20q0-14 11-14 12 0 12 17l-7-9-8 4Z" fill={draconian ? '#293446' : '#40323a'} />}
    {heroClass === 'wizard' && !empty && <path d="m17 17 15-17 10 17 8 4H14Z" fill={color} stroke="#d6c49a" strokeWidth="1.3" />}
    {heroClass === 'ranger' && !empty && <path d="m19 25-2-10L32 3 46 17l-2 10-8-13Z" fill={color} />}
    {heroClass === 'knight' && !empty && <path d="M20 23V13q12-12 24 0v10l-9-3h-6Z" fill="#b0a7ab" stroke="#e7d4ae" />}
    {draconian && <><path d="M21 17 15 3l12 10M43 17 49 3 37 13" fill="#c5b0dd" /><path d="m24 24 8 12 12-12-4 12-8 4-8-5Z" fill="#78899c" /></>}
    <path d="M26 24h4m5 0h4" stroke={draconian ? '#adf4ff' : '#312635'} strokeWidth={draconian ? 2.5 : 2} strokeLinecap="round" />
    {!empty && heroClass === 'cleric' && <><ellipse cx="32" cy="3" rx="12" ry="3" fill="none" stroke="#eed38f" strokeWidth="2" /><path d="M52 22v44m-5-36h10" stroke="#e7d2a0" strokeWidth="3" /></>}
    {!empty && heroClass === 'ranger' && <><path d="M50 21q17 21 0 42l3-21Z" fill="none" stroke="#d2b67c" strokeWidth="2" /><path d="m48 40 13-3" stroke="#e4dfcd" strokeWidth="1.5" /></>}
    {!empty && heroClass === 'knight' && <><path d="m9 39 12-3v18l-6 6-6-7Z" fill="#7b7484" stroke="#c7b285" /><path d="M51 21v35m-6-7h12" stroke="#e4d4ba" strokeWidth="2.5" /></>}
    {!empty && heroClass === 'bard' && <><path d="m42 45 12-21" stroke="#c8a673" strokeWidth="4" /><ellipse cx="39" cy="51" rx="10" ry="13" transform="rotate(25 39 51)" fill="#a76948" stroke="#dfbc85" /><circle cx="40" cy="49" r="4" fill="#463047" /><path d="m39 49 15-24" stroke="#f1d4a2" strokeWidth="1.2" /></>}
    {!empty && heroClass === 'monk' && <><path d="M25 35q7 12 14 0" fill="none" stroke="#dccda1" strokeWidth="3" strokeDasharray="1 3" /><circle cx="15" cy="49" r="5" fill="#ddba97" /><circle cx="48" cy="49" r="5" fill="#ddba97" /></>}
    {!empty && caster && <><path d="M52 25v42" stroke="#a18a76" strokeWidth="3" /><circle cx="52" cy="20" r="7" fill={color} opacity=".2" /><circle cx="52" cy="20" r="4" fill={heroClass === 'sorcerer' ? '#f3a17c' : '#d3b9fa'} /><path d="M9 42q-6-9 1-15-2 9 5 11Z" fill={color} opacity=".8" /></>}
    {draconian && <><path d="m52 17 5 34-5 8-4-8Z" fill="#c7ddeb" stroke="#a5b5d9" /><path d="M44 55h16m-8 1v11" stroke="#c3a1e5" strokeWidth="3" /><path d="m26 43 6-5 6 5-6 5Z" fill="#b1eafa" /></>}
  </svg>;
}

export default function Mossvale({ user, onSessionExpired }: {
  user: { id: string; role?: string };
  onSessionExpired: () => void;
}) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const wantsBellhouse = query.get('scene') === 'bellhouse';
  const [identity] = useState(() => readIdentity(user.id));
  const [introOpen, setIntroOpen] = useState(() => {
    try { return localStorage.getItem('eldritch-intro-v1:' + user.id) !== 'seen'; }
    catch { return true; }
  });
  const [actionPending, setActionPending] = useState(false);
  const [visitorBusy, setVisitorBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState(identity.name);
  const [heroClass, setHeroClass] = useState<HeroClass>(identity.heroClass);
  const [partyMode, setPartyMode] = useState<'open' | 'solo'>(identity.partyMode || 'open');
  const [realm, setRealm] = useState<Realm | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [chat, setChat] = useState('');
  const [guide, setGuide] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [socketEpoch, setSocketEpoch] = useState(0);
  const realmRef = useRef<Realm | null>(null);
  const profileRevision = useRef(-1);
  const profileParty = useRef<string | null | undefined>(undefined);
  const transitionEpoch = useRef(0);
  const dialogRef = useDialogFocus(guide || leaving, () => { setGuide(false); setLeaving(false); });
  const playerRef = useRef<string | null>(null);
  const destination = useRef<{ x: number; y: number; range?: number } | null>(null);
  const busy = useRef(false);
  const movementIntent = useRef(0);
  const heldDirection = useRef<{ x: number; y: number } | null>(null);
  const heldPointer = useRef<number | null>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const moveAllowed = useRef(false);
  const movementGate = useRef(createMovementGate());
  const [directionButtons, setDirectionButtons] = useState(!wantsBellhouse);
  const [bellhouseReady, setBellhouseReady] = useState(false);
  const freeInput = useRef({
    move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, keys: new Map<string, [number, number]>(),
  }).current;
  const resumed = useRef(false);
  const visitorAttempted = useRef(false);
  const messages = useRef<HTMLDivElement>(null);
  const actRef = useRef<(kind: string, extra?: Record<string, unknown>) => Promise<boolean>>(async () => false);
  playerRef.current = playerId;
  const me = [...(realm?.players || []), ...(realm?.visitors || [])].find(p => p.id === playerId);
  const regionId = realm?.regionId || me?.regionId || DEFAULT_REGION_ID;
  const region = regionById(regionId);
  const { crystals: CRYSTALS, enemies: ENEMIES, shrine: SHRINE, spawn: SPAWN } = region;
  const count = realm?.players.length || 0;
  const adminActive = !!profile?.adminActive;
  const sceneActive = !!realm?.authored?.encounter || !!realm?.journey?.active;
  const journalMode = wantsBellhouse && !!me && !introOpen;
  const landscapeBlocked = useMobileLandscapeBlocked(journalMode);
  const fullscreen = usePlayFullscreen(journalMode);
  const bellhouseMode = wantsBellhouse && regionId === 'glade' && !!me && !introOpen && !sceneActive;
  const freeControls = bellhouseMode && bellhouseReady;
  const wantsVisitor = query.get('visitor') === '1' || query.get('seventh') === '1';
  const invitedParty = query.get('party');
  const partyFeatures = !!realm && Array.isArray(realm.visitors) && realm.maxPlayers === 8 && realm.maxVisitors === 2 && 'partyId' in realm;
  const visitorCount = realm?.visitors?.length || 0;
  const movementEnabled = partyFeatures && !!me && me.hp > 0 && connected && !joining && !visitorBusy
    && !introOpen && !guide && !leaving && !appearanceOpen && !adminToolsOpen && !sceneActive && !landscapeBlocked;
  moveAllowed.current = movementEnabled;

  function cancelMovement() {
    movementIntent.current++;
    heldDirection.current = null;
    heldPointer.current = null;
    destination.current = null;
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(0px, 0px)';
  }

  function openJournal() {
    cancelMovement();
    resetFreeInput();
    setJournalOpen(true);
  }

  function resetFreeInput() {
    freeInput.move.x = freeInput.move.y = freeInput.look.x = freeInput.look.y = 0;
    freeInput.keys.clear();
  }

  useEffect(() => {
    if (!movementEnabled) { cancelMovement(); resetFreeInput(); }
  }, [movementEnabled]);

  useEffect(() => {
    if (!journalMode || landscapeBlocked) setJournalOpen(false);
  }, [journalMode, landscapeBlocked]);

  useEffect(() => {
    cancelMovement();
    resetFreeInput();
  }, [realm?.partyId, realm?.regionId, realm?.scopeId, playerId, adminActive]);

  useEffect(() => {
    const stop = () => { cancelMovement(); resetFreeInput(); };
    const focus = (event: FocusEvent) => {
      if ((event.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) stop();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('pagehide', stop);
    window.addEventListener('resize', stop);
    document.addEventListener('visibilitychange', stop);
    document.addEventListener('focusin', focus);
    return () => {
      stop();
      window.removeEventListener('blur', stop);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('resize', stop);
      document.removeEventListener('visibilitychange', stop);
      document.removeEventListener('focusin', focus);
    };
  }, []);

  useEffect(() => {
    // A draft belongs to one active ordinary hero. A cross-tab party or mode
    // transition discards it and releases the movement/action modal guard.
    setAppearanceOpen(false);
    setLeaving(false);
  }, [realm?.partyId, playerId, me?.id, adminActive]);

  useEffect(() => {
    const changed = (event: Event) => {
      const next = Boolean((event as CustomEvent).detail?.open);
      setAdminToolsOpen(next);
      if (next) {
        destination.current = null;
        setGuide(false); setLeaving(false); setAppearanceOpen(false);
      }
    };
    window.addEventListener('eldritch:admin-panel', changed);
    return () => window.removeEventListener('eldritch:admin-panel', changed);
  }, []);

  function completeIntro() {
    try { localStorage.setItem('eldritch-intro-v1:' + user.id, 'seen'); }
    catch { /* The current visit still remembers a completed prologue. */ }
    setIntroOpen(false);
  }

  function replayIntro() {
    destination.current = null;
    setGuide(false); setLeaving(false); setIntroOpen(true);
  }

  function applyRealm(next: Realm) {
    const current = realmRef.current;
    const switched = !!current && next.partyId !== current.partyId;
    if (!switched && current && next.revision < current.revision) return false;
    const previousHero = [...(current?.players || []), ...(current?.visitors || [])].find(p => p.id === playerRef.current);
    const nextHero = [...(next.players || []), ...(next.visitors || [])].find(p => p.id === playerRef.current);
    // Recovery, party changes and actor replacement invalidate held intent.
    if (switched || current?.regionId !== next.regionId || current?.scopeId !== next.scopeId || (previousHero && (!nextHero || nextHero.hp <= 0 ||
      Math.abs(nextHero.x - previousHero.x) + Math.abs(nextHero.y - previousHero.y) > 1))) {
      cancelMovement();
      resetFreeInput();
    }
    realmRef.current = next;
    setRealm(next);
    return true;
  }

  function applyReply(data: Reply, explicitSwitch = false) {
    if (!explicitSwitch && realmRef.current && data.realm.partyId !== realmRef.current.partyId) return;
    if (!applyRealm(data.realm)) return;
    if (profileParty.current !== data.realm.partyId) {
      profileParty.current = data.realm.partyId;
      profileRevision.current = -1;
    }
    if (data.realm.revision < profileRevision.current) return;
    profileRevision.current = data.realm.revision;
    setProfile(data.profile);
    setPlayerId(data.profile?.active ? data.profile.playerId : null);
  }

  useEffect(() => {
    let active = true;
    const changed = () => {
      const epoch = transitionEpoch.current;
      void api.get('/api/game/world').then(result => {
        if (active && epoch === transitionEpoch.current) applyReply(result.data, true);
      }).catch(err => { if (active) setError(errorMessage(err)); });
    };
    window.addEventListener('eldritch:guardian-identity', changed);
    return () => { active = false; window.removeEventListener('eldritch:guardian-identity', changed); };
  }, []);

  function envelope(extra: Record<string, unknown> = {}) {
    return { requestId: crypto.randomUUID(), partyId: realmRef.current?.partyId || null, ...extra };
  }

  async function acceptTransitionReply(data: Reply, epoch: number) {
    if (epoch === transitionEpoch.current) {
      applyReply(data, true);
      return true;
    }
    // The SSE channel may have observed another tab changing this account's
    // actor, including a visitor switch within the same party. Re-read current
    // authorization instead of restoring an earlier HTTP projection.
    const currentEpoch = transitionEpoch.current;
    const current = (await api.get('/api/game/world')).data as Reply;
    if (currentEpoch !== transitionEpoch.current) return false;
    applyReply(current, true);
    return current.realm.partyId === data.realm.partyId
      && current.profile.playerId === data.profile.playerId
      && !!current.profile.adminActive === !!data.profile.adminActive
      && current.profile.active === data.profile.active;
  }

  async function refreshChangedParty(err: unknown) {
    const code = (err as { code?: string }).code;
    if (!['PARTY_CHANGED', 'REGION_CHANGED', 'SCOPE_CHANGED', 'EXPEDITION_CHANGED'].includes(code || '')) return false;
    cancelMovement();
    destination.current = null;
    const epoch = ++transitionEpoch.current;
    try {
      const result = await api.get('/api/game/world');
      if (epoch !== transitionEpoch.current) return true;
      applyReply(result.data, true);
      setNotice(code === 'REGION_CHANGED' ? 'Your region changed in another tab. The current region is now shown.' : 'Your party changed in another tab. The current party is now shown.');
    } catch (failure) {
      if ((failure as { status?: number }).status === 401) { endSession(); onSessionExpired(); }
      setError(errorMessage(failure));
    }
    return true;
  }

  useEffect(() => {
    let active = true;
    const events = new EventSource('/api/game/events', { withCredentials: true });
    events.addEventListener('realm', event => {
      if (!active) return;
      try {
        const next = JSON.parse((event as MessageEvent).data);
        const previous = realmRef.current;
        const changed = !!previous && next.partyId !== previous.partyId;
        const actorId = playerRef.current;
        const actorChanged = !!actorId
          && [...(previous?.players || []), ...(previous?.visitors || [])].some(actor => actor.id === actorId)
          && ![...(next.players || []), ...(next.visitors || [])].some(actor => actor.id === actorId);
        // Serialized viewer-scoped events may also replace this account's actor
        // inside one party. Hydrate its authorized profile before enabling input.
        if (applyRealm(next) && (changed || actorChanged)) {
          const epoch = ++transitionEpoch.current;
          void api.get('/api/game/world').then(result => {
            if (active && epoch === transitionEpoch.current) applyReply(result.data, true);
          }).catch(err => { if (active && epoch === transitionEpoch.current) setError(errorMessage(err)); });
        }
      }
      catch { setError('The realm update was interrupted. Please reconnect.'); }
    });
    events.addEventListener('session', event => {
      if (!active) return;
      try {
        const message = JSON.parse((event as MessageEvent).data);
        if (message.reason === 'SIGN_IN_REQUIRED') onSessionExpired();
        else {
          setConnected(false);
          setError('The realm is restarting. Please reconnect in a moment.');
        }
      } catch { setError('The live session was interrupted. Please reconnect.'); }
    });
    events.onopen = async () => {
      const epoch = transitionEpoch.current;
      try {
        const result = await api.get('/api/game/world');
        if (!active) return;
        if (epoch !== transitionEpoch.current) {
          setConnected(true); setLoading(false); return;
        }
        applyReply(result.data, true);
        const saved = result.data.profile?.regularCharacter || (!result.data.profile?.adminActive ? result.data.profile?.character : null);
        if (saved) {
          setName(saved.name);
          setHeroClass(saved.heroClass);
          identity.name = saved.name;
          identity.heroClass = saved.heroClass;
        }
        setConnected(true);
        setLoading(false);
        setError('');
      } catch (err) {
        if (!active) return;
        if ((err as { status?: number }).status === 401) onSessionExpired();
        setError(errorMessage(err));
        setConnected(false);
        setLoading(false);
      }
    };
    events.onerror = () => {
      if (active) {
        setConnected(false);
        setLoading(false);
        setError('The live connection was interrupted. Reconnect to continue.');
      }
    };
    return () => {
      active = false;
      events.close();
    };
  }, [socketEpoch]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const scrollPartyChat = useCallback(() => {
    if (messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, []);
  useEffect(scrollPartyChat, [realm?.messages.length, scrollPartyChat]);

  async function joinRealm(resume = false) {
    if (joining || introOpen || !partyFeatures) return;
    const chosenName = resume ? identity.name : name.trim();
    const chosenClass = resume ? identity.heroClass : heroClass;
    if (!/^[a-zA-Z0-9 _-]{2,16}$/.test(chosenName)) {
      setError('Use 2–16 letters, numbers, spaces, dashes or underscores for your name.');
      return;
    }
    setJoining(true);
    setError('');
    destination.current = null;
    const epoch = ++transitionEpoch.current;
    try {
      const mode = resume ? identity.partyMode || 'open' : partyMode;
      const result = await api.post('/api/game/join', envelope({ name: chosenName, heroClass: chosenClass, mode, partyId: mode === 'open' ? invitedParty || undefined : undefined }));
      if (!await acceptTransitionReply(result.data, epoch)) return;
      const data = result.data as Reply;
      identity.partyMode = data.realm.partyMode || mode;
      identity.name = chosenName;
      identity.heroClass = chosenClass;
      identity.joined = true;
      saveIdentity(identity, user.id);
      setNotice(data.notice || 'Welcome to Mossvale.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  useEffect(() => {
    if (partyFeatures && connected && !introOpen && !wantsVisitor && !profile?.adminActive && identity.joined && !resumed.current) {
      resumed.current = true;
      void joinRealm(true);
    }
  }, [connected, introOpen, wantsVisitor, profile?.adminActive, partyFeatures]);

  async function enterVisitor() {
    if (visitorBusy || introOpen || !profile?.adminAccess || !partyFeatures) return;
    setVisitorBusy(true); setError(''); destination.current = null;
    const epoch = ++transitionEpoch.current;
    try {
      const result = await api.post('/api/game/admin/join', { requestId: crypto.randomUUID() });
      if (!await acceptTransitionReply(result.data, epoch)) return;
      setNotice(result.data.notice || 'You are visiting a random party.');
    } catch (err) { if (!await refreshChangedParty(err)) setError(errorMessage(err)); }
    finally { setVisitorBusy(false); }
  }

  async function leaveVisitor() {
    if (visitorBusy) return;
    setVisitorBusy(true); setError(''); destination.current = null;
    const epoch = ++transitionEpoch.current;
    try {
      const result = await api.post('/api/game/admin/leave', envelope());
      if (!await acceptTransitionReply(result.data, epoch)) return;
      setNotice(result.data.notice || 'Your Death Knight waits beyond the veil.');
      identity.joined = false;
      saveIdentity(identity, user.id);
    } catch (err) { if (!await refreshChangedParty(err)) setError(errorMessage(err)); }
    finally { setVisitorBusy(false); }
  }

  useEffect(() => {
    if (!partyFeatures || !connected || introOpen || !profile || !wantsVisitor || visitorAttempted.current) return;
    visitorAttempted.current = true;
    if (profile.adminAccess && !profile.adminActive) void enterVisitor();
    else if (!profile.adminAccess) setError('Visiting guardian mode is available only to site administrators.');
  }, [connected, introOpen, wantsVisitor, profile?.adminAccess, partyFeatures]);

  function endSession() {
    setPlayerId(null);
    playerRef.current = null;
    destination.current = null;
    identity.joined = false;
    saveIdentity(identity, user.id);
  }

  useEffect(() => {
    if (!playerId || !connected || !partyFeatures) return;
    const timer = window.setInterval(async () => {
      try {
        const partyId = realmRef.current?.partyId;
        const result = await api.post('/api/game/heartbeat', envelope());
        if (partyId === realmRef.current?.partyId) applyReply(result.data);
      } catch (err) {
        if (await refreshChangedParty(err)) return;
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 401) { endSession(); onSessionExpired(); }
        else if ((err as { code?: string }).code === 'SEAT_EXPIRED') endSession();
        setError(errorMessage(err));
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [playerId, connected, partyFeatures]);

  async function act(kind: string, extra: Record<string, unknown> = {}) {
    if (!partyFeatures || !playerRef.current || !connected || busy.current || introOpen || guide || leaving || appearanceOpen || adminToolsOpen || landscapeBlocked) return false;
    if (kind === 'move' && (!moveAllowed.current || document.hidden || !movementGate.current(performance.now()))) return false;
    busy.current = true;
    setActionPending(true);
    if (kind !== 'move') cancelMovement();
    const epoch = transitionEpoch.current;
    const travelIntent = movementIntent.current;
    const actorId = playerRef.current;
    const partyId = realmRef.current?.partyId;
    const sourceRegionId = realmRef.current?.regionId || DEFAULT_REGION_ID;
    const send = () => api.post('/api/game/action', envelope({ kind, regionId: sourceRegionId, scopeId: realmRef.current?.scopeId, ...extra }));
    try {
      // Keep the busy lock while one known travel cooldown rejection settles.
      // Blur, dialogs, navigation and replacement actors invalidate this scope.
      const result = await sendWithTravelRetry(kind, send, () =>
        travelIntent === movementIntent.current && epoch === transitionEpoch.current
        && actorId === playerRef.current && partyId === realmRef.current?.partyId
        && sourceRegionId === (realmRef.current?.regionId || DEFAULT_REGION_ID)
        && moveAllowed.current && !document.hidden);
      if (!result) return false;
      if (epoch !== transitionEpoch.current) return false;
      applyReply(result.data);
      if (result.data.notice) {
        setNotice(result.data.notice);
        if (result.data.notice.includes('campfire restored you')) cancelMovement();
      }
      setError('');
      return true;
    } catch (err) {
      if (await refreshChangedParty(err)) return false;
      // A delayed response can put the next step inside the server cooldown.
      // Keep the route so the movement timer retries instead of stopping early.
      if (kind === 'move' && (err as { code?: string }).code === 'MOVE_COOLDOWN') return false;
      cancelMovement();
      if ((err as { response?: { status?: number } }).response?.status === 401) {
        endSession(); onSessionExpired();
      } else if ((err as { code?: string }).code === 'SEAT_EXPIRED') {
        endSession();
      }
      setError(errorMessage(err));
      return false;
    } finally {
      busy.current = false;
      setActionPending(false);
    }
  }
  actRef.current = act;

  useEffect(() => {
    const timer = window.setInterval(() => {
      const target = destination.current;
      const currentRealm = realmRef.current;
      const p = [...(currentRealm?.players || []), ...(currentRealm?.visitors || [])].find(v => v.id === playerRef.current);
      if (!moveAllowed.current || document.hidden || !p || p.hp <= 0 || busy.current) return;
      const direction = heldDirection.current;
      if (direction) {
        const x = p.x + direction.x, y = p.y + direction.y;
        if (walkable(x, y, currentRealm?.regionId)) void actRef.current('move', { x, y });
        return;
      }
      if (!target) return;
      // Crossings become actionable within reach; avoid an extra move that
      // disables their button between pointer-down and click.
      if (Math.hypot(p.x - target.x, p.y - target.y) <= (target.range || 0)) { destination.current = null; return; }
      const step = nextStep(p, target, currentRealm?.regionId);
      if (!step) { destination.current = null; return; }
      void actRef.current('move', step);
    }, MOVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  function go(x: number, y: number, range = 0) {
    if (introOpen || guide || leaving || appearanceOpen || adminToolsOpen) return;
    if (!me) { setNotice('Choose a name and enter the glade to start exploring.'); return; }
    if (!connected) { setError('Reconnect to move through the glade.'); return; }
    if (!moveAllowed.current || document.hidden) return;
    if (!walkable(x, y, regionId)) { setNotice('Find a bridge or follow the road around the water.'); return; }
    if (journalOpen) setJournalOpen(false);
    cancelMovement();
    if (Math.hypot(me.x - x, me.y - y) <= range) return;
    destination.current = { x, y, range };
    const step = nextStep(me, { x, y }, regionId);
    if (step) void actRef.current('move', step);
  }

  function move(dx: number, dy: number) {
    if (!moveAllowed.current || document.hidden) return;
    const currentRealm = realmRef.current;
    const p = [...(currentRealm?.players || []), ...(currentRealm?.visitors || [])].find(v => v.id === playerRef.current);
    if (p) {
      destination.current = null;
      if (walkable(p.x + dx, p.y + dy, currentRealm?.regionId)) void actRef.current('move', { x: p.x + dx, y: p.y + dy });
    }
  }

  function readFreeCell() {
    const current = realmRef.current;
    if (!current || (current.regionId || DEFAULT_REGION_ID) !== 'glade') return null;
    const id = playerRef.current;
    const hero = current.players.find(p => p.id === id) || current.visitors?.find(p => p.id === id);
    return hero ? {
      x: hero.x, y: hero.y, scope: JSON.stringify([current.partyId, current.scopeId, id]),
      canWalk: hero.hp > 0 && moveAllowed.current && !journalOpen && !destination.current,
    } : null;
  }

  async function crossFreeCell(from: { x: number; y: number; scope: string }, to: { x: number; y: number }) {
    const current = readFreeCell();
    if (!current?.canWalk || current.scope !== from.scope || current.x !== from.x || current.y !== from.y) return false;
    return actRef.current('move', to);
  }

  function steerThumb(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== heldPointer.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    heldDirection.current = thumbDirection(x, y);
    const length = Math.hypot(x, y), radius = rect.width * .28;
    const scale = length > radius ? radius / length : 1;
    if (thumbRef.current) thumbRef.current.style.transform = `translate(${x * scale}px, ${y * scale}px)`;
  }

  function startThumb(event: ReactPointerEvent<HTMLElement>) {
    if (!moveAllowed.current || document.hidden || event.button !== 0 || heldPointer.current !== null) return;
    event.preventDefault();
    cancelMovement();
    heldPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    steerThumb(event);
    const direction = heldDirection.current;
    if (direction) move(direction.x, direction.y);
  }

  function releaseMovement(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId === heldPointer.current) cancelMovement();
  }

  function holdDirection(event: ReactPointerEvent<HTMLButtonElement>, x: number, y: number) {
    if (!moveAllowed.current || document.hidden || event.button !== 0 || heldPointer.current !== null) return;
    event.preventDefault();
    cancelMovement();
    heldPointer.current = event.pointerId;
    heldDirection.current = { x, y };
    event.currentTarget.setPointerCapture(event.pointerId);
    move(x, y);
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (!(target instanceof HTMLElement) || target.closest('input, textarea, select, [contenteditable]') || guide || leaving || appearanceOpen || adminToolsOpen || introOpen || journalOpen || landscapeBlocked || event.altKey || event.ctrlKey || event.metaKey) return;
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
      };
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (directions[key]) {
        event.preventDefault();
        if (freeControls) {
          if (moveAllowed.current && !document.hidden && !freeInput.keys.has(key)) {
            cancelMovement();
            freeInput.keys.set(key, directions[key]);
          }
        } else {
          cancelMovement();
          move(...directions[key]);
        }
      } else if ((event.key === '1' || event.key === '2') && me) {
        const skill = CLASSES[me.heroClass].skills[Number(event.key) - 1];
        if (skill && skill.type !== 'passive') { event.preventDefault(); void actRef.current('skill', { skillId: skill.id }); }
      } else if (event.code === 'Space' && target.tagName !== 'BUTTON') {
        event.preventDefault();
        void actRef.current('attack');
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        void actRef.current('interact');
      }
    };
    const keyup = (event: KeyboardEvent) => {
      freeInput.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      freeInput.keys.clear();
    };
  }, [guide, leaving, appearanceOpen, adminToolsOpen, introOpen, journalOpen, landscapeBlocked, me?.heroClass, freeControls]);

  async function leaveRealm() {
    destination.current = null;
    const epoch = ++transitionEpoch.current;
    try {
      const result = await api.post('/api/game/leave', envelope());
      if (!await acceptTransitionReply(result.data, epoch)) return;
      endSession();
      setLeaving(false);
      setNotice('See you by the campfire. Your seat is now free.');
    } catch (err) { if (!await refreshChangedParty(err)) setError(errorMessage(err)); }
  }

  function customize() {
    if (!me || adminActive || introOpen || guide || leaving || actionPending) return;
    destination.current = null;
    setJournalOpen(false);
    setAppearanceOpen(true);
  }

  async function saveAppearance(appearance: Appearance) {
    const epoch = transitionEpoch.current;
    try {
      const result = await api.post('/api/game/appearance', envelope({ appearance }));
      if (epoch !== transitionEpoch.current) throw new Error('Your party changed. Reopen your character to save this look.');
      applyReply(result.data);
      setNotice(result.data.notice || 'Your new look is saved.');
      setAppearanceOpen(false);
    } catch (err) {
      if (await refreshChangedParty(err)) setAppearanceOpen(false);
      throw new Error(errorMessage(err));
    }
  }

  const attackLabel = me ? CLASSES[me.heroClass].attackName || 'Attack' : 'Attack';
  const near = (point: { x: number; y: number }, range: number) => !!me && Math.hypot(me.x - point.x, me.y - point.y) <= range;
  const interactLabel = me && !adminActive ? CRYSTALS.some(c => !me.gathered.includes(c.id) && near(c, 1.6)) ? 'Gather crystal'
    : near(SHRINE, 2) ? 'Visit shrine' : near(SPAWN, 2.5) ? 'Rest at camp' : 'Interact' : 'Interact';
  const sceneCanAct = partyFeatures && !!me && connected && !introOpen && !guide && !leaving && !appearanceOpen && !adminToolsOpen && !actionPending && !landscapeBlocked;
  const canAct = sceneCanAct && !sceneActive;
  const questDone = me ? questReady(me) : false;
  const bellhouseExit = wantsBellhouse && me && regionId !== 'glade' && !sceneActive
    ? region.exits.find(exit => exit.to === (regionId === 'mistHarbor' ? 'amberReach' : 'glade')) : null;
  const useCrossing = (exit: { id: string; x: number; y: number }) => {
    if (near(exit, 1.6)) {
      if (journalOpen) setJournalOpen(false);
      cancelMovement();
      void act('travel', { exitId: exit.id, regionId });
    }
    else go(exit.x, exit.y, 1.6);
  };
  const trackEnemy = () => {
    if (regionId !== 'glade') { setNotice('Quest thornlings live in Whispering Glade. Follow the crossings west to return.'); return; }
    const enemy = realm?.enemies.find(e => e.hp > 0) || ENEMIES[0];
    go(enemy.x, enemy.y);
  };
  const trackCrystal = () => {
    const crystal = CRYSTALS.find(c => !me?.gathered.includes(c.id)) || CRYSTALS[0];
    if (crystal) go(crystal.x, crystal.y); else setNotice('Moon crystals grow in Whispering Glade. Follow the crossings west to return.');
  };

  const visitorPanel = (
    profile?.adminAccess && <section className="visitor-access" aria-label="Visiting guardian connection">
      <div><span className="section-kicker">SUPPORT A COMPANY · ADMINISTRATOR</span><h2>Visit a random party</h2><p>A separate Draconian guardian with level ???, ceremonial equipment and invulnerability. Your strikes match the party and Guardian Boon heals nearby adventurers. Players keep their normal rewards. Your regular character stays saved.</p></div>
      {adminActive ? <button type="button" className="secondary-button" disabled={visitorBusy || introOpen} onClick={() => void leaveVisitor()}>{visitorBusy ? 'Returning beyond the veil…' : 'Leave visiting guardian mode'}</button>
        : <button type="button" className="primary-button" disabled={!partyFeatures || !connected || visitorBusy || introOpen} onClick={() => void enterVisitor()}>{visitorBusy ? 'Crossing the veil…' : 'Visit a random party'}</button>}
    </section>
  );
  const characterPanel = (
    <section className="card character-card">
      <div className="section-kicker">YOUR ADVENTURER <span>01</span></div>
      {me ? <>
        <div className="active-hero">
          <div className="portrait"><PixelHero heroClass={me.heroClass} appearance={me.appearance} large /><span className="portrait-spark">✧</span></div>
          <h2>{me.name}</h2>
          <p>Level {me.levelLabel || level(me.xp)} · {me.race === 'Draconian' ? 'Draconian ' : ''}{CLASSES[me.heroClass].name}</p>
        </div>
        <div className="stat-label"><span><span className="health-dot" /> Health</span><strong>{adminActive ? 'Invulnerable' : me.hp + ' / ' + (me.maxHp || 100)}</strong></div>
        <div className="progress health"><span style={{ width: Math.min(100, me.hp / (me.maxHp || 100) * 100) + '%' }} /></div>
        {!adminActive && <><div className="stat-label"><span>Next level</span><strong>{me.xp % 100} / 100 XP</strong></div>
        <div className="progress xp"><span style={{ width: me.xp % 100 + '%' }} /></div>
        <p className="level-growth-note">+2 attack damage per level. Exchanging XP does not lower your level.</p></>}
        {adminActive && <div className="visitor-status"><Shield size={13} /> UNDYING · SSS</div>}
        <Link to="/stash" className="gold-line"><Gem size={14} /> {profile?.balanceXp || 0}<span>Secret Stash · XP</span><ArrowUpRight size={12} /></Link>
        {!adminActive && <button type="button" className="customize-button secondary-button" disabled={!canAct} onClick={customize}>Customize character</button>}
        <button className="leave-button" onClick={() => { setJournalOpen(false); if (adminActive) void leaveVisitor(); else setLeaving(true); }}><LogOut size={13} /> {adminActive ? 'Return beyond the veil' : 'Leave realm'}</button>
      </> : <>
        <div className="welcome-hero"><div className="portrait"><PixelHero heroClass={heroClass} large /><span className="portrait-spark">✧</span></div><h2>Your story starts here.</h2><p>Make yourself a little legend.</p></div>
        <form onSubmit={event => { event.preventDefault(); void joinRealm(); }} noValidate>
          <label className="field-label" htmlFor="hero-name">Adventurer name</label>
          <input id="hero-name" readOnly={!!(profile?.regularCharacter || profile?.character)} value={name} maxLength={16} placeholder="What shall we call you?" onChange={event => setName(event.target.value)} autoComplete="off" />
          <span className="field-label choose-label">Choose your calling</span>
          <div className="class-options">
            {PLAYER_CLASS_IDS.map(value => <button type="button" key={value} className={heroClass === value ? 'class-option selected' : 'class-option'} disabled={!!(profile?.regularCharacter || profile?.character)} aria-pressed={heroClass === value} onClick={() => setHeroClass(value)} title={CLASSES[value].description}>
              <PixelHero heroClass={value} /><span>{CLASSES[value].name}</span>
            </button>)}
          </div>
          <CallingPreview heroClass={heroClass} />
          <fieldset className="party-mode-options" disabled={!partyFeatures || joining}>
            <legend className="field-label">Choose your company</legend>
            <label><input type="radio" name="party-mode" value="open" checked={partyMode === 'open'} onChange={() => setPartyMode('open')} /> Open party</label>
            <label><input type="radio" name="party-mode" value="solo" checked={partyMode === 'solo'} onChange={() => setPartyMode('solo')} /> Solo adventure</label>
            <small>{partyMode === 'solo' ? 'Explore on your own. Visiting guardians may lend a hand.' : invitedParty ? 'Join the party from your invitation if a seat is available.' : 'Meet a company of up to eight adventurers. Full parties open a new glade.'}</small>
          </fieldset>
          <button className="primary-button enter-button" type="submit" disabled={!partyFeatures || !connected || joining || introOpen}>
            {joining ? 'Entering the glade…' : loading ? 'Connecting…' : 'Enter the glade'} <ArrowUpRight size={17} />
          </button>
          <div className="join-note"><Shield size={11} /> Account linked. Character and XP saved.</div>
        </form>
      </>}
    </section>
  );
  const characterDetails = <>
    {me && !adminActive && <CharacterPath key={me.id} player={me} development={profile?.development} realm={realm} cooldowns={profile?.cooldowns} enabled={canAct} onSave={(stanceId, tacticId) => act('configure', { stanceId, tacticId })} />}
    {me && <CharacterCalling heroClass={me.heroClass} equipment={me.equipment} showEquipment={!journalMode} />}
  </>;
  const fieldNotes = me && <FieldNotes key={user.id} player={me} accountId={user.id} />;
  const questPanel = (
    <section className="card quest-card">
      <div className="section-kicker"><span className="kicker-with-icon"><Compass size={14} /> YOUR FIRST ADVENTURE</span></div>
      <h2>{adminActive ? 'Lend a helping hand' : 'Guardian of the Glade'}</h2>
      <p>{adminActive ? 'Players lead their story and earn their own progress. Your visit awards no personal XP or currency.' : 'The woods could use a helping hand.'}</p>
      <div className="quest-list">
        <button onClick={trackEnemy}><span className={'quest-icon ' + ((me?.kills || 0) >= 3 ? 'complete' : '')}>{(me?.kills || 0) >= 3 ? <Check size={15} /> : <Sword size={15} />}</span><span>Clear thornlings<small>Shared with nearby allies</small></span><b>{Math.min(me?.kills || 0, 3)}/3</b><ChevronRight size={12} /></button>
        <button onClick={trackCrystal}><span className={'quest-icon ' + ((me?.gathered.length || 0) >= 2 ? 'complete' : '')}>{(me?.gathered.length || 0) >= 2 ? <Check size={15} /> : <Gem size={15} />}</span><span>Gather moon crystals<small>Find the blue glow</small></span><b>{Math.min(me?.gathered.length || 0, 2)}/2</b><ChevronRight size={12} /></button>
        <button onClick={() => regionId === 'glade' ? go(SHRINE.x, SHRINE.y) : setNotice('Visit the old moon shrine in Whispering Glade to finish this objective.')}><span className={'quest-icon ' + (me?.shrine ? 'complete' : '')}>{me?.shrine ? <Check size={15} /> : <Sparkles size={15} />}</span><span>Visit the old shrine<small>A little magic awaits</small></span><b>{me?.shrine ? '1' : '0'}/1</b><ChevronRight size={12} /></button>
      </div>
      <div className="reward"><span>✧</span><span>100 XP <i>→</i> Secret Stash</span><small>QUEST REWARD</small></div>
      {me && !adminActive && <button className="claim-button" disabled={!questDone || me.claimed} onClick={() => void act('claim')}>{me.claimed ? 'Adventure complete ✓' : questDone ? 'Claim your reward' : 'Complete the three objectives'}</button>}
      <p className="tracking-hint">{regionId === 'glade' ? 'Tap an objective to walk there.' : 'Moon crystals and the quest shrine are back in Whispering Glade.'}</p>
    </section>
  );
  const inventoryPanel = me && !adminActive && <SkillsPanel player={me} realm={realm} gathering={profile?.gathering} inventoryFirst={journalMode} enabled={canAct && me.hp > 0} supplyEnabled={sceneCanAct && !realm?.authored?.encounter && me.hp > 0 && me.hp < (me.maxHp || 100)} onUseSupply={materialId => act('consumeSupply', { materialId })} onWalk={go} onGather={nodeId => act('gatherResource', { nodeId })} />;
  const journeyPanel = me && !adminActive && !sceneActive && <JourneyPanel journey={realm?.journey} authored={realm?.authored} player={me} enabled={sceneCanAct} serverTime={realm?.serverTime} onAction={(kind, extra) => void act(kind, extra)} />;
  const worldPanel = <>
    <section className="journey-panel" aria-label="World routes">
      <div className="journey-heading"><span><Compass size={14} /> THE OPEN ROAD</span><small>Three regions · one company</small></div>
      <ol className="region-route">{Object.values(REGIONS).map((place: any, index) => <li key={place.id} className={place.id === regionId ? 'current' : ''} aria-current={place.id === regionId ? 'location' : undefined}>
        <span className="route-number">0{index + 1}</span><div><strong>{place.name}</strong><small>{place.id === regionId ? 'You are here' : 'Follow the marked crossings'}</small></div>
      </li>)}</ol>
      <div className="region-exits">{region.exits.map((exit: any) => {
        const nearby = near(exit, 1.6);
        return <div className="region-exit" key={exit.id}><div><strong>{exit.name}</strong><small>To {regionById(exit.to).name}</small></div>
          <button type="button" className="secondary-button" disabled={!canAct} onClick={() => useCrossing(exit)}>{nearby ? 'Travel' : 'Walk to crossing'} <ArrowUpRight size={14} /></button>
        </div>;
      })}</div>
      <p>Travel when you reach a crossing. Your hero, party and progress stay with you.</p>
    </section>
    <div className="world-legend"><span><span className="legend-swatch hero-swatch" /> Adventurers</span><span><span className="legend-swatch enemy-swatch" /> {regionId === 'amberReach' ? 'Ridge sprites' : regionId === 'mistHarbor' ? 'Tidal wisps' : 'Thornlings'}</span>{regionId === 'glade' && <span><Gem size={11} color="#749cad" /> Moon crystals</span>}<span><Flame size={12} color="#b98658" /> Rest at camp</span></div>
  </>;
  const partyPanel = <>
    <section className="card party-card">
      <div className="section-kicker"><span className="kicker-with-icon"><Users size={14} /> THE COMPANY YOU KEEP</span></div>
      <div className="party-title"><h2>Your party</h2><span>{count}<i>/{partyFeatures ? realm.maxPlayers : '—'}</i></span></div>
      <p>{realm?.partyMode === 'solo' ? 'Your own journey, with room for visiting help.' : 'Your company can explore different regions together.'}</p>
      <div className="party-slots">
        {Array.from({ length: partyFeatures ? realm.maxPlayers : 0 }, (_, i) => {
          const player = realm?.players[i];
          return <div key={player?.id || i} className={'party-slot ' + (player ? 'occupied' : '')}>
            <div className="slot-avatar"><PixelHero heroClass={player?.heroClass} appearance={player?.appearance} empty={!player} /></div>
            <div>{player ? <><strong>{player.name}</strong><small>{player.id === playerId ? 'You · ' : ''}Lv. {player.levelLabel || level(player.xp)} {CLASSES[player.heroClass].name}</small><small className="party-region">{regionById(player.regionId).name}</small></> : <><strong>Open seat</strong><small>A friend belongs here</small></>}</div>
            {player ? <span className="online-dot" /> : <span className="seat-number">0{i + 1}</span>}
          </div>;
        })}
      </div>
      <section className="visitor-roster" aria-label="Visiting administrators">
        <div><strong>Visiting guardians</strong><span>{visitorCount} / {partyFeatures ? realm.maxVisitors : '—'}</span></div>
        {(realm?.visitors || []).map(visitor => <div className="party-slot occupied visitor-slot" key={visitor.id}>
          <div className="slot-avatar"><PixelHero heroClass={visitor.heroClass} /></div>
          <div><strong>{visitor.name}</strong><small>{visitor.id === playerId ? 'You · ' : ''}Draconian guardian · Invulnerable</small><small className="party-region">{regionById(visitor.regionId).name}</small></div><span className="online-dot" />
        </div>)}
        {!visitorCount && <small>Two extra places for visiting help.</small>}
      </section>
      <button className="invite-button" disabled={!realm?.partyId || realm.partyMode !== 'open'} onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.origin + '/play?party=' + encodeURIComponent(realm?.partyId || ''));
          setNotice('Invite link copied. Send it to your party!');
        } catch { setNotice('Invite friends by sharing this page’s URL.'); }
      }}><span>Invite a friend</span><ArrowUpRight size={15} /></button>
      <small className="party-footnote">{partyFeatures ? 'Up to eight adventurers + two visiting guardians.' : 'Party information unavailable.'}</small>
    </section>

    <section className="card chat-card">
      <div className="chat-heading"><h2><MessageCircle size={15} /> Campfire chat</h2><span className="chat-live"><Radio size={12} /></span></div>
      <div className="chat-messages" ref={messages} aria-live="polite" role="log" aria-label="Party messages">
        {!realm?.messages.length && <div className="empty-chat"><Flame size={25} strokeWidth={1.2} /><p>Quiet by the campfire.</p><small>Good company starts with hello.</small></div>}
        {realm?.messages.map(message => message.system
          ? <p key={message.id} className="system-message">{message.text}</p>
          : <div key={message.id} className="chat-message"><span>{message.name}<time>{new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></span><p>{message.text}</p></div>)}
      </div>
      <form className="chat-form" onSubmit={async event => {
        event.preventDefault();
        if (!chat.trim()) return;
        const sent = await act('chat', { text: chat });
        if (sent) setChat('');
      }}>
        <input aria-label="Party message" value={chat} maxLength={160} disabled={!canAct} onChange={event => setChat(event.target.value)} placeholder={me ? 'Say hello to the party…' : 'Join the glade to chat…'} />
        <button disabled={!canAct || !chat.trim()} aria-label="Send message"><Send size={15} /></button>
      </form>
    </section>
  </>;
  const journalButton = <button type="button" className="journal-trigger" aria-haspopup="dialog" onClick={openJournal}><BookOpen size={16} /> Journal</button>;
  const fullscreenButton = journalMode && <PlayFullscreenButton fullscreen={fullscreen} />;
  const journalPages = [
    { id: 'character', label: 'Character', content: <>
      {profile?.adminAccess && <div className="journal-links">
        <button type="button" className="journal-trigger" aria-haspopup="dialog" onClick={() => {
          setJournalOpen(false);
          window.dispatchEvent(new Event('eldritch:open-admin-tools'));
        }}><Shield size={16} /> Admin tools</button>
      </div>}
      {characterPanel}{characterDetails}{visitorPanel}
    </> },
    { id: 'inventory', label: 'Inventory', content: <div className="journal-inventory">
      {me && <section className="card calling-card" aria-label="Equipped gear">
        <h2>Equipped gear</h2><EquipmentList items={me.equipment || CLASSES[me.heroClass].equipment} />
      </section>}
      {inventoryPanel}
    </div> },
    { id: 'quests', label: 'Quests', content: <>{questPanel}{journeyPanel}</> },
    { id: 'world', label: 'World', content: <>
      {worldPanel}{fieldNotes}
      <div className="journal-links">
        <button type="button" className="secondary-button" onClick={() => { setJournalOpen(false); setGuide(true); }}>How to play</button>
        <button type="button" className="secondary-button" onClick={() => { setJournalOpen(false); replayIntro(); }}>Watch the prologue</button>
        <Link to="/shop">Shop</Link>
      </div>
    </> },
    { id: 'party', label: 'Party', content: partyPanel },
  ];
  const actionButtons = (
    <div className="action-buttons">
      <button aria-label="Attack" className="attack-button" disabled={!canAct} title={'Attack · ' + attackLabel} onClick={() => void act('attack')}><Sword size={17} /><span>{attackLabel}</span><kbd>SPACE</kbd></button>
      <button aria-label="Interact" className="interact-button" title={interactLabel} disabled={!canAct || adminActive} onClick={() => void act('interact')}><Hand size={17} /><span>{interactLabel}</span><kbd>E</kbd></button>
    </div>
  );
  const skillBar = me && <SkillBar heroClass={me.heroClass} cooldowns={profile?.cooldowns} serverTime={realm?.serverTime || Date.now()} enabled={canAct && !journalOpen} onUse={skillId => void act('skill', { skillId })} />;
  const playControlsEnabled = movementEnabled && !journalOpen;

  return (
    <div className={'ef-rpg' + (bellhouseMode ? ' bellhouse-preview' : '') + (journalMode ? ' adventure-play' : '') + (freeControls ? ' immersive-play' : '')}><div className="site-shell">
      <header className="site-header">
        <Link className="brand eldritch-brand" to="/" aria-label="Eldritch Fable home">
          <span className="brand-icon"><Sparkles size={21} strokeWidth={1.6} /></span>
          <span><strong>ELDRITCH</strong><em>FABLE</em></span>
        </Link>
        <nav aria-label="Main navigation">
          <span className="nav-active">The realm</span>
          <Link to="/shop">Shop</Link>
          <Link to="/stash">Secret Stash</Link>
          <button onClick={() => setGuide(true)}>How to play <ArrowUpRight size={13} /></button>
        </nav>
        <span className="header-note"><span className="tiny-star">✧</span> Adventures become real.</span>
      </header>

      <main>
        <section className="intro">
          <div>
            <div className="eyebrow"><span /> ELDRITCH FABLE · {partyFeatures ? 'EIGHT-PLAYER ADVENTURE' : 'PARTY ADVENTURE'}</div>
            <h1>Enter the fable. <em>Bring back a legend.</em></h1>
            <p>{partyFeatures ? 'Eight callings. Up to eight adventurers in your party, with room for two visiting guardians. Earn XP and build your private Secret Stash.' : 'Your account. Your continuing adventure. Connecting to the party realm.'}</p>
          </div>
          <div className="chapter"><span>CHAPTER 01</span><strong>The waking woods</strong><small>Your account. Your continuing story.</small></div>
        </section>

        <div className="story-banner"><span><Sparkles size={14} /> The Hollow King is waking. A new company must answer.</span><button type="button" onClick={replayIntro}><BookOpen size={14} /> Watch the prologue</button></div>

        {bellhouseExit && <div className="story-banner region-return">
          <span><Compass size={14} /> Bellhouse Ravine is in Whispering Glade.</span>
          <button type="button" disabled={!canAct} onClick={() => useCrossing(bellhouseExit)}>
            {near(bellhouseExit, 1.6) ? 'Travel to ' : 'Walk toward '}{regionById(bellhouseExit.to).name}
          </button>
        </div>}

        {!journalMode && visitorPanel}

        {connected && realm && !partyFeatures && <div className="error-banner" role="status">This realm server does not support party adventures yet. Reconnect after the game update.</div>}

        {error && <div className="error-banner" role="alert">
          <span>{error}</span>
          {!connected && <button onClick={() => { setLoading(true); setSocketEpoch(v => v + 1); }}>Reconnect <RotateCw size={14} /></button>}
          <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button>
        </div>}

        <div className="game-layout">
          {!journalMode && <aside className="adventurer-column">
            {characterPanel}

            {characterDetails}
            {fieldNotes}

            {questPanel}
          </aside>}

          <section className="world-column" aria-label="Game world">
            {journalMode && sceneActive && <div className="scene-toolbar">{journalButton}{fullscreenButton}</div>}
            {me && !adminActive && sceneActive && <JourneyPanel journey={realm?.journey} authored={realm?.authored} player={me} enabled={sceneCanAct} serverTime={realm?.serverTime} onAction={(kind, extra) => void act(kind, extra)} />}
            <div hidden={sceneActive} className={"world-card region-" + regionId}>
              <div className="world-heading">
                <div><div className="section-kicker">ELDRITCH FABLE · {realm?.partyMode === 'solo' ? 'SOLO ADVENTURE' : 'PARTY REALM'}</div><h2>{region.name}</h2></div>
                <div className="world-tools">
                  <div className={'live-pill ' + (connected ? '' : 'offline')}><span /> {connected ? 'LIVE' : loading ? 'CONNECTING' : 'OFFLINE'}<i />{count}/{partyFeatures ? realm.maxPlayers : '—'} <Users size={13} /></div>
                  {journalMode && journalButton}
                  {fullscreenButton}
                </div>
              </div>
              <div className="canvas-container">
                {bellhouseMode ? <Suspense fallback={<div className="bellhouse-stage bellhouse-loading" role="status">Loading Bellhouse Ravine…</div>}>
                  <BellhouseStage key={playerId} realm={realm} player={me} enabled={playControlsEnabled} onGo={go} onHunt={trackEnemy}
                    input={freeInput} readCell={readFreeCell} crossCell={crossFreeCell} onControlsReady={setBellhouseReady}
                    fallback={<GameCanvas realm={realm} playerId={playerId} onTile={go} />} />
                </Suspense> : <GameCanvas realm={realm} playerId={playerId} onTile={go} />}
                {!me && <div className="world-invitation"><span className="invite-icon"><Leaf size={15} /></span><div>The glade is waiting.<small>Choose your adventurer to step inside.</small></div><span>✧</span></div>}
                {notice && <div className="game-notice" role="status">{notice}</div>}
                <span className="map-corner">{region.subtitle || region.name}</span>
              </div>
              <div className="map-caption"><span><span className="sun-dot" /> {region.description}</span><span>{me ? me.x + ', ' + me.y : '30 × 22'} <Compass size={12} /></span></div>
            </div>
            <div hidden={journalMode && sceneActive} className={'controls-card' + (freeControls ? ' bellhouse-dual' : '')}>
              {freeControls ? <AnalogStick label="MOVE" name="Movement joystick" axes={freeInput.move} enabled={playControlsEnabled} onStart={cancelMovement} /> :
              <div className="mobile-controls" aria-label="Touch movement controls">
                {directionButtons ? <div className="touch-direction-pad">
                  {([[-1, 0, 'west', ArrowLeft], [0, -1, 'north', ArrowUp], [0, 1, 'south', ArrowDown], [1, 0, 'east', ArrowRight]] as const).map(([x, y, label, Icon]) =>
                    <button key={label} className={'touch-' + label} aria-label={'Move ' + label} disabled={!playControlsEnabled}
                      onPointerDown={event => holdDirection(event, x, y)} onPointerUp={releaseMovement} onPointerCancel={releaseMovement} onLostPointerCapture={releaseMovement}
                      onClick={event => { if (event.detail === 0) move(x, y); }}><Icon size={19} /></button>)}
                </div> : <div className="thumb-stick" role="group" aria-label="Drag to walk. Arrow keys or direction buttons also work." aria-disabled={!playControlsEnabled}
                  onPointerDown={startThumb} onPointerMove={steerThumb} onPointerUp={releaseMovement} onPointerCancel={releaseMovement} onLostPointerCapture={releaseMovement}>
                  <span className="thumb-compass" aria-hidden="true">✧</span><span className="thumb-grip" ref={thumbRef} aria-hidden="true" />
                </div>}
                <button type="button" className="touch-mode-toggle" onClick={() => { cancelMovement(); setDirectionButtons(value => !value); }}>{directionButtons ? 'Use joystick' : 'Use buttons'}</button>
              </div>}
              {!freeControls && <div className="keyboard-hint"><span className="key-group"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span>Wander<small>or click the ground</small></span></div>}
              {journalMode ? <div className="quick-actions">{actionButtons}{skillBar}</div> : actionButtons}
              {freeControls ? <AnalogStick label="LOOK" name="Camera joystick" axes={freeInput.look} enabled={playControlsEnabled} /> :
                <button className="help-button" onClick={() => setGuide(true)} aria-label="Open field guide"><BookOpen size={18} /></button>}
            </div>
            {!journalMode && skillBar}
            {!journalMode && inventoryPanel}
            {!journalMode && journeyPanel}
            {!journalMode && worldPanel}
          </section>

          {!journalMode && <aside className="social-column">{partyPanel}</aside>}
        </div>

        <footer><span><Leaf size={12} /> ELDRITCH FABLE · Legendary gear for stories yet to be told.</span><span>Your progress lives with your account. <span>✧</span></span></footer>
      </main>

      {journalMode && <AdventureJournal open={journalOpen && !landscapeBlocked} onClose={() => setJournalOpen(false)} pages={journalPages}
        onPageChange={scrollPartyChat} feedback={error ? <p className="journal-feedback" role="alert">{error}</p>
          : notice ? <p className="journal-feedback" role="status">{notice}</p> : null} />}
      <LandscapeGate active={journalMode} fullscreen={fullscreen} />
      <IntroCutscene open={introOpen} onComplete={completeIntro} />

      {appearanceOpen && me && !adminActive && <AppearanceEditor player={me} onSave={saveAppearance} onClose={() => setAppearanceOpen(false)} />}

      {(guide || leaving) && <div className="modal-backdrop" onClick={() => { setGuide(false); setLeaving(false); }}>
        <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}>
          <button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setGuide(false); setLeaving(false); }} autoFocus><X size={20} /></button>
          {leaving ? <>
            <LogOut size={28} /><h2 id="modal-title">Back to the everyday?</h2>
            <p>Leaving frees your seat for another adventurer. Your character, quest progress, and Secret Stash remain saved to your Eldritch Fable account.</p>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setLeaving(false)}>Keep exploring</button><button className="primary-button" onClick={() => void leaveRealm()}>Leave adventure</button></div>
          </> : <>
            <div className="eyebrow">A WAYFARER’S FIELD GUIDE</div><h2 id="modal-title">A little help for the road.</h2>
            <p>Each Mossvale party has room for eight signed-in adventurers and two visiting guardians. Choose an open party or a solo adventure. An open-party invitation leads to the same glade when a seat is available.</p>
            <div className="guide-steps">
              <div><Compass /><span><strong>Take the scenic route</strong><p>Click or tap the ground to walk. Use WASD, arrow keys, or drag the thumb control. Hold direction buttons to keep walking; release to stop. Switch between joystick and buttons beneath the map. Bridges cross water. Follow a marked crossing, then choose Travel to enter another region. Your party roster shows where everyone is.</p></span></div>
              <div><Sword /><span><strong>Be a guardian, together</strong><p>Walk near a thornling and press Attack or Space. Your calling determines weapon reach and starter skills. Use the skill cards or keys 1 and 2; their cooldowns keep combat paced. Visiting guardians have matching combat power and a healing boon, while normal positive contributors keep earning XP. Healing and wards help your company survive. Active contributors earn XP for their private Secret Stash.</p></span></div>
              <div><Gem /><span><strong>Follow the blue glow</strong><p>Stand beside two different moon crystals and press Interact or E. Then visit the shrine in the northeast and interact with it.</p></span></div>
              <div><Flame /><span><strong>There is always a way home</strong><p>Interact at camp to restore health. Complete all three objectives to claim 100 XP for your Secret Stash. Thornlings return after 20 seconds.</p></span></div>
            </div>
            <div className="guide-note">Your character and stash belong to your account and stay saved when you leave. Offline seats expire after 75 seconds. Exchange 1,250 XP for 1 gold, worth 100 silver or 1,000 copper, in your Secret Stash. Spending coins on gear opens when shop prices and checkout are connected.</div>
            <button className="primary-button" onClick={() => setGuide(false)}>Adventure awaits <ArrowUpRight size={16} /></button>
          </>}
        </section>
      </div>}
    </div></div>
  );
}

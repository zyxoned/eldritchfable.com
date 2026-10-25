import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check,
  ChevronRight, Compass, Flame, Gem, Leaf, LogOut, MessageCircle, Radio,
  RotateCw, Send, Shield, Sparkles, Sword, Users, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from './transport';
import {
  CLASSES, CRYSTALS, ENEMIES, SHRINE, WIDTH, HEIGHT, level, questReady, walkable,
  type HeroClass, type Realm,
} from './shared/game';
import GameCanvas from './GameCanvas';
import './game.css';

type Identity = {
  name: string;
  heroClass: HeroClass;
  joined: boolean;
};
type Profile = {
  playerId: string | null;
  active: boolean;
  balanceXp: number;
  balanceCopper?: number;
  lifetimeXp: number;
  character: Realm['players'][number] | null;
};
type Reply = { realm: Realm; profile: Profile; notice?: string; playerId?: string | null };

function readIdentity(userId: string): Identity {
  try {
    const old = JSON.parse(sessionStorage.getItem('eldritch-character-' + userId) || 'null');
    if (old && Object.prototype.hasOwnProperty.call(CLASSES, old.heroClass)) return old;
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

function nextStep(start: { x: number; y: number }, target: { x: number; y: number }) {
  const key = (x: number, y: number) => x + ',' + y;
  const queue = [{ ...start, first: null as { x: number; y: number } | null }];
  const seen = new Set([key(start.x, start.y)]);
  for (let i = 0; i < queue.length && i < WIDTH * HEIGHT; i++) {
    const current = queue[i];
    if (current.x === target.x && current.y === target.y) return current.first;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (!walkable(x, y) || seen.has(key(x, y))) continue;
      seen.add(key(x, y));
      queue.push({ x, y, first: current.first || { x, y } });
    }
  }
  return null;
}

function PixelHero({ heroClass = 'ranger', empty = false, large = false }: {
  heroClass?: HeroClass; empty?: boolean; large?: boolean;
}) {
  const color = empty ? '#b8bbaa' : CLASSES[heroClass].color;
  return (
    <svg className={large ? 'pixel-hero large' : 'pixel-hero'} viewBox="0 0 32 38" aria-hidden="true">
      <path fill="#233f34" opacity=".16" d="M4 32h24v5H4z" />
      <path fill={empty ? '#a3aa99' : '#314b3a'} d="M8 26h6v9H8zm11 0h6v9h-6z" />
      <path fill={color} d="M7 16h19v14H7zM8 5h17v15H8zM4 10h25v7H4z" />
      <path fill={empty ? '#dedfce' : '#f0cf9e'} d="M12 13h12v8H12z" />
      <path fill="#2c4937" d="M14 15h2v2h-2zm7 0h2v2h-2z" />
      <path fill="#e9ddad" d="M8 25h17v3H8z" />
      {!empty && <path fill="#8b704c" d="M28 8h2v25h-2z" />}
    </svg>
  );
}

export default function Mossvale({ user, onSessionExpired }: {
  user: { id: string };
  onSessionExpired: () => void;
}) {
  const [identity] = useState(() => readIdentity(user.id));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState(identity.name);
  const [heroClass, setHeroClass] = useState<HeroClass>(identity.heroClass);
  const [realm, setRealm] = useState<Realm | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [chat, setChat] = useState('');
  const [guide, setGuide] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [socketEpoch, setSocketEpoch] = useState(0);
  const realmRef = useRef<Realm | null>(null);
  const playerRef = useRef<string | null>(null);
  const destination = useRef<{ x: number; y: number } | null>(null);
  const busy = useRef(false);
  const resumed = useRef(false);
  const messages = useRef<HTMLDivElement>(null);
  const actRef = useRef<(kind: string, extra?: Record<string, unknown>) => Promise<boolean>>(async () => false);
  playerRef.current = playerId;
  const me = realm?.players.find(p => p.id === playerId);
  const count = realm?.players.length || 0;

  function applyRealm(next: Realm) {
    if (!realmRef.current || next.revision >= realmRef.current.revision) {
      realmRef.current = next;
      setRealm(next);
    }
  }

  function applyReply(data: Reply) {
    if (realmRef.current && data.realm.revision < realmRef.current.revision) return;
    applyRealm(data.realm);
    setProfile(data.profile);
    setPlayerId(data.profile?.active ? data.profile.playerId : null);
  }

  function envelope(extra: Record<string, unknown> = {}) {
    return { requestId: crypto.randomUUID(), ...extra };
  }

  useEffect(() => {
    let active = true;
    const events = new EventSource('/api/game/events', { withCredentials: true });
    events.addEventListener('realm', event => {
      if (!active) return;
      try { applyRealm(JSON.parse((event as MessageEvent).data)); }
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
      try {
        const result = await api.get('/api/game/world');
        if (!active) return;
        applyReply(result.data);
        const saved = result.data.profile?.character;
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

  useEffect(() => {
    if (messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, [realm?.messages.length]);

  async function joinRealm(resume = false) {
    if (joining) return;
    const chosenName = resume ? identity.name : name.trim();
    const chosenClass = resume ? identity.heroClass : heroClass;
    if (!/^[a-zA-Z0-9 _-]{2,16}$/.test(chosenName)) {
      setError('Use 2–16 letters, numbers, spaces, dashes or underscores for your name.');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const result = await api.post('/api/game/join', envelope({ name: chosenName, heroClass: chosenClass }));
      const data = result.data as Reply;
      applyReply(data);
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
    if (connected && identity.joined && !resumed.current) {
      resumed.current = true;
      void joinRealm(true);
    }
  }, [connected]);

  function endSession() {
    setPlayerId(null);
    playerRef.current = null;
    destination.current = null;
    identity.joined = false;
    saveIdentity(identity, user.id);
  }

  useEffect(() => {
    if (!playerId || !connected) return;
    const timer = window.setInterval(async () => {
      try {
        const result = await api.post('/api/game/heartbeat', envelope());
        applyReply(result.data);
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 401) { endSession(); onSessionExpired(); }
        setError(errorMessage(err));
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [playerId, connected]);

  async function act(kind: string, extra: Record<string, unknown> = {}) {
    if (!playerRef.current || !connected || busy.current) return false;
    busy.current = true;
    if (kind !== 'move') destination.current = null;
    try {
      const result = await api.post('/api/game/action', envelope({ kind, ...extra }));
      applyReply(result.data);
      if (result.data.notice) setNotice(result.data.notice);
      setError('');
      return true;
    } catch (err) {
      destination.current = null;
      if ((err as { response?: { status?: number } }).response?.status === 401) {
        endSession(); onSessionExpired();
      } else if ((err as { code?: string }).code === 'SEAT_EXPIRED') {
        endSession();
      }
      setError(errorMessage(err));
      return false;
    } finally {
      busy.current = false;
    }
  }
  actRef.current = act;

  useEffect(() => {
    const timer = window.setInterval(() => {
      const target = destination.current;
      const p = realmRef.current?.players.find(v => v.id === playerRef.current);
      if (!target || !p || busy.current) return;
      const step = nextStep(p, target);
      if (!step) { destination.current = null; return; }
      void actRef.current('move', step);
    }, 230);
    return () => window.clearInterval(timer);
  }, []);

  function go(x: number, y: number) {
    if (!me) { setNotice('Choose a name and enter the glade to start exploring.'); return; }
    if (!connected) { setError('Reconnect to move through the glade.'); return; }
    if (!walkable(x, y)) { setNotice('Use the wooden bridge to cross the brook.'); return; }
    destination.current = { x, y };
  }

  function move(dx: number, dy: number) {
    const p = realmRef.current?.players.find(v => v.id === playerRef.current);
    if (p) {
      destination.current = null;
      if (walkable(p.x + dx, p.y + dy)) void actRef.current('move', { x: p.x + dx, y: p.y + dy });
    }
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || guide || leaving) return;
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
      };
      if (directions[event.key]) {
        event.preventDefault();
        move(...directions[event.key]);
      } else if (event.code === 'Space' && target.tagName !== 'BUTTON') {
        event.preventDefault();
        void actRef.current('attack');
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        void actRef.current('interact');
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [guide, leaving]);

  useEffect(() => {
    if (!guide && !leaving) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setGuide(false); setLeaving(false); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [guide, leaving]);

  async function leaveRealm() {
    try {
      const result = await api.post('/api/game/leave', envelope());
      applyReply(result.data);
      endSession();
      setLeaving(false);
      setNotice('See you by the campfire. Your seat is now free.');
    } catch (err) { setError(errorMessage(err)); }
  }

  const canAct = !!me && connected;
  const questDone = me ? questReady(me) : false;
  const trackEnemy = () => {
    const enemy = realm?.enemies.find(e => e.hp > 0) || ENEMIES[0];
    go(enemy.x, enemy.y);
  };
  const trackCrystal = () => {
    const crystal = CRYSTALS.find(c => !me?.gathered.includes(c.id)) || CRYSTALS[0];
    go(crystal.x, crystal.y);
  };

  return (
    <div className="ef-rpg"><div className="site-shell">
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
            <div className="eyebrow"><span /> ELDRITCH FABLE · SIX-PLAYER ADVENTURE</div>
            <h1>Enter the fable. <em>Bring back a legend.</em></h1>
            <p>Six adventurers. One shared realm. Earn XP and build your private Secret Stash.</p>
          </div>
          <div className="chapter"><span>CHAPTER 01</span><strong>The waking woods</strong><small>Your account. Your continuing story.</small></div>
        </section>

        {error && <div className="error-banner" role="alert">
          <span>{error}</span>
          {!connected && <button onClick={() => { setLoading(true); setSocketEpoch(v => v + 1); }}>Reconnect <RotateCw size={14} /></button>}
          <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button>
        </div>}

        <div className="game-layout">
          <aside className="adventurer-column">
            <section className="card character-card">
              <div className="section-kicker">YOUR ADVENTURER <span>01</span></div>
              {me ? <>
                <div className="active-hero">
                  <div className="portrait"><PixelHero heroClass={me.heroClass} large /><span className="portrait-spark">✧</span></div>
                  <h2>{me.name}</h2>
                  <p>Level {level(me.xp)} {CLASSES[me.heroClass].name}</p>
                </div>
                <div className="stat-label"><span><span className="health-dot" /> Health</span><strong>{me.hp} / 100</strong></div>
                <div className="progress health"><span style={{ width: me.hp + '%' }} /></div>
                <div className="stat-label"><span>Next level</span><strong>{me.xp % 100} / 100 XP</strong></div>
                <div className="progress xp"><span style={{ width: me.xp % 100 + '%' }} /></div>
                <Link to="/stash" className="gold-line"><Gem size={14} /> {profile?.balanceXp || 0}<span>Secret Stash · XP</span><ArrowUpRight size={12} /></Link>
                <button className="leave-button" onClick={() => setLeaving(true)}><LogOut size={13} /> Leave realm</button>
              </> : <>
                <div className="welcome-hero"><div className="portrait"><PixelHero heroClass={heroClass} large /><span className="portrait-spark">✧</span></div><h2>Your story starts here.</h2><p>Make yourself a little legend.</p></div>
                <form onSubmit={event => { event.preventDefault(); void joinRealm(); }} noValidate>
                  <label className="field-label" htmlFor="hero-name">Adventurer name</label>
                  <input id="hero-name" readOnly={!!profile?.character} value={name} maxLength={16} placeholder="What shall we call you?" onChange={event => setName(event.target.value)} autoComplete="off" />
                  <span className="field-label choose-label">Choose your calling</span>
                  <div className="class-options">
                    {(Object.keys(CLASSES) as HeroClass[]).map(value => <button type="button" key={value} className={heroClass === value ? 'class-option selected' : 'class-option'} disabled={!!profile?.character} aria-pressed={heroClass === value} onClick={() => setHeroClass(value)} title={CLASSES[value].description}>
                      <PixelHero heroClass={value} /><span>{CLASSES[value].name}</span>
                    </button>)}
                  </div>
                  <button className="primary-button enter-button" type="submit" disabled={!connected || joining}>
                    {joining ? 'Entering the glade…' : loading ? 'Connecting…' : count >= 6 ? 'Realm full · Try again' : 'Enter the glade'} <ArrowUpRight size={17} />
                  </button>
                  <div className="join-note"><Shield size={11} /> Account linked. Character and XP saved.</div>
                </form>
              </>}
            </section>

            <section className="card quest-card">
              <div className="section-kicker"><span className="kicker-with-icon"><Compass size={14} /> YOUR FIRST ADVENTURE</span></div>
              <h2>Guardian of the Glade</h2>
              <p>The woods could use a helping hand.</p>
              <div className="quest-list">
                <button onClick={trackEnemy}><span className={'quest-icon ' + ((me?.kills || 0) >= 3 ? 'complete' : '')}>{(me?.kills || 0) >= 3 ? <Check size={15} /> : <Sword size={15} />}</span><span>Clear thornlings<small>Shared with your party</small></span><b>{Math.min(me?.kills || 0, 3)}/3</b><ChevronRight size={12} /></button>
                <button onClick={trackCrystal}><span className={'quest-icon ' + ((me?.gathered.length || 0) >= 2 ? 'complete' : '')}>{(me?.gathered.length || 0) >= 2 ? <Check size={15} /> : <Gem size={15} />}</span><span>Gather moon crystals<small>Find the blue glow</small></span><b>{Math.min(me?.gathered.length || 0, 2)}/2</b><ChevronRight size={12} /></button>
                <button onClick={() => go(SHRINE.x, SHRINE.y)}><span className={'quest-icon ' + (me?.shrine ? 'complete' : '')}>{me?.shrine ? <Check size={15} /> : <Sparkles size={15} />}</span><span>Visit the old shrine<small>A little magic awaits</small></span><b>{me?.shrine ? '1' : '0'}/1</b><ChevronRight size={12} /></button>
              </div>
              <div className="reward"><span>✧</span><span>100 XP <i>→</i> Secret Stash</span><small>QUEST REWARD</small></div>
              {me && <button className="claim-button" disabled={!questDone || me.claimed} onClick={() => void act('claim')}>{me.claimed ? 'Adventure complete ✓' : questDone ? 'Claim your reward' : 'Complete the three objectives'}</button>}
              <p className="tracking-hint">Tap an objective to walk there.</p>
            </section>
          </aside>

          <section className="world-column" aria-label="Game world">
            <div className="world-card">
              <div className="world-heading">
                <div><div className="section-kicker">ELDRITCH FABLE · REALM 01</div><h2>Whispering Glade</h2></div>
                <div className={'live-pill ' + (connected ? '' : 'offline')}><span /> {connected ? 'LIVE' : loading ? 'CONNECTING' : 'OFFLINE'}<i />{count}/6 <Users size={13} /></div>
              </div>
              <div className="canvas-container">
                <GameCanvas realm={realm} playerId={playerId} onTile={go} />
                {!me && <div className="world-invitation"><span className="invite-icon"><Leaf size={15} /></span><div>The glade is waiting.<small>Choose your adventurer to step inside.</small></div><span>✧</span></div>}
                {notice && <div className="game-notice" role="status">{notice}</div>}
                <span className="map-corner">THE EMERALD WILDS</span>
              </div>
              <div className="map-caption"><span><span className="sun-dot" /> A good day for a little adventure.</span><span>{me ? me.x + ', ' + me.y : '30 × 22'} <Compass size={12} /></span></div>
            </div>
            <div className="controls-card">
              <div className="keyboard-hint"><span className="key-group"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span>Wander<small>or click the ground</small></span></div>
              <div className="action-buttons">
                <button aria-label="Attack" className="attack-button" disabled={!canAct} onClick={() => void act('attack')}><Sword size={17} /><span>Attack</span><kbd>SPACE</kbd></button>
                <button aria-label="Interact" className="interact-button" disabled={!canAct} onClick={() => void act('interact')}><Sparkles size={17} /><span>Interact</span><kbd>E</kbd></button>
              </div>
              <button className="help-button" onClick={() => setGuide(true)} aria-label="Open field guide"><BookOpen size={18} /></button>
            </div>
            <div className="mobile-controls" aria-label="Touch movement controls">
              <button aria-label="Move west" disabled={!canAct} onClick={() => move(-1, 0)}><ArrowLeft size={19} /></button>
              <button aria-label="Move north" disabled={!canAct} onClick={() => move(0, -1)}><ArrowUp size={19} /></button>
              <button aria-label="Move south" disabled={!canAct} onClick={() => move(0, 1)}><ArrowDown size={19} /></button>
              <button aria-label="Move east" disabled={!canAct} onClick={() => move(1, 0)}><ArrowRight size={19} /></button>
              <span>Tap to wander</span>
            </div>
            <div className="world-legend"><span><span className="legend-swatch hero-swatch" /> Adventurers</span><span><span className="legend-swatch enemy-swatch" /> Thornlings</span><span><Gem size={11} color="#749cad" /> Moon crystals</span><span><Flame size={12} color="#b98658" /> Rest at camp</span></div>
          </section>

          <aside className="social-column">
            <section className="card party-card">
              <div className="section-kicker"><span className="kicker-with-icon"><Users size={14} /> THE COMPANY YOU KEEP</span></div>
              <div className="party-title"><h2>Your party</h2><span>{count}<i>/6</i></span></div>
              <p>A shared world is a better world.</p>
              <div className="party-slots">
                {Array.from({ length: 6 }, (_, i) => {
                  const player = realm?.players[i];
                  return <div key={player?.id || i} className={'party-slot ' + (player ? 'occupied' : '')}>
                    <div className="slot-avatar"><PixelHero heroClass={player?.heroClass} empty={!player} /></div>
                    <div>{player ? <><strong>{player.name}</strong><small>{player.id === playerId ? 'You · ' : ''}Lv. {level(player.xp)} {CLASSES[player.heroClass].name}</small></> : <><strong>Open seat</strong><small>A friend belongs here</small></>}</div>
                    {player ? <span className="online-dot" /> : <span className="seat-number">0{i + 1}</span>}
                  </div>;
                })}
              </div>
              <button className="invite-button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setNotice('Invite link copied. Send it to your party!');
                } catch { setNotice('Invite friends by sharing this page’s URL.'); }
              }}><span>Invite a friend</span><ArrowUpRight size={15} /></button>
              <small className="party-footnote">One world. Up to six real players.</small>
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
          </aside>
        </div>

        <footer><span><Leaf size={12} /> ELDRITCH FABLE · Legendary gear for stories yet to be told.</span><span>Your progress lives with your account. <span>✧</span></span></footer>
      </main>

      {(guide || leaving) && <div className="modal-backdrop" onClick={() => { setGuide(false); setLeaving(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}>
          <button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setGuide(false); setLeaving(false); }} autoFocus><X size={20} /></button>
          {leaving ? <>
            <LogOut size={28} /><h2 id="modal-title">Back to the everyday?</h2>
            <p>Leaving frees your seat for another adventurer. Your character, quest progress, and Secret Stash remain saved to your Eldritch Fable account.</p>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setLeaving(false)}>Keep exploring</button><button className="primary-button" onClick={() => void leaveRealm()}>Leave adventure</button></div>
          </> : <>
            <div className="eyebrow">A WAYFARER’S FIELD GUIDE</div><h2 id="modal-title">A little help for the road.</h2>
            <p>Mossvale is Eldritch Fable’s live realm for six signed-in adventurers. Share the page link and meet your party by the campfire.</p>
            <div className="guide-steps">
              <div><Compass /><span><strong>Take the scenic route</strong><p>Click or tap the ground to walk. Use WASD, arrow keys, or the touch buttons. The wooden bridge crosses the brook.</p></span></div>
              <div><Sword /><span><strong>Be a guardian, together</strong><p>Walk near a green thornling and press Attack or Space. Rangers and mages reach 3 tiles; knights reach 2. Active adventurers who contribute to a fight earn XP. Every awarded XP also goes into your private Secret Stash.</p></span></div>
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
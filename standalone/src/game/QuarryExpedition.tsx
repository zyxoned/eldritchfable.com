import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, Footprints, Heart, Link as LinkIcon, MapPin, Shield, Volume2, VolumeX } from 'lucide-react';
import { drawQuarryActor } from './quarry-actors.mjs';
import { drawQuarryScene, drawQuarryForeground } from './quarry-scenes.mjs';
import './quarry-expedition.css';

type Tile = { x: number; y: number };
type Actor = Tile & { id: string; name: string; heroClass: string; appearance?: object; lastStrike?: number; lastMove?: number };
type Tone = 'low' | 'mid' | 'high';
type Scene = 'market' | 'gate' | 'deep';
export type QuarryView = Tile & {
  scene: Scene; title: string; actors: Actor[]; npc: (Tile & { working: boolean }) | null;
  foe: (Tile & { hp: number; maxHp: number; windupUntil: number }) | null;
  opened: boolean; primed: boolean; progress: number; tune: Tone[] | null; reward: boolean;
  owned: boolean; equipped: boolean; skill: boolean; completed: boolean; hp: number; maxHp: number;
  level: number; journal: string[];
};
type Command = { verb: string; label: string; tile?: Tile; note?: Tone; range?: number };
type Props = {
  quarry: QuarryView; playerId: string; heroName: string; connected: boolean; canPlay: boolean;
  partyId: string | null; send: (verb: string, extra?: Record<string, unknown>) => Promise<boolean>;
  serverTime?: number; notice: string; error: string; reconnect: () => void;
};
type Camera = { left: number; top: number; zoom: number };
type Intent = { scene: Scene; tile: Tile; command?: Command };
type Flash = { id: string; action: string; until: number };
const tones: Tone[] = ['low', 'mid', 'high'];
const toneName = { low: 'Low', mid: 'Middle', high: 'High' };
const at = (x: number, y = 2): Tile => ({ x, y });
const foot = (p: Tile): Tile => ({ x: 80 + 70 * p.x, y: 360 + 40 * p.y });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
const caption = { market: 'Market road', gate: 'Gate passage', deep: 'Far landing' };
const limit = (p: Tile): Tile => at(clamp(p.x, 0, 12), clamp(p.y, 0, 4));

function availableActions(q: QuarryView): Command[] {
  if (q.scene === 'market') return [
    ...(q.npc ? [{ verb: 'talk', label: 'Visit the bell repairer', tile: q.npc }] : []),
    { verb: 'travel', label: 'Take the road to Resonant Gate', tile: at(11) },
  ];
  if (q.scene === 'deep') return [
    ...(q.skill ? [{ verb: 'pulse', label: 'Use Resonant Pulse', tile: at(9), range: q.equipped ? 3 : 1 }] : []),
    { verb: 'return', label: 'Ride the counterweight', tile: at(9) },
  ];
  const actions: Command[] = [];
  if (q.foe && q.foe.hp > 0) actions.push({ verb: 'strike', label: 'Strike the quarry crawler', tile: q.foe, range: 2 });
  if (q.reward) actions.push({ verb: 'claim', label: 'Claim the crawler drop', tile: q.foe ?? at(4) });
  actions.push({ verb: 'listen', label: 'Listen to the quarry pumps', tile: at(6) });
  if (q.opened) actions.push({ verb: 'descend', label: 'Board the freight lift', tile: at(11) });
  actions.push({ verb: 'back', label: 'Return along the market road', tile: at(1) });
  return actions;
}
function cameraFor(w: number, h: number, position: Tile): Camera {
  const zoom = Math.max(w / 1000, h / 600, w < 600 ? Math.min(.84, h / 380) : 0);
  return {
    zoom, left: clamp(position.x - w / zoom / 2, 0, Math.max(0, 1000 - w / zoom)),
    top: clamp(385 - h / zoom / 2, 0, Math.max(0, 600 - h / zoom)),
  };
}
function actorVariant(id: string) {
  let value = 0;
  for (const ch of id) value = ((31 * value) + ch.charCodeAt(0)) | 0;
  return Math.abs(value % 2);
}
function direction(dx: number, dy: number) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function QuarryField({ quarry, playerId, serverTime, flash, intent, onWalk, onChoose }: {
  quarry: QuarryView; playerId: string; serverTime: number; flash: Flash | null; intent: Intent | null;
  onWalk: (tile: Tile) => void; onChoose: (command: Command) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef<Camera>({ left: 0, top: 0, zoom: 1 });
  const view = useRef({ quarry, playerId, serverTime, received: performance.now(), flash, intent });
  const changedClock = view.current.serverTime !== serverTime;
  view.current = { quarry, playerId, serverTime, received: changedClock ? performance.now() : view.current.received, flash, intent };

  useEffect(() => {
    const el = canvas.current;
    const c = el?.getContext('2d', { alpha: false });
    if (!el || !c) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const poses = new Map<string, Tile & { tileX: number; tileY: number; facing: string; moving: boolean }>();
    let last = 0, frame = 0, prevScene = '', w = 0, h = 0, dpr = 1;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      w = rect.width; h = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(w * dpr)); el.height = Math.max(1, Math.round(h * dpr));
    };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    function paint(now: number) {
      frame = requestAnimationFrame(paint);
      if (!c || !w || !h || document.hidden || now - last < 30) return;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const { quarry: q, playerId: self, serverTime: clock, received, flash: effect, intent: destination } = view.current;
      if (prevScene !== q.scene) { poses.clear(); prevScene = q.scene; }
      const localTime = reduced.matches ? 0 : now / 1000;
      const serverNow = clock + now - received;
      // Keep a shared tile readable without changing either hero's authoritative position.
      const tiles = new Map<string, string[]>();
      for (const a of q.actors) {
        const tileKey = a.x + ',' + a.y;
        const ids = tiles.get(tileKey);
        if (ids) ids.push(a.id); else tiles.set(tileKey, [a.id]);
      }
      for (const ids of tiles.values()) ids.sort();
      const figures = q.actors.map(a => {
        const mates = tiles.get(a.x + ',' + a.y)!;
        const slot = mates.indexOf(a.id);
        const angle = (2 * Math.PI * slot) / mates.length + Math.PI;
        const spread = mates.length < 2 ? at(0, 0) : at(Math.cos(angle) * 22, Math.sin(angle) * 9);
        const sinceStrike = serverNow - (a.lastStrike ?? 0);
        return { key: a.id, pos: a as Tile, kind: 'hero', label: a.name, classId: a.heroClass, appearance: a.appearance, spread,
          action: sinceStrike >= 0 && sinceStrike < 500 ? 'attack' : 'idle' };
      });
      if (q.npc) figures.push({ key: '@smith', pos: q.npc, kind: 'smith', label: 'Bell repairer', classId: '', appearance: undefined, spread: at(0, 0), action: q.npc.working ? 'work' : 'idle' });
      if (q.foe) figures.push({ key: '@crawler', pos: q.foe, kind: 'crawler', label: '', classId: '', appearance: undefined, spread: at(0, 0),
        action: q.foe.hp <= 0 ? 'dead' : q.foe.windupUntil > serverNow ? 'windup' : 'idle' });
      for (const actor of figures) {
        const dest = foot(actor.pos);
        dest.x += actor.spread.x; dest.y += actor.spread.y;
        const pose = poses.get(actor.key) ?? { ...dest, tileX: actor.pos.x, tileY: actor.pos.y, facing: actor.kind === 'crawler' ? 'left' : 'right', moving: false };
        if (pose.tileX !== actor.pos.x || pose.tileY !== actor.pos.y) {
          pose.facing = direction(actor.pos.x - pose.tileX, actor.pos.y - pose.tileY);
          pose.tileX = actor.pos.x; pose.tileY = actor.pos.y; pose.moving = true;
        }
        const dx = dest.x - pose.x, dy = dest.y - pose.y;
        if (Math.hypot(dx, dy) <= 1.5) pose.moving = false;
        const rate = reduced.matches ? 1 : 1 - Math.exp(-16 * dt);
        pose.x += dx * rate; pose.y += dy * rate;
        poses.set(actor.key, pose);
      }
      for (const key of poses.keys()) if (!figures.some(a => a.key === key)) poses.delete(key);
      const cam = cameraFor(w, h, poses.get(self) ?? foot(q)); camera.current = cam;
      c.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, -cam.left * dpr * cam.zoom, -cam.top * dpr * cam.zoom);
      const painted = drawQuarryScene(c, q.scene, localTime, q);
      if (el) {
        const scene = painted ? q.scene : '';
        if (el.dataset.paintedScene !== scene) el.dataset.paintedScene = scene;
        if (el.dataset.painted !== String(painted)) el.dataset.painted = String(painted);
      }
      if (destination && destination.scene === q.scene) {
        const p = foot(destination.tile);
        c.strokeStyle = '#ffe3a6'; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(p.x, p.y, 15, 5, 0, 0, Math.PI * 2); c.stroke();
      }
      figures.sort((a, b) => (poses.get(a.key)!.y - poses.get(b.key)!.y) || a.pos.x - b.pos.x);
      for (const actor of figures) {
        const p = poses.get(actor.key)!;
        const isMe = actor.key === self;
        if (isMe || actor.action === 'windup') {
          c.strokeStyle = isMe ? '#e6c182' : '#ff936f'; c.lineWidth = 2;
          c.beginPath(); c.ellipse(p.x, p.y, isMe ? 13 : 56, isMe ? 5 : 18, 0, 0, Math.PI * 2); c.stroke();
        }
        drawQuarryActor(c, { kind: actor.kind, x: p.x, y: p.y, facing: p.facing, time: localTime,
          action: effect?.id === actor.key && effect.until > now ? effect.action : actor.action === 'attack' ? 'attack' : p.moving ? 'walk' : actor.action,
          classId: actor.classId, appearance: actor.appearance, variant: actorVariant(actor.key) });
        if (actor.label) {
          c.save(); c.textAlign = actor.spread.x < -10 ? 'right' : actor.spread.x > 10 ? 'left' : 'center'; c.font = 'bold 12px Georgia, serif'; c.lineWidth = 3;
          c.strokeStyle = '#171315'; c.strokeText(actor.label, p.x, p.y - 81);
          c.fillStyle = isMe ? '#fff1cd' : '#e6dfc9'; c.fillText(actor.label, p.x, p.y - 81); c.restore();
        }
      }
      drawQuarryForeground(c, q.scene, localTime, q);
    }
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect(), cam = camera.current;
    const px = (event.clientX - rect.left) / cam.zoom + cam.left, py = (event.clientY - rect.top) / cam.zoom + cam.top;
    const picks = availableActions(quarry).filter(a => a.tile && a.verb !== 'back').map(a => ({ a, p: foot(a.tile!) }));
    const pick = picks.find(({ p }) => Math.abs(px - p.x) < 30 && py <= p.y + 7 && py >= p.y - 68);
    if (pick) { onChoose(pick.a); return; }
    if (py < 335 || py > 552) return;
    onWalk(limit(at(Math.round((px - 80) / 70), Math.round((py - 360) / 40))));
  }
  return <canvas ref={canvas} className="quarry-field" aria-label="Expedition playfield; tap the ground or use arrow keys to walk"
    tabIndex={0} onPointerUp={point} />;
}
export default function QuarryExpedition(props: Props) {
  const { quarry: q, playerId, heroName, canPlay, connected, error, notice, partyId, reconnect } = props;
  const [intent, setIntentState] = useState<Intent | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [sound, setSound] = useState(true);
  const [copied, setCopied] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const live = useRef(props); live.current = props;
  const goal = useRef<Intent | null>(null);
  const held = useRef<Tile | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const soundOn = useRef(sound); soundOn.current = sound;
  const audio = useRef<AudioContext | null>(null);
  const pendingScore = useRef(false);
  const lastStep = useRef(0);
  const actions = availableActions(q);
  const setGoal = (next: Intent | null) => { goal.current = next; setIntentState(next); };
  const halt = () => { held.current = null; setGoal(null); };
  function unlockAudio() {
    if (!soundOn.current || !window.AudioContext) return;
    try {
      if (!audio.current) audio.current = new AudioContext();
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
    } catch { /* Visual score and controls work independently of audio output. */ }
  }
  function chime(notes: Tone[]) {
    const ctx = audio.current;
    if (!soundOn.current || !ctx || ctx.state !== 'running') return;
    notes.forEach((n, i) => {
      const start = ctx.currentTime + .03 + i * .52;
      const hz = { low: 196, mid: 293.66, high: 392 }[n];
      [1, 2.46, 3.01].forEach((multiple, j) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = hz * multiple;
        gain.gain.setValueAtTime(.001, start); gain.gain.exponentialRampToValueAtTime(.078 / (j + 1), start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + 1.4 / (j + 1));
        osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + 1.5);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      });
    });
  }
  async function perform(cmd: Command) {
    if (busy.current || !live.current.canPlay) return;
    busy.current = true;
    try {
      const ok = await live.current.send(cmd.verb, cmd.note ? { note: cmd.note } : undefined);
      if (!active.current || !ok) return;
      if (cmd.verb === 'strike' || cmd.verb === 'pulse' || cmd.verb === 'ring') {
        setFlash({ id: live.current.playerId, action: cmd.verb === 'strike' ? 'attack' : 'skill', until: performance.now() + 470 });
      }
      if (cmd.note) chime([cmd.note]);
      if (cmd.verb === 'listen' || cmd.verb === 'talk') {
        if (live.current.quarry.tune) chime(live.current.quarry.tune);
        else pendingScore.current = true;
      }
    } finally { busy.current = false; }
  }
  useEffect(() => {
    if (pendingScore.current && q.tune) { pendingScore.current = false; chime(q.tune); }
  }, [q.tune]);
  useEffect(() => {
    active.current = true;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
    return () => { active.current = false; if (audio.current) { void audio.current.close().catch(() => {}); audio.current = null; } };
  }, []);
  useEffect(() => {
    halt(); pendingScore.current = false;
  }, [q.scene, playerId, connected]);

  function choose(cmd: Command) {
    unlockAudio(); if (!live.current.canPlay || document.hidden) return;
    held.current = null;
    // Issuing an action at an already reached point always replaces any earlier route.
    if (!cmd.tile || distance(live.current.quarry, cmd.tile) <= (cmd.range ?? 1)) {
      setGoal(null); void perform(cmd);
    } else setGoal({ scene: q.scene, tile: cmd.tile, command: cmd });
  }
  function walk(tile: Tile) {
    if (!live.current.canPlay || document.hidden) return;
    held.current = null; setGoal({ scene: q.scene, tile: limit(tile) });
  }
  const tick = useRef<() => void>(() => {});
  tick.current = () => {
    if (!live.current.canPlay || busy.current || document.hidden) return;
    const state = live.current.quarry;
    let target: Tile;
    const route = goal.current, offset = held.current;
    if (offset) target = limit(at(state.x + offset.x, state.y + offset.y));
    else if (route?.scene === state.scene) {
      target = route.command?.verb === 'talk' && state.npc ? state.npc : route.tile;
      if (distance(state, target) <= (route.command ? route.command.range ?? 1 : 0)) {
        setGoal(null);
        if (route.command) void perform(route.command);
        return;
      }
    } else return;
    if (sameTile(target, state) || performance.now() - lastStep.current < 185) return;
    const dx = target.x - state.x, dy = target.y - state.y;
    const step = Math.abs(dx) >= Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) };
    lastStep.current = performance.now(); busy.current = true;
    void live.current.send('move', step).then(ok => {
      if (!ok && active.current && goal.current === route) halt();
    }).finally(() => { busy.current = false; });
  };
  useEffect(() => {
    const timer = window.setInterval(() => tick.current(), 65);
    const stop = () => halt();
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  function key(event: React.KeyboardEvent) {
    if (event.altKey || event.metaKey || event.ctrlKey || !canPlay) return;
    const k = event.key.toLowerCase();
    const directions: Record<string, Tile> = { arrowleft: at(-1,0), a: at(-1,0), arrowright: at(1,0), d: at(1,0),
      arrowup: at(0,-1), w: at(0,-1), arrowdown: at(0,1), s: at(0,1) };
    if (directions[k]) {
      event.preventDefault(); setGoal(null); held.current = directions[k]; tick.current(); return;
    }
    if (event.target instanceof HTMLElement && event.target.closest('button, a')) return;
    const attack = actions.find(a => a.verb === 'strike');
    if (k === ' ' && attack) { event.preventDefault(); if (!event.repeat) choose(attack); }
    if (k === 'escape') { event.preventDefault(); halt(); }
  }
  const actionButton = (cmd: Command) => <button type="button" key={cmd.verb} disabled={!canPlay}
    className={cmd.verb === 'strike' || cmd.verb === 'descend' ? 'quarry-command quarry-command-strong' : 'quarry-command'}
    data-quarry-action={cmd.verb} onClick={() => choose(cmd)}>{cmd.label}<ArrowUpRight size={15} aria-hidden="true" /></button>;
  const clock = props.serverTime ?? Date.now();
  async function invite() {
    const url = window.location.origin + '/play?party=' + encodeURIComponent(partyId!);
    try { await navigator.clipboard.writeText(url); setCopied('Party invitation copied.'); }
    catch { setCopied(url); }
  }
  return <main className="ef-quarry" onKeyDown={key} onKeyUp={e => {
    if (/^(arrow(left|right|up|down)|w|a|s|d)$/i.test(e.key)) held.current = null;
  }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) halt(); }}
    data-testid="quarry-scene" data-scene={q.scene} data-x={q.x} data-y={q.y}>
    <div className="quarry-wrap">
      <header className="quarry-mast">
        <div className="quarry-brand"><span className="quarry-seal" aria-hidden="true">✧</span><span>Eldritch Fable</span></div>
        <div className="quarry-header-actions">
          {partyId && <button type="button" onClick={invite}><LinkIcon size={15} /> Invite a companion</button>}
          <button type="button" data-quarry-action="leave" disabled={!canPlay} onClick={() => choose({ verb: 'leave', label: 'Leave expedition' })}><ArrowUpRight size={16} /> Leave expedition</button>
        </div>
      </header>
      {copied && <p role="status" className="quarry-feedback">{copied}</p>}
      <header className="quarry-title">
        <div><p className="quarry-folio"><MapPin size={13} aria-hidden="true" />{caption[q.scene]}</p>
          <h1 tabIndex={-1} ref={heading}>{q.title}</h1></div>
        <div className="quarry-self"><strong>{heroName}</strong><span>Level {q.level} <i>·</i> {q.actors.length} {q.actors.length === 1 ? 'hero' : 'heroes'} here</span></div>
      </header>
      {error && <div role="alert" className="quarry-warning">{error} {!connected && <button type="button" onClick={reconnect}>Reconnect</button>}</div>}
      <div className="quarry-layout">
        <div className="quarry-stage-column">
          <div className="quarry-frame">
            <QuarryField quarry={q} playerId={playerId} serverTime={clock} flash={flash} intent={intent} onWalk={walk} onChoose={choose} />
            <div className="quarry-stage-top"><span><Heart size={14} aria-hidden="true" />{q.hp} / {q.maxHp}</span>
              <button type="button" aria-pressed={sound} aria-label="Bell audio" onClick={() => {
                if (!sound) { soundOn.current = true; unlockAudio(); } setSound(!sound);
              }}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button></div>
            {q.foe && q.foe.hp > 0 && <div className="quarry-foe">
              <span>Quarry crawler <b>{q.foe.hp} / {q.foe.maxHp}</b></span><meter aria-label="Crawler health" min={0} max={q.foe.maxHp} value={q.foe.hp} />
              {q.foe.windupUntil > clock && <strong>Shell raised · move clear</strong>}
            </div>}
          </div>
          <nav className="quarry-walk" aria-label="Expedition movement">
            <span><Footprints size={17} aria-hidden="true" />Tap the ground or use arrow keys</span>
            <div>{([[-1,0,'west',ArrowLeft],[0,-1,'north',ArrowUp],[0,1,'south',ArrowDown],[1,0,'east',ArrowRight]] as const).map(([dx,dy,label,Icon]) =>
              <button type="button" key={label} disabled={!canPlay} aria-label={'Walk ' + label} onClick={() => walk(at(q.x+dx,q.y+dy))}><Icon size={17}/></button>)}</div>
          </nav>
          <div className="quarry-status" role="status">{intent ? 'Walking' + (intent.command ? ' · ' + intent.command.label : ' to the selected tile') : notice || ' '}</div>
          <section className="quarry-journal" aria-label="Expedition journal"><h2><BookOpen size={18} /> Field journal</h2>
            {q.journal.length ? <ul>{q.journal.map((entry,i) => <li key={i}>{entry}</li>)}</ul> : <p>Observations appear here as you explore.</p>}
          </section>
        </div>
        <aside className="quarry-side">
          <section aria-label="Scene actions"><h2>Explore</h2><div className="quarry-commands">{actions.map(actionButton)}</div></section>
          {q.scene === 'gate' && !q.opened && <section className="quarry-console" aria-label="Freight platform braces"><h2>Bronze braces</h2>
            <p>Each brace answers with a different pitch.</p>
            <div className="quarry-notes">{tones.map(n => <button key={n} type="button" disabled={!canPlay} data-quarry-note={n}
              aria-label={'Ring ' + toneName[n].toLowerCase()} onClick={() => choose({ verb:'ring', note:n, label:'Ring the ' + toneName[n].toLowerCase() + ' brace', tile:at(9) })}>{toneName[n]}</button>)}</div>
            <p aria-live="polite">{q.progress} / 3 braces resonating</p></section>}
          {q.tune && <section className="quarry-score"><h2>Sounding notes</h2>
            <ol aria-label="Learned tones">{q.tune.map((n,i) => <li key={i}>{toneName[n]}</li>)}</ol>
            <button type="button" className="quarry-link" onClick={() => {
              if (!sound) { soundOn.current = true; setSound(true); } unlockAudio();
              if (audio.current) void audio.current.resume().then(() => chime(q.tune!)).catch(() => {});
            }}>Play the notes <Volume2 size={14}/></button></section>}
          {(q.owned || q.skill) && <section className="quarry-kit"><h2>Expedition kit</h2>
            {q.owned && <div><p className="quarry-rarity"><Shield size={13} /> Rare · wrist</p><strong>Resonant Bracer</strong>
              <p>+2 armor. Extends Resonant Pulse from one tile to three.</p>
              {q.equipped ? <span className="quarry-equipped"><Check size={14} /> Equipped</span> :
                actionButton({ verb: 'equip', label: 'Equip Resonant Bracer' })}</div>}
            {q.skill && <div><strong>Resonant Pulse</strong><p>Channels a vibration into nearby machinery.</p></div>}
          </section>}
        </aside>
      </div>
    </div>
  </main>;
}

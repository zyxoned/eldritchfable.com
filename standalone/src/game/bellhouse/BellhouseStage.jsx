import { useEffect, useRef, useState } from 'react';
import { Bell, Compass, Heart, Sword } from 'lucide-react';
import * as THREE from 'three';
import { CLASS_CATALOG } from '../../../shared/class-catalog.mjs';
import { createActors, createCombatFx, worldPosition } from './actors';
import { disposeScene } from './materials';
import { BELL_LANDING, createWorld, UNIT } from './world';
import './bellhouse.css';

function toll() {
  if (!window.AudioContext) return;
  const audio = new window.AudioContext();
  const time = audio.currentTime;
  const mix = audio.createGain();
  mix.gain.value = .2;
  mix.connect(audio.destination);
  [116.5, 234.7, 318.9, 503].forEach((frequency, i) => {
    const voice = audio.createOscillator(), gain = audio.createGain();
    voice.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(.25 / (i + 1), time + .024);
    gain.gain.exponentialRampToValueAtTime(.0001, time + 3.3 - i * .56);
    voice.connect(gain).connect(mix);
    voice.start(time);
    voice.stop(time + 3.35);
    if (i === 0) voice.addEventListener('ended', () => { void audio.close().catch(() => {}); }, { once: true });
  });
  void audio.resume().catch(() => {});
}

export default function BellhouseStage({ realm, player, enabled, onGo, onHunt, fallback }) {
  const viewport = useRef(null);
  const latest = useRef({ realm, player, enabled, onGo });
  const ringTime = useRef(-Infinity);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rung, setRung] = useState(false);
  latest.current = { realm, player, enabled, onGo };

  useEffect(() => {
    const host = viewport.current;
    if (!host || failed) return;
    const small = matchMedia('(pointer: coarse), (max-width: 680px)').matches;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { antialias: !small, alpha: false, powerPreference: 'low-power' });
    if (!context) { setFailed(true); return; }
    let renderer, world, actors, fx;
    const scene = new THREE.Scene();
    try {
      renderer = new THREE.WebGLRenderer({ canvas, context });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.3 : 1.65));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.11;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      world = createWorld(scene, small);
      actors = createActors(scene);
      fx = createCombatFx(scene, world.glow);
    } catch {
      disposeScene(scene, true);
      renderer?.dispose();
      setFailed(true);
      return;
    }
    const camera = new THREE.PerspectiveCamera(46, 1, .15, 190);
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3(), aim = new THREE.Vector3(), eye = new THREE.Vector3(), focus = new THREE.Vector3();
    const fallbackPosition = new THREE.Vector3();
    let frame, started = false, down, previousTime = performance.now(), renderedAt = 0;
    const originTime = previousTime;
    let lastServerTime, serverOffset = 0;

    canvas.setAttribute('aria-label', '3D map of Bellhouse Ravine. Tap the path to walk or tap a thornling to approach.');
    canvas.dataset.renderer = 'webgl2';
    host.append(canvas);

    function resize() {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight, false);
    }

    function draw(now) {
      frame = requestAnimationFrame(draw);
      if (document.hidden || !host.clientWidth || (small && now - renderedAt < 31)) return;
      const step = Math.min(.065, Math.max(.001, (now - previousTime) / 1000));
      renderedAt = previousTime = now;
      const snapshot = latest.current, time = (now - originTime) / 1000;
      if (snapshot.realm?.serverTime !== lastServerTime) {
        lastServerTime = snapshot.realm?.serverTime;
        serverOffset = (lastServerTime || Date.now()) - Date.now();
      }
      const clock = Date.now() + serverOffset;
      const actor = actors.player(snapshot.player.id);
      const at = actor?.root.position ?? worldPosition(snapshot.player.x, snapshot.player.y, fallbackPosition);
      const zoom = camera.aspect < 1 ? 1 + (1 - camera.aspect) * .52 : 1;
      eye.set(at.x + 5.2 * zoom, at.y + 7.7 * zoom, at.z + 10.25 * zoom);
      aim.set(at.x - 1.68, at.y + 2.34, at.z - 2.4);
      const shift = !started || motion.matches ? 1 : 1 - Math.exp(-step * 9);
      camera.position.lerp(eye, shift);
      focus.lerp(aim, shift);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      actors.update(snapshot.realm, snapshot.player.id, camera, time, step, motion.matches, clock);
      world.update(motion.matches ? 0 : time, (now - ringTime.current) / 1000, motion.matches);
      fx(snapshot.realm?.effects, clock, motion.matches);
      renderer.render(scene, camera);
      if (!started) { started = true; setReady(true); }
    }

    function startPointer(event) {
      if (event.isPrimary && event.button === 0) down = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }

    function select(event) {
      const { player: active, onGo: move, enabled: canMove } = latest.current;
      const tap = down;
      down = null;
      if (!tap || tap.id !== event.pointerId || !canMove || Math.hypot(tap.x - event.clientX, tap.y - event.clientY) > 9) return;
      const bounds = canvas.getBoundingClientRect();
      pointer.set(2 * (event.clientX - bounds.left) / bounds.width - 1, 1 - 2 * (event.clientY - bounds.top) / bounds.height);
      raycaster.setFromCamera(pointer, camera);
      const foe = actors.enemyAt(raycaster.ray);
      if (foe) { move(foe.x, foe.y, CLASS_CATALOG[active.heroClass]?.range || 1); return; }
      if (raycaster.ray.intersectPlane(ground, hit)) move(Math.round(hit.x / UNIT), Math.round(hit.z / UNIT));
    }

    const cancelPointer = () => { down = null; };
    const contextLost = event => { event.preventDefault(); setFailed(true); };
    canvas.addEventListener('pointerdown', startPointer);
    canvas.addEventListener('pointerup', select);
    canvas.addEventListener('pointercancel', cancelPointer);
    canvas.addEventListener('webglcontextlost', contextLost);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', startPointer);
      canvas.removeEventListener('pointerup', select);
      canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.remove();
      disposeScene(scene, true);
      renderer.dispose();
    };
  }, [failed]);

  if (failed) return <div className="bellhouse-unavailable">{fallback}<p role="status">This browser could not start WebGL 2. You can continue in the classic view.</p></div>;
  const nearby = Math.hypot(player.x - BELL_LANDING.x, player.y - BELL_LANDING.y) <= 1.2;
  const maxHp = player.maxHp || 100;
  const hp = Math.max(0, Math.min(maxHp, player.hp));
  const calling = CLASS_CATALOG[player.heroClass]?.name;

  function ring() {
    if (!nearby || !enabled) return;
    ringTime.current = performance.now();
    setRung(true);
    try { toll(); } catch { /* The pulse and text carry the same cue without audio. */ }
  }

  return <div className="bellhouse-stage" data-ready={ready}>
    <div className="bellhouse-viewport" ref={viewport} />
    {!ready && <div className="bellhouse-loading" role="status">Lighting the ravine…</div>}
    <div className="bellhouse-hud">
      <div className="bellhouse-identity"><Heart size={13} aria-hidden="true" /><strong>{player.name}</strong><span>{calling}</span></div>
      <meter min={0} max={maxHp} value={hp} aria-label="Hero health" />
      <small>{hp} / {maxHp} HP</small>
    </div>
    <div className="bellhouse-title" aria-hidden="true"><Compass size={13} /> WHISPERING GLADE</div>
    <div className="bellhouse-objective">
      <div>
        <small>{rung ? 'THE HOLLOW KING' : 'BELLHOUSE RAVINE'}</small>
        <strong>{rung ? 'Something answered below.' : 'The bell beneath'}</strong>
        <p>{rung ? 'Follow the trail and confront a thornling.' : 'The watch vanished before the last toll.'}</p>
      </div>
      {rung
        ? <button type="button" disabled={!ready || !enabled} onClick={onHunt}><Sword size={17} /> Find a thornling</button>
        : <button type="button" disabled={!ready || !enabled} onClick={nearby ? ring : () => onGo(BELL_LANDING.x, BELL_LANDING.y)}><Bell size={17} /> {nearby ? 'Ring the bell' : 'Walk to bellhouse'}</button>}
    </div>
  </div>;
}

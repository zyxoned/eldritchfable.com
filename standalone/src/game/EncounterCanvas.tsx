import { useEffect, useRef } from 'react';
import { drawHero } from '../../shared/hero-renderer.mjs';
import { CLASSES, type HeroClass } from './shared/game';

type EncounterScene = { theme?: string; name: string };
type EncounterEnemy = { name: string; hp: number; maxHp: number };
type EncounterMember = { playerId: string; name: string; heroClass?: HeroClass; hp: number; maxHp: number };
const W = 960, H = 300, TAU = Math.PI * 2;
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = color; c.fill();
}
function bar(c: CanvasRenderingContext2D, x: number, y: number, width: number, hp: number, maxHp: number, color: string) {
  c.fillStyle = '#101820'; c.fillRect(x - width / 2 - 1, y - 1, width + 2, 7);
  c.fillStyle = '#36343c'; c.fillRect(x - width / 2, y, width, 5);
  c.fillStyle = color; c.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, hp / Math.max(1, maxHp))), 5);
}
function chamber(theme = '') {
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const c = layer.getContext('2d')!;
  const shade = /forest|garden|wood/i.test(theme) ? '#3d5549' : /water|coast|tide/i.test(theme) ? '#3f6472' : /sky|wind/i.test(theme) ? '#62637e' : '#55525b';
  const background = c.createLinearGradient(0, 0, 0, H);
  background.addColorStop(0, '#101620'); background.addColorStop(.6, shade); background.addColorStop(1, '#171c25');
  c.fillStyle = background; c.fillRect(0, 0, W, H);
  // Reusable public silhouettes, independent of route authoring.
  for (let i = 0; i < 9; i++) {
    const x = i * 128 - 28;
    c.fillStyle = i % 2 ? '#151d27b0' : '#26343c90'; c.fillRect(x, 15, 30, 155);
    c.fillStyle = '#a7a69b28'; c.fillRect(x + 3, 15, 3, 155);
    c.fillStyle = '#16222d'; c.fillRect(x - 6, 20, 42, 10); c.fillRect(x - 8, 163, 46, 13);
    c.strokeStyle = '#91998f33'; c.lineWidth = 7; c.beginPath(); c.arc(x + 79, 98, 55, Math.PI, 0); c.stroke();
  }
  const floor = c.createLinearGradient(0, 160, 0, H); floor.addColorStop(0, '#77736550'); floor.addColorStop(1, '#1b202c');
  c.fillStyle = floor; c.fillRect(0, 170, W, 130); c.strokeStyle = '#a7ad9c20'; c.lineWidth = 1;
  for (let i = -6; i <= 12; i++) { c.beginPath(); c.moveTo(W / 2 + i * 35, 170); c.lineTo(W / 2 + i * 135, H); c.stroke(); }
  for (const y of [181, 201, 232, 281]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  for (const x of [80, 600, 906]) {
    const glow = c.createRadialGradient(x, 105, 0, x, 105, 66);
    glow.addColorStop(0, '#dfc18b40'); glow.addColorStop(1, 'transparent'); c.fillStyle = glow; c.fillRect(x - 66, 39, 132, 132);
    c.fillStyle = '#151b25'; c.fillRect(x - 7, 83, 14, 25); c.fillStyle = '#d3bc82'; c.fillRect(x - 4, 87, 8, 17);
    c.fillStyle = '#e8d19c'; c.fillRect(x - 2, 91, 4, 10);
  }
  const vignette = c.createRadialGradient(W * .5, H * .5, 30, W * .5, H * .5, W * .6);
  vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#070c16c9'); c.fillStyle = vignette; c.fillRect(0, 0, W, H);
  return layer;
}
// Only the current earned scene is passed in. No route or enemy lists are bundled here.
export default function EncounterCanvas({ scene, enemy, members }: {
  scene: EncounterScene; enemy?: EncounterEnemy | null; members: EncounterMember[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ scene, enemy, members }); latest.current = { scene, enemy, members };
  useEffect(() => {
    const canvas = ref.current, c = canvas?.getContext('2d'); if (!canvas || !c) return;
    const ratio = Math.min(1.5, window.devicePixelRatio || 1); canvas.width = W * ratio; canvas.height = H * ratio;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let layer: HTMLCanvasElement | null = null, paintedTheme = '', frame = 0, lastFrame = 0;
    let visible = !document.hidden, enemyName = '', previousHp = 0, hitAt = -Infinity;
    const draw = (stamp: number) => {
      if (!visible) return; frame = requestAnimationFrame(draw);
      if (stamp - lastFrame < 32) return; lastFrame = stamp;
      const state = latest.current, theme = state.scene.theme || '';
      if (!layer || paintedTheme !== theme) { layer = chamber(theme); paintedTheme = theme; }
      const reduced = motion.matches, time = reduced ? 0 : stamp / 1000, foe = state.enemy;
      if (foe?.name !== enemyName) { enemyName = foe?.name || ''; previousHp = foe?.hp || 0; hitAt = -Infinity; }
      else if (foe && foe.hp < previousHp) { hitAt = stamp; previousHp = foe.hp; }
      else if (foe) previousHp = foe.hp;
      c.clearRect(0, 0, W, H); c.drawImage(layer, 0, 0);
      const company = state.members.slice(0, 8);
      company.forEach((member, index) => {
        const x = 92 + index * Math.min(67, 450 / Math.max(1, company.length - 1)), y = 210 + (index % 2) * 12;
        const heroClass = member.heroClass && CLASSES[member.heroClass] ? member.heroClass : 'ranger';
        c.save(); c.translate(x, y); c.scale(45, 45); c.globalAlpha = member.hp > 0 ? 1 : .45;
        drawHero(c, { x: 0, y: 0, classId: heroClass }, { time, moving: false, reducedMotion: reduced, facing: .3, classColor: CLASSES[heroClass].color }); c.restore();
        c.font = '600 11px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#e3ddcd'; c.fillText(member.name, x, y + 26, 66);
        bar(c, x, y + 35, 50, member.hp, member.maxHp, '#a9c38a');
      });
      if (foe) {
        const x = 772, y = 217, alive = foe.hp > 0, breath = alive && !reduced ? Math.sin(time * 2) * 1.8 : 0;
        ellipse(c, x + 3, y + 5, 64, 16, '#07101999'); c.save(); c.translate(x, y + breath); c.globalAlpha = alive ? 1 : .35;
        c.fillStyle = '#343b4b'; c.strokeStyle = '#9fabb466'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-44, 2); c.lineTo(-35, -55); c.lineTo(-17, -70); c.lineTo(0, -92);
        c.lineTo(19, -70); c.lineTo(38, -53); c.lineTo(46, 3); c.lineTo(14, -6); c.lineTo(0, 4); c.lineTo(-17, -7); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#596172'; c.beginPath(); c.moveTo(-20, -67); c.lineTo(0, -85); c.lineTo(22, -66); c.lineTo(12, -40); c.lineTo(-10, -40); c.closePath(); c.fill();
        c.fillStyle = '#d6bf91'; c.fillRect(-11, -61, 7, 3); c.fillRect(5, -61, 7, 3);
        c.strokeStyle = '#b2a483'; c.lineWidth = 2; c.beginPath(); c.moveTo(-13, -28); c.lineTo(0, -39); c.lineTo(15, -28); c.lineTo(0, -16); c.closePath(); c.stroke(); c.restore();
        if (!reduced && stamp - hitAt < 260) {
          c.save(); c.globalAlpha = 1 - (stamp - hitAt) / 260; c.strokeStyle = '#ead2a3'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(x - 33, y - 74); c.lineTo(x + 26, y - 13); c.stroke(); c.restore();
        }
        c.font = '600 14px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#e5d6b9'; c.fillText(foe.name, x, y - 112, 260);
        bar(c, x, y - 99, 125, foe.hp, foe.maxHp, '#d7a182'); c.font = '11px system-ui, sans-serif'; c.fillStyle = '#d5ccd0'; c.fillText(`${foe.hp} / ${foe.maxHp}`, x, y + 33);
      } else {
        c.textAlign = 'center'; c.font = 'italic 18px Georgia, serif'; c.fillStyle = '#c4b795'; c.fillText('A moment to choose the next step.', 764, 187, 320);
      }
    };
    const visibility = () => { visible = !document.hidden; cancelAnimationFrame(frame); if (visible) { lastFrame = 0; frame = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', visibility); if (visible) frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const description = scene.name + '. ' + (enemy ? `${enemy.name}: ${enemy.hp} of ${enemy.maxHp} health. ` : '') + members.slice(0, 8).map(member => `${member.name}: ${member.hp} of ${member.maxHp} health`).join('. ');
  return <canvas ref={ref} className="encounter-canvas" width={W} height={H} role="img" aria-label={description} />;
}

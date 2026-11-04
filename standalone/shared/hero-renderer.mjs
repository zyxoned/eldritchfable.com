import { resolveAppearance } from './appearance-catalog.mjs';

const TAU = Math.PI * 2;
const COLORS = {
  ranger: '#9bbd70', knight: '#aebec1', mage: '#a490c8', cleric: '#d4cfa4',
  bard: '#c08c88', wizard: '#849bd0', sorcerer: '#c78363', monk: '#c4a877',
};
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function shape(ctx, points, fill, stroke = '#172225', width = 0.025) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function oval(ctx, x, y, rx, ry, fill, stroke) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.02; ctx.stroke(); }
}
function line(ctx, points, color, width = 0.025) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function sun(ctx, x, y, radius, color) {
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    line(ctx, [[x + Math.cos(angle) * radius * 0.7, y + Math.sin(angle) * radius * 0.7],
      [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]], color, 0.02);
  }
  oval(ctx, x, y, radius * 0.45, radius * 0.45, color);
}
function leg(ctx, side, phase, stride, robe, accent) {
  const swing = Math.sin(phase + (side < 0 ? 0 : Math.PI));
  // Feet spend the grounded half of the cycle planted; the return step lifts.
  const lift = Math.max(0, swing) * stride * 0.11;
  const footX = side * 0.11 + swing * stride * 0.055;
  const footY = 0.055 + Math.cos(phase + (side < 0 ? 0 : Math.PI)) * stride * 0.085 - lift;
  const kneeX = side * 0.115 - swing * stride * 0.025;
  line(ctx, [[side * 0.09, -0.25], [kneeX, -0.11 - lift * 0.4], [footX, footY]], '#343d3d', robe ? 0.08 : 0.105);
  oval(ctx, footX + 0.015, footY + 0.018, 0.075, 0.04, '#222d2d', '#111c20');
  if (!robe) line(ctx, [[kneeX - 0.03, -0.08], [kneeX + 0.03, -0.08]], accent, 0.018);
}
function hair(ctx, palette, back, direction) {
  const { hair: color, hairStyle } = palette;
  if (hairStyle === 'shaved') return;
  if (back && hairStyle !== 'cropped') {
    shape(ctx, [[-0.135, -0.86], [0.135, -0.86], [0.15, -0.52], [0.04, -0.46], [-0.14, -0.55]], color);
    if (hairStyle === 'braid') {
      for (let i = 0; i < 5; i++) oval(ctx, 0.105 + Math.sin(i * 2.8) * 0.018, -0.59 + i * 0.045, 0.038, 0.034, color, '#26312f');
      line(ctx, [[0.08, -0.37], [0.13, -0.37]], palette.accent, 0.025);
    }
  } else if (!back) {
    shape(ctx, [[-0.145, -0.85], [-0.105, -0.98], [0.07, -1.0], [0.15, -0.88],
      [direction * 0.04, -0.9], [-0.075, -0.84]], color, '#26312f');
  }
}

function weapon(ctx, kind, palette, phase, attack, back) {
  const metal = '#c5d4cf';
  const gold = palette.accent;
  const swing = Math.sin(phase) * 0.04;
  ctx.save();
  ctx.translate(0.26, -0.45 + swing);
  ctx.rotate(attack + swing * 0.4);
  if (kind === 'ranger') {
    ctx.beginPath(); ctx.moveTo(0.03, -0.32); ctx.quadraticCurveTo(0.34, 0, 0.04, 0.35);
    ctx.strokeStyle = '#9a7850'; ctx.lineWidth = 0.045; ctx.stroke();
    line(ctx, [[0.03, -0.32], [0.06 - Math.max(0, attack) * 0.12, 0], [0.04, 0.35]], '#d9c9a0', 0.013);
    line(ctx, [[-0.06, 0.03], [0.36, -0.05]], '#d7bc81', 0.018);
  } else if (kind === 'knight') {
    shape(ctx, [[-0.025, 0.02], [-0.035, -0.43], [0, -0.56], [0.04, -0.43], [0.035, 0.02]], metal);
    line(ctx, [[-0.09, 0.02], [0.1, 0.02]], gold, 0.04);
    line(ctx, [[0, 0.02], [0, 0.16]], '#7b5a3f', 0.045);
  } else if (kind === 'wizard') {
    line(ctx, [[0.02, -0.52], [0.02, 0.49]], '#856846', 0.045);
    shape(ctx, [[-0.08, -0.49], [-0.045, -0.66], [0.065, -0.68], [0.12, -0.52], [0.02, -0.43]], gold);
    oval(ctx, 0.02, -0.55, 0.05, 0.07, '#a8cecf');
  } else if (kind === 'mage') {
    oval(ctx, 0.035, -0.06, 0.105, 0.105, '#a7c7e2', gold);
    line(ctx, [[-0.05, -0.1], [0.11, -0.04]], '#e2e9d0', 0.016);
    if (!back) oval(ctx, 0.005, -0.095, 0.022, 0.022, '#fff3d4');
  } else if (kind === 'cleric') {
    line(ctx, [[0.02, 0.27], [0.02, -0.24]], '#8c7256', 0.055);
    shape(ctx, [[-0.08, -0.22], [-0.065, -0.38], [0.11, -0.38], [0.13, -0.22]], gold);
    line(ctx, [[0.02, -0.4], [0.02, -0.2]], '#e1dac1', 0.035);
  } else if (kind === 'bard') {
    oval(ctx, -0.22, 0.12, 0.14, 0.18, '#9d6b42', gold);
    oval(ctx, -0.22, 0.08, 0.05, 0.05, '#2b302a');
    line(ctx, [[-0.19, 0.02], [0.09, -0.35]], '#9d6b42', 0.065);
    for (let i = 0; i < 3; i++) line(ctx, [[-0.235 + i * 0.015, 0.22], [0.075 + i * 0.012, -0.36]], '#dfcba0', 0.007);
  } else if (kind === 'sorcerer') {
    shape(ctx, [[-0.07, 0.02], [-0.13, -0.12], [-0.045, -0.08], [-0.01, -0.32],
      [0.06, -0.17], [0.12, -0.23], [0.1, -0.04], [0.04, 0.04]], '#e69a56', '#784e3c', 0.02);
    shape(ctx, [[-0.03, 0.01], [-0.035, -0.12], [0.01, -0.07], [0.035, -0.2], [0.06, -0.05], [0.03, 0.02]], '#f5d28b', null);
  } else {
    line(ctx, [[-0.035, -0.07], [0.07, -0.07]], '#e5dcc2', 0.07);
    for (let i = 0; i < 3; i++) line(ctx, [[-0.015 + i * 0.025, -0.1], [-0.015 + i * 0.025, -0.035]], '#958e75', 0.01);
  }
  ctx.restore();
}

/** Draw in world tile units, with hero.x/y anchored at the feet. Never changes hero. */
export function drawHero(ctx, hero, {
  time = 0, moving = false, attackFx = 0, abilityFx = 0, reducedMotion = false,
  classColor, facing,
} = {}) {
  const rawClass = String(hero.classId || '').replace('_', '-');
  const visitor = rawClass === 'death-knight';
  const kind = visitor ? 'knight' : Object.hasOwn(COLORS, rawClass) ? rawClass : 'ranger';
  const palette = resolveAppearance(hero.appearance, classColor || (visitor ? '#8473a2' : COLORS[kind]));
  if (visitor) palette.skin = '#c1c8b3';
  const motion = hero.motion || {};
  const angle = finite(facing, finite(motion.heading, Math.atan2(finite(hero.facingY, 1), finite(hero.facingX))));
  const front = Math.sin(angle) >= -0.25;
  const direction = Math.cos(angle);
  const phase = reducedMotion ? 0 : finite(motion.phase);
  const stride = reducedMotion ? 0 : clamp(finite(motion.speed, moving ? 3.8 : 0) / 3.8, 0, 1);
  const breath = reducedMotion ? 0 : Math.sin(time * 2.8) * 0.008;
  const gait = Math.sin(phase);
  const bob = stride * Math.abs(Math.sin(phase)) * 0.022 + breath;
  const leanX = reducedMotion ? 0 : clamp(finite(motion.leanX), -0.08, 0.08);
  const leanY = reducedMotion ? 0 : clamp(finite(motion.leanY), -0.08, 0.08);
  // One strike passes through anticipation, swing and recovery during the effect.
  const attackProgress = 1 - clamp(finite(attackFx) / 0.24, 0, 1);
  let attack = 0;
  if (attackFx > 0) {
    attack = attackProgress < 0.2 ? -attackProgress * 1.6 :
      attackProgress < 0.55 ? -0.32 + (attackProgress - 0.2) * 4.2 :
      1.15 * (1 - (attackProgress - 0.55) / 0.45);
    if (reducedMotion) attack = 0.3;
  }
  const robe = ['mage', 'wizard', 'cleric', 'sorcerer'].includes(kind);
  const metal = visitor ? '#65717c' : '#9cabad';
  ctx.save();
  ctx.translate(finite(hero.x), finite(hero.y));
  oval(ctx, 0.02, 0.095, kind === 'knight' ? 0.32 : 0.28, 0.115, '#101c2090');
  ctx.scale(palette.widthScale, palette.heightScale);
  leg(ctx, -1, phase, stride, robe, palette.accent);
  leg(ctx, 1, phase, stride, robe, palette.accent);
  ctx.save();
  ctx.translate(leanX + direction * 0.018, -bob + leanY * 0.25);
  ctx.rotate(leanX * 0.45 + gait * stride * 0.015);
  hair(ctx, palette, true, direction);
  // Cloaks trail the torso, while the feet retain the collision anchor.
  const trail = reducedMotion ? 0 : Math.sin(phase - 0.7) * stride * 0.055 - leanX * 0.8;
  if (['ranger', 'knight', 'cleric', 'wizard', 'sorcerer'].includes(kind)) {
    shape(ctx, [[-0.19, -0.76], [0.18, -0.76], [0.27 + trail, -0.17],
      [0.06 + trail, -0.07], [-0.27 + trail, -0.15]], kind === 'knight' ? '#6c4650' : palette.outfit);
    line(ctx, [[-0.17, -0.7], [-0.2 + trail, -0.17]], '#17292e66', 0.045);
  }
  if (kind === 'ranger') {
    shape(ctx, [[-0.2, -0.75], [-0.31, -0.72], [-0.33, -0.28], [-0.19, -0.28]], '#70563c');
    for (let i = 0; i < 3; i++) {
      const x = -0.27 + i * 0.035;
      line(ctx, [[x, -0.63], [x - 0.03, -0.98]], '#c5b58b', 0.014);
      shape(ctx, [[x - 0.03, -0.98], [x - 0.07, -0.96], [x - 0.05, -0.88]], '#e4d9bd', null);
    }
  }
  if (!front) weapon(ctx, kind, palette, phase, attack, true);
  const shoulder = kind === 'knight' ? 0.25 : kind === 'monk' ? 0.18 : 0.2;
  const armSwing = gait * stride * 0.055;
  for (const side of [-1, 1]) {
    const elbowY = -0.43 + armSwing * side;
    const handY = -0.28 + armSwing * side - (side > 0 ? Math.sin(attack) * 0.1 : 0);
    line(ctx, [[side * shoulder, -0.69], [side * (shoulder + 0.06), elbowY],
      [side * (shoulder + 0.035), handY]], kind === 'monk' ? palette.skin : palette.outfit, kind === 'knight' ? 0.12 : 0.09);
    oval(ctx, side * (shoulder + 0.035), handY, 0.045, 0.055, palette.skin, '#38403b');
    if (kind === 'monk') line(ctx, [[side * (shoulder + 0.025), handY - 0.025],
      [side * (shoulder + 0.045), handY + 0.025]], '#ddd4b9', 0.05);
  }
  const hem = robe ? -0.06 : -0.25;
  shape(ctx, [[-shoulder, -0.73], [shoulder, -0.73], [robe ? 0.25 : 0.17, hem],
    [0, hem + 0.035], [robe ? -0.25 : -0.17, hem]], palette.outfit);
  shape(ctx, [[-0.17, -0.68], [-0.035, -0.65], [-0.03, hem + 0.01], [-0.2, hem]], '#1a293650', null);
  if (robe) {
    line(ctx, [[0.07, -0.57], [0.13, hem]], '#f0e6c526', 0.025);
    line(ctx, [[-0.2, hem + 0.015], [0, hem + 0.045], [0.2, hem + 0.015]], palette.accent, 0.02);
  }
  if (kind === 'knight') {
    shape(ctx, [[-0.19, -0.72], [0.19, -0.72], [0.16, -0.38], [0, -0.29], [-0.17, -0.38]], metal);
    line(ctx, [[0, -0.69], [0, -0.35]], '#d6dfd0', 0.025);
    for (const side of [-1, 1]) shape(ctx, [[side * 0.12, -0.75], [side * 0.3, -0.77],
      [side * 0.34, -0.6], [side * 0.18, -0.57]], metal);
    shape(ctx, [[-0.4, -0.58], [-0.24, -0.66], [-0.1, -0.56], [-0.15, -0.29],
      [-0.27, -0.18], [-0.4, -0.32]], palette.outfit, palette.accent);
    line(ctx, [[-0.26, -0.56], [-0.26, -0.28]], palette.accent, 0.025);
  } else if (kind === 'cleric') {
    shape(ctx, [[-0.1, -0.73], [0.12, -0.73], [0.15, -0.12], [-0.13, -0.12]], '#e1dcc7');
    sun(ctx, 0.015, -0.49, 0.1, palette.accent);
  } else if (kind === 'mage') {
    line(ctx, [[-0.12, -0.72], [0, -0.57], [0.14, -0.72]], palette.accent, 0.028);
    oval(ctx, 0, -0.57, 0.035, 0.045, '#c3d6db', palette.accent);
  } else if (kind === 'bard') {
    shape(ctx, [[-0.2, -0.74], [-0.03, -0.7], [-0.05, -0.31], [-0.19, -0.3]], '#655044');
    shape(ctx, [[0.2, -0.74], [0.035, -0.7], [0.05, -0.31], [0.19, -0.3]], '#655044');
    shape(ctx, [[-0.16, -0.77], [0.15, -0.77], [0.07, -0.65], [0.28 + trail, -0.53], [0.29 + trail, -0.4], [0, -0.62]], palette.accent);
  } else if (kind === 'sorcerer') {
    shape(ctx, [[-0.22, -0.7], [-0.24, -0.94], [-0.08, -0.83], [0.09, -0.83],
      [0.25, -0.96], [0.22, -0.7], [0, -0.57]], palette.outfit, palette.accent);
    shape(ctx, [[0.03, -0.65], [0.16, -0.57], [0.25, -0.05], [0.06, -0.18]], '#273443');
  } else if (kind === 'monk') {
    shape(ctx, [[-0.16, -0.74], [0.05, -0.72], [0.16, -0.33], [-0.1, -0.32]], palette.outfit);
    line(ctx, [[-0.17, -0.35], [0.17, -0.35]], palette.accent, 0.055);
    shape(ctx, [[0.07, -0.33], [0.14, -0.32], [0.21 + trail, -0.03], [0.1 + trail, -0.1]], palette.accent);
  }
  if (kind !== 'monk') {
    line(ctx, [[-0.17, -0.34], [0.17, -0.34]], '#68523d', 0.055);
    shape(ctx, [[-0.035, -0.38], [0.035, -0.38], [0.035, -0.31], [-0.035, -0.31]], palette.accent);
  }
  oval(ctx, direction * 0.025, -0.86, 0.14, 0.16, palette.skin, '#303c3a');
  if (front) {
    const faceX = direction * 0.045;
    line(ctx, [[faceX - 0.055, -0.87], [faceX - 0.025, -0.875]], '#303c3a', 0.015);
    line(ctx, [[faceX + 0.025, -0.875], [faceX + 0.055, -0.87]], '#303c3a', 0.015);
    line(ctx, [[faceX - 0.015, -0.79], [faceX + 0.025, -0.79]], '#8d604b', 0.012);
  }
  hair(ctx, palette, false, direction);
  if (!front) oval(ctx, direction * 0.015, -0.9, 0.14, 0.11,
    palette.hairStyle === 'shaved' ? palette.skin : palette.hair);
  if (kind === 'ranger' || kind === 'mage') {
    shape(ctx, [[-0.18, -0.83], [-0.15, -1.03], [0, kind === 'mage' ? -1.18 : -1.1],
      [0.17, -1.01], [0.2, -0.81], [0.1, -0.8], [0.1, -0.94], [-0.1, -0.94], [-0.11, -0.81]], palette.outfit);
    line(ctx, [[-0.15, -1], [0, kind === 'mage' ? -1.14 : -1.06], [0.15, -0.99]], palette.accent, 0.017);
  } else if (kind === 'wizard') {
    oval(ctx, 0, -0.94, 0.3, 0.065, palette.outfit, '#203038');
    shape(ctx, [[-0.18, -0.97], [-0.06, -1.27], [0.06, -1.31], [0.05, -1.21],
      [0.18, -0.97]], palette.outfit);
    line(ctx, [[-0.16, -1.01], [0.16, -1.01]], palette.accent, 0.035);
  } else if (kind === 'cleric') {
    line(ctx, [[-0.13, -0.95], [0.13, -0.95]], palette.accent, 0.035);
    oval(ctx, 0, -0.96, 0.025, 0.035, '#e8d998');
  } else if (kind === 'knight') {
    line(ctx, [[-0.15, -0.96], [0.14, -0.96]], metal, 0.04);
  } else if (kind === 'monk') {
    line(ctx, [[-0.14, -0.94], [0.14, -0.94]], palette.accent, 0.035);
  }
  if (visitor) {
    shape(ctx, [[-0.18, -0.91], [-0.2, -1.12], [-0.1, -1.02], [0, -1.09],
      [0.1, -1.02], [0.2, -1.12], [0.18, -0.91]], metal, palette.accent);
    if (front) {
      line(ctx, [[-0.07, -0.88], [-0.025, -0.88]], '#b0e1cd', 0.022);
      line(ctx, [[0.025, -0.88], [0.07, -0.88]], '#b0e1cd', 0.022);
    }
  }
  if (front) weapon(ctx, kind, palette, phase, attack, false);
  if (abilityFx > 0) {
    ctx.globalAlpha = clamp(abilityFx / 0.6, 0, 1) * 0.55;
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.ellipse(0, -0.5, 0.36, 0.55, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

/** Draw the same character at a readable scale for the cosmetic editor. */
export function renderCharacterPreview(canvas, hero, options = {}) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || canvas.clientWidth || 260);
  const height = Math.max(1, rect.height || canvas.clientHeight || 280);
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const targetW = Math.round(width * dpr), targetH = Math.round(height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW; canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createRadialGradient(width / 2, height * 0.5, 8, width / 2, height * 0.5, width * 0.65);
  background.addColorStop(0, '#293b3d'); background.addColorStop(1, '#10191f');
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#a88b4c55'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(width / 2, height * 0.79, width * 0.32, height * 0.075, 0, 0, TAU); ctx.stroke();
  const scale = Math.min(width * 0.57, height * 0.55);
  ctx.translate(width / 2, height * 0.79); ctx.scale(scale, scale);
  const time = finite(options.time);
  const moving = !!options.moving;
  const previewMotion = {
    ...(hero.motion || {}), heading: finite(options.facing, Math.PI / 2),
    ...(moving ? { speed: 3.8, phase: time * 9 } : { speed: 0 }),
  };
  drawHero(ctx, { ...hero, x: 0, y: 0, motion: previewMotion }, { ...options, time, moving });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

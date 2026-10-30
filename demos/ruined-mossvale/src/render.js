import { MAPS, CLASSES, ENEMY_ATTACK_RADIUS } from './world.js';

const TAU = Math.PI * 2;
const FLOOR_TILE = 32;
let terrainCache = null;
let fogCache = null;

const PALETTES = {
  ruins: { base: '#293a2b', dark: '#1d2c23', light: '#42513a', stone: '#616555', edge: '#242e27', moss: '#728254', dust: '#a6a17a' },
  cave: { base: '#252c2d', dark: '#171e22', light: '#353d3e', stone: '#525958', edge: '#141b1d', moss: '#4d695e', dust: '#828875' },
  temple: { base: '#62665a', dark: '#434b46', light: '#777b67', stone: '#a5a48b', edge: '#3b443e', moss: '#697c5e', dust: '#d2c393' },
};

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), 0, 0, TAU);
  ctx.fill();
}

function polygon(ctx, points, color, stroke) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function line(ctx, points, color, width = 0.03) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function glow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function shadow(ctx, x, y, width, height = width * 0.34, alpha = 0.4) {
  ellipse(ctx, x + 0.1, y + 0.05, width, height, 'rgba(3,9,9,' + alpha + ')');
}

function floorFor(map) {
  if (terrainCache?.map === map) return terrainCache.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = map.width * FLOOR_TILE;
  canvas.height = map.height * FLOOR_TILE;
  const ctx = canvas.getContext('2d', { alpha: false });
  const palette = PALETTES[map.theme] || PALETTES.ruins;
  const rng = random(hash(map.id || map.name));
  ctx.scale(FLOOR_TILE, FLOOR_TILE);
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, map.width, map.height);

  // Large translucent stains avoid a regular tile-grid appearance.
  for (let i = 0; i < map.width * map.height * 0.9; i += 1) {
    ellipse(ctx, rng() * map.width, rng() * map.height, 0.2 + rng() * 1.6,
      0.12 + rng() * 0.7, rng() > 0.5 ? palette.dark + '45' : palette.light + '45');
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const px = x + rng();
      const py = y + rng();
      if (map.theme === 'temple') {
        ctx.strokeStyle = '#b8b39116';
        ctx.lineWidth = 0.025;
        ctx.strokeRect(x + 0.035, y + 0.035, 0.93, 0.93);
      }
      for (let i = 0; i < 5; i += 1) {
        ellipse(ctx, x + rng(), y + rng(), 0.012 + rng() * 0.048,
          0.01 + rng() * 0.025, i % 2 ? palette.dust + '45' : '#0b171a55');
      }
      if (rng() > (map.theme === 'cave' ? 0.83 : 0.43)) {
        line(ctx, [[px - 0.04, py], [px - 0.08, py - 0.14], [px + 0.02, py - 0.02],
          [px + 0.09, py - 0.16]], palette.moss + '75', 0.023);
      }
    }
  }

  const spawn = map.spawn || { x: map.width / 2, y: map.height / 2 };
  const anchors = [spawn, ...(map.objects || [])];
  for (let a = 1; a < anchors.length; a += 1) {
    const from = anchors[a - 1];
    const to = anchors[a];
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 1.5);
    for (let i = 0; i <= steps; i += 1) {
      const t = steps ? i / steps : 0;
      const x = from.x + (to.x - from.x) * t + (rng() - 0.5) * 0.4;
      const y = from.y + (to.y - from.y) * t + (rng() - 0.5) * 0.4;
      const width = 0.25 + rng() * 0.25;
      const height = 0.13 + rng() * 0.13;
      polygon(ctx, [[x - width, y - height], [x + width * 0.8, y - height * 0.8],
        [x + width, y + height * 0.65], [x - width * 0.7, y + height]],
      map.theme === 'temple' ? '#adab8d44' : '#82806b35', '#121d201f');
      if (rng() > 0.6) line(ctx, [[x - width * 0.5, y], [x + width * 0.3, y - height]], '#1a252238', 0.02);
    }
  }
  if (map.theme === 'ruins') {
    // A surviving plaza gives the starting clearing a history beneath the moss.
    const plazaRng = random(hash('mossvale-plaza'));
    const slabColors = ['#6e765dcc', '#778065aa', '#64725aaa', '#85866a99'];
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const x = 18 + col * 0.96 + (row % 2) * 0.43;
        const y = 22 + row * 0.72;
        const edge = ((x - 22) / 4.4) ** 2 + ((y - 25.5) / 3.8) ** 2;
        if (edge > 1 || plazaRng() < 0.12 + edge * 0.14) continue;
        const w = 0.8 + plazaRng() * 0.1;
        const h = 0.53 + plazaRng() * 0.07;
        const chip = 0.05 + plazaRng() * 0.09;
        polygon(ctx, [[x + chip, y], [x + w - 0.08, y + 0.025], [x + w, y + h * 0.6],
          [x + w - chip, y + h], [x + 0.04, y + h - 0.025], [x, y + 0.12]],
        slabColors[Math.floor(plazaRng() * slabColors.length)], '#1c302a88');
        line(ctx, [[x + chip, y + 0.025], [x + w - 0.1, y + 0.045]], '#bcc18d44', 0.025);
        if (plazaRng() > 0.5) {
          line(ctx, [[x + w * 0.3, y + 0.02], [x + w * 0.43, y + h * 0.42],
            [x + w * 0.34, y + h * 0.68], [x + w * 0.52, y + h]], '#2b3d2d99', 0.028);
        }
        if (plazaRng() > 0.55) ellipse(ctx, x + 0.1, y + h - 0.04, 0.16, 0.065, '#58734788');
      }
    }
  }
  terrainCache = { map, canvas };
  return canvas;
}

function tree(ctx, block, palette) {
  const { x, y, w = 1, h = 1 } = block;
  const rng = random(hash('tree' + x + ',' + y));
  const cx = x + w / 2;
  const cy = y + h * 0.7;
  shadow(ctx, cx + 0.3, cy + 0.16, Math.max(0.5, w * 0.8), Math.max(0.25, h * 0.32));
  line(ctx, [[cx, cy + 0.05], [cx - 0.04, cy - h * 0.45], [cx + w * 0.12, cy - h * 0.7]], '#252b23', 0.19);
  line(ctx, [[cx - 0.04, cy - 0.1], [cx - w * 0.25, cy - h * 0.5]], '#3d3e2a', 0.1);
  for (let i = 0; i < 15; i += 1) {
    const angle = rng() * TAU;
    const radius = Math.sqrt(rng());
    const px = cx + Math.cos(angle) * w * 0.52 * radius;
    const py = cy - h * 0.48 + Math.sin(angle) * h * 0.36 * radius;
    ellipse(ctx, px + 0.07, py + 0.11, w * (0.21 + rng() * 0.13), h * (0.16 + rng() * 0.14), '#132b25');
    ellipse(ctx, px, py, w * (0.19 + rng() * 0.12), h * (0.15 + rng() * 0.12),
      ['#2d4934', '#36563c', '#3e6040', '#496b44'][i % 4]);
    if (i % 2 === 0) ellipse(ctx, px - 0.07, py - 0.08, w * 0.12, h * 0.055, '#7483553b');
  }
}

function masonry(ctx, block, theme) {
  const palette = PALETTES[theme] || PALETTES.ruins;
  const { x, y, w = 1, h = 1 } = block;
  const elevation = block.kind === 'column' ? 0.83 : block.kind === 'ruin' ? 0.42 : 0.55;
  const rng = random(hash(block.kind + x + ',' + y));
  shadow(ctx, x + w * 0.54, y + h * 0.72, w * 0.64, h * 0.42 + 0.15);
  ctx.fillStyle = palette.edge;
  ctx.fillRect(x, y + h - elevation, w, elevation + 0.09);
  const top = y - elevation;
  if (block.kind === 'column') {
    const cx = x + w / 2;
    ellipse(ctx, cx, y + h - 0.13, w * 0.5, 0.22, palette.edge);
    ctx.fillStyle = palette.stone;
    ctx.fillRect(x + w * 0.16, top + 0.15, w * 0.68, h + elevation - 0.34);
    ctx.fillStyle = '#ffffff14';
    ctx.fillRect(x + w * 0.22, top + 0.16, w * 0.13, h + elevation - 0.36);
    ellipse(ctx, cx, top + 0.16, w * 0.5, 0.22, palette.stone);
    ellipse(ctx, cx - 0.03, top + 0.1, w * 0.37, 0.1, palette.dust + '77');
    line(ctx, [[cx + 0.12, top + 0.2], [cx, top + h * 0.5], [cx + 0.15, top + h * 0.68]], palette.edge + '99', 0.035);
    return;
  }
  if (theme === 'cave') {
    polygon(ctx, [[x, top + 0.18], [x + w * 0.18, top - 0.04], [x + w * 0.52, top + 0.07],
      [x + w * 0.84, top - 0.02], [x + w, top + 0.2], [x + w - 0.04, top + h],
      [x + w * 0.63, top + h + 0.07], [x + w * 0.25, top + h - 0.03], [x, top + h]],
    palette.stone, palette.edge);
    for (let i = 0; i < Math.ceil(w * h * 3); i += 1) {
      const px = x + rng() * w;
      const py = top + rng() * h;
      polygon(ctx, [[px - 0.16, py + 0.12], [px - 0.09, py - 0.17], [px + 0.18, py - 0.08],
        [px + 0.25, py + 0.14]], i % 2 ? '#7e877233' : '#26363866');
      if (i % 4 === 0) line(ctx, [[px - 0.13, py - 0.02], [px + 0.04, py + 0.08],
        [px + 0.08, py + 0.29]], '#202c2d88', 0.03);
    }
    line(ctx, [[x + 0.08, top + 0.19], [x + w * 0.35, top + 0.08],
      [x + w * 0.72, top + 0.15]], '#93998444', 0.045);
    return;
  }
  ctx.fillStyle = palette.stone;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = '#d4d3ad15';
  ctx.fillRect(x, top, w, 0.075);
  ctx.strokeStyle = palette.edge + 'a0';
  ctx.lineWidth = 0.035;
  for (let sy = top; sy < top + h; sy += 0.45) {
    line(ctx, [[x, sy], [x + w, sy]], palette.edge + '88', 0.025);
    for (let sx = x + ((Math.round((sy - top) / 0.45) % 2) * 0.4); sx < x + w; sx += 0.8) {
      line(ctx, [[sx, sy], [sx, Math.min(top + h, sy + 0.45)]], palette.edge + '77', 0.025);
    }
  }
  for (let i = 0; i < Math.ceil(w * h * 2); i += 1) {
    const px = x + rng() * w;
    const py = top + rng() * h;
    ellipse(ctx, px, py, 0.12 + rng() * 0.3, 0.03 + rng() * 0.08, palette.moss + '77');
    if (i % 3 === 0) line(ctx, [[px, py], [px - 0.08, py + 0.16], [px + 0.01, py + 0.23]], palette.edge + '88', 0.025);
  }
  if (block.kind === 'ruin') {
    for (let i = 0; i < Math.ceil(w * 1.8); i += 1) {
      const px = x + rng() * w;
      const py = y + h + rng() * 0.24;
      polygon(ctx, [[px - 0.12, py], [px, py - 0.11], [px + 0.14, py + 0.03], [px, py + 0.12]], palette.stone, palette.edge);
    }
  }
}

function groundBlock(ctx, block, theme, t) {
  const { x, y, w = 1, h = 1 } = block;
  if (block.kind === 'water') {
    ctx.fillStyle = '#172d2e';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#78978738';
    ctx.lineWidth = 0.035;
    for (let i = 0; i < Math.ceil(h * 3); i += 1) {
      const py = y + 0.16 + i * 0.32;
      const shift = Math.sin(t * 0.6 + i * 2) * 0.08;
      line(ctx, [[x + 0.15 + shift, py], [x + w * 0.55, py + 0.015], [x + w - 0.13, py]], '#7d9c8c33', 0.025);
    }
    ctx.strokeStyle = '#435d4388';
    ctx.lineWidth = 0.1;
    ctx.strokeRect(x + 0.04, y + 0.04, w - 0.08, h - 0.08);
  } else if (block.kind === 'chasm') {
    ctx.fillStyle = theme === 'temple' ? '#242c36' : '#0c151c';
    ctx.fillRect(x, y, w, h);
    const gradient = ctx.createLinearGradient(x, y, x, y + Math.min(h, 2));
    gradient.addColorStop(0, '#080f1766');
    gradient.addColorStop(1, theme === 'temple' ? '#86919525' : '#17263044');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    line(ctx, [[x, y + h], [x, y], [x + w, y]], '#c4c1a151', 0.065);
    if (theme === 'temple') {
      for (let i = 0; i < 5; i += 1) ellipse(ctx, x + w * i / 4, y + h * 0.7, w * 0.28, 0.32, '#c4ccbe15');
    }
  }
}

function campfire(ctx, x, y, t) {
  shadow(ctx, x, y + 0.12, 0.45);
  for (let i = 0; i < 7; i += 1) {
    const a = i * TAU / 7;
    ellipse(ctx, x + Math.cos(a) * 0.32, y + Math.sin(a) * 0.16, 0.12, 0.08, '#727263');
  }
  line(ctx, [[x - 0.24, y + 0.03], [x + 0.22, y + 0.15]], '#544534', 0.1);
  line(ctx, [[x + 0.2, y - 0.04], [x - 0.2, y + 0.14]], '#493f2d', 0.1);
  const flicker = Math.sin(t * 8) * 0.04;
  polygon(ctx, [[x - 0.19, y + 0.03], [x - 0.12, y - 0.3], [x, y - 0.52 + flicker],
    [x + 0.07, y - 0.25], [x + 0.14, y - 0.37], [x + 0.2, y + 0.03]], '#cf7d3f');
  polygon(ctx, [[x - 0.09, y + 0.03], [x, y - 0.31 - flicker], [x + 0.1, y + 0.03]], '#ffe5a2');
  for (let i = 0; i < 3; i += 1) {
    const age = (t * 0.5 + i * 0.33) % 1;
    ellipse(ctx, x + Math.sin(age * 5 + i) * 0.13, y - 0.3 - age * 0.7, 0.017, 0.025, '#e8be7766');
  }
}

function arch(ctx, object, theme, t) {
  const { x, y } = object;
  const cave = object.target === 'cave' || /cave/i.test(object.id || '');
  shadow(ctx, x, y + 0.1, 0.83, 0.3);
  if (cave) {
    ellipse(ctx, x, y - 0.35, 0.83, 0.78, '#353e34');
    ellipse(ctx, x, y - 0.21, 0.54, 0.65, '#0b181b');
    line(ctx, [[x - 0.7, y + 0.05], [x - 0.67, y - 0.65], [x - 0.28, y - 1.02],
      [x + 0.27, y - 1.04], [x + 0.7, y - 0.61], [x + 0.77, y]], '#788063', 0.16);
    ellipse(ctx, x + 0.2, y - 0.88, 0.36, 0.1, '#4d6544');
    glow(ctx, x, y - 0.1, 0.55, '#61947a25');
  } else {
    ellipse(ctx, x, y - 0.35, 0.51, 0.8, '#121f2466');
    ctx.fillStyle = theme === 'temple' ? '#b6af8e' : '#878b70';
    ctx.fillRect(x - 0.7, y - 1.12, 0.24, 1.2);
    ctx.fillRect(x + 0.46, y - 1.12, 0.24, 1.2);
    polygon(ctx, [[x - 0.77, y - 1.08], [x - 0.6, y - 1.37], [x + 0.59, y - 1.37],
      [x + 0.78, y - 1.08]], '#b4ae8b', '#4c584c');
    line(ctx, [[x - 0.52, y - 1.17], [x, y - 1.25], [x + 0.53, y - 1.17]], '#d5b975', 0.04);
    glow(ctx, x, y - 0.38, 0.8, '#d7b66d18');
    for (let i = 0; i < 4; i += 1) {
      const a = (t * 0.15 + i / 4) % 1;
      ellipse(ctx, x + Math.sin(a * 12) * 0.28, y - a * 1.05, 0.014, 0.027, '#d9ca8d77');
    }
  }
}

function person(ctx, x, y, color, facingX = 0, facingY = 1, bob = 0, keeper = false) {
  shadow(ctx, x, y + 0.12, 0.31, 0.13);
  ctx.save();
  ctx.translate(x, y + bob);
  line(ctx, [[-0.11, -0.05], [-0.14, 0.12]], '#282c2a', 0.12);
  line(ctx, [[0.11, -0.05], [0.14, 0.12]], '#282c2a', 0.12);
  polygon(ctx, [[-0.2, -0.55], [0.18, -0.55], [0.26, -0.06], [0, 0.06], [-0.25, -0.05]],
    keeper ? '#6d785b' : color, '#172323');
  polygon(ctx, [[-0.16, -0.53], [-0.03, -0.48], [-0.06, -0.05], [-0.24, -0.04]], '#13272966');
  ellipse(ctx, 0, -0.59, 0.19, 0.21, '#263932');
  ellipse(ctx, facingX * 0.035, -0.6 + facingY * 0.018, 0.12, 0.14, '#c9b58b');
  polygon(ctx, [[-0.2, -0.59], [-0.13, -0.81], [0.05, -0.84], [0.21, -0.62], [0.14, -0.6],
    [0.04, -0.72], [-0.07, -0.69], [-0.11, -0.56]], keeper ? '#556747' : '#46564a');
  line(ctx, [[-0.14, -0.39], [0.12, -0.19]], '#dbc88a99', 0.045);
  ellipse(ctx, 0.02, -0.28, 0.038, 0.04, '#e4c783');
  if (keeper) {
    line(ctx, [[0.33, -0.63], [0.31, 0.1]], '#846c42', 0.055);
    glow(ctx, 0.33, -0.67, 0.35, '#efc16a30');
    ellipse(ctx, 0.33, -0.66, 0.065, 0.1, '#e4c583');
  } else {
    line(ctx, [[0.27, -0.42], [0.34, -0.02]], '#59665f', 0.065);
    line(ctx, [[0.34, -0.02], [0.47, -0.39]], '#c1c4a4', 0.065);
    line(ctx, [[0.27, -0.04], [0.43, 0]], '#d5b46e', 0.055);
  }
  ctx.restore();
}

function objectSprite(ctx, object, theme, t) {
  const { x, y, type } = object;
  if (type === 'rest') return campfire(ctx, x, y, t);
  if (type === 'travel') return arch(ctx, object, theme, t);
  if (type === 'talk') return person(ctx, x, y, '#778564', 0, 1, 0, true);
  shadow(ctx, x, y + 0.1, 0.43);
  const well = /well/i.test(object.id + ' ' + object.label);
  if (well) {
    ellipse(ctx, x, y - 0.04, 0.48, 0.29, '#424d43');
    ctx.fillStyle = '#747a62';
    ctx.fillRect(x - 0.46, y - 0.3, 0.92, 0.27);
    ellipse(ctx, x, y - 0.3, 0.47, 0.26, '#999b79');
    ellipse(ctx, x, y - 0.3, 0.32, 0.17, '#18332f');
    ellipse(ctx, x - 0.05, y - 0.34, 0.22, 0.06, '#879e7144');
  } else {
    polygon(ctx, [[x - 0.33, y], [x - 0.3, y - 0.45], [x + 0.29, y - 0.45], [x + 0.36, y]], '#737b63', '#34453b');
    polygon(ctx, [[x - 0.4, y - 0.43], [x - 0.3, y - 0.58], [x + 0.28, y - 0.58], [x + 0.4, y - 0.43]], '#9b9d7a');
    if (type === 'reward') {
      glow(ctx, x, y - 0.7, 0.65, '#edcd7c24');
      polygon(ctx, [[x, y - 0.97], [x + 0.11, y - 0.79], [x, y - 0.63], [x - 0.11, y - 0.79]], '#dec47b');
    } else {
      ellipse(ctx, x, y - 0.63, 0.15, 0.16, '#818f74');
      line(ctx, [[x - 0.07, y - 0.7], [x + 0.09, y - 0.61]], '#d1bc7a', 0.035);
    }
  }
}

function enemySprite(ctx, enemy, t, reducedMotion) {
  const { x, y, type } = enemy;
  const idle = reducedMotion ? 0 : Math.sin(t * 2.5 + x) * 0.025;
  shadow(ctx, x, y + 0.06, type === 'warden' ? 0.45 : 0.31);
  if (enemy.windup > 0) {
    // This ground-plane circle shares the exact damage radius with world.js.
    ctx.beginPath();
    ctx.arc(x, y, ENEMY_ATTACK_RADIUS, 0, TAU);
    ctx.fillStyle = '#ca64511e';
    ctx.fill();
    ctx.strokeStyle = '#ef9279bb';
    ctx.lineWidth = 0.055;
    ctx.stroke();
    ctx.strokeStyle = '#f4c29a42';
    ctx.lineWidth = 0.018;
    ctx.stroke();
  }
  if (type === 'warden') {
    polygon(ctx, [[x - 0.36, y - 0.65], [x - 0.27, y - 0.93], [x + 0.26, y - 0.93],
      [x + 0.38, y - 0.62], [x + 0.28, y - 0.07], [x - 0.28, y - 0.07]], '#7b806d', '#273c35');
    ctx.fillStyle = '#515e52';
    ctx.fillRect(x - 0.3, y - 0.05, 0.21, 0.16);
    ctx.fillRect(x + 0.09, y - 0.05, 0.21, 0.16);
    ellipse(ctx, x, y - 0.94, 0.25, 0.23, '#999781');
    line(ctx, [[x - 0.12, y - 0.94], [x + 0.12, y - 0.94]], '#e2c282', 0.045);
    line(ctx, [[x - 0.43, y - 0.58], [x - 0.51, y - 0.16]], '#697865', 0.18);
    line(ctx, [[x + 0.43, y - 0.58], [x + 0.51, y - 0.16]], '#697865', 0.18);
    line(ctx, [[x + 0.06, y - 0.73], [x - 0.06, y - 0.43], [x + 0.03, y - 0.26]], '#d0b26e', 0.03);
  } else if (type === 'crawler') {
    for (let i = -1; i <= 1; i += 1) {
      line(ctx, [[x - 0.15, y - 0.19], [x - 0.39, y - 0.29 + i * 0.14], [x - 0.48, y + i * 0.14]], '#6f795a', 0.065);
      line(ctx, [[x + 0.15, y - 0.19], [x + 0.39, y - 0.29 + i * 0.14], [x + 0.48, y + i * 0.14]], '#6f795a', 0.065);
    }
    ellipse(ctx, x, y - 0.18 + idle, 0.27, 0.24, '#465c4b');
    ellipse(ctx, x, y - 0.24 + idle, 0.19, 0.2, '#74826a');
    line(ctx, [[x - 0.07, y - 0.3], [x + 0.07, y - 0.3]], '#d8c379', 0.035);
  } else {
    for (let i = 0; i < 7; i += 1) {
      const angle = i * TAU / 7;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      polygon(ctx, [[x + dx * 0.12, y - 0.23 + dy * 0.17], [x + dx * 0.42, y - 0.23 + dy * 0.44],
        [x + dx * 0.25 + 0.06, y - 0.23 + dy * 0.2]], '#6c7950');
    }
    ellipse(ctx, x, y - 0.24 + idle, 0.26, 0.3, '#4a6242');
    ellipse(ctx, x - 0.07, y - 0.32 + idle, 0.13, 0.16, '#788758');
    ellipse(ctx, x - 0.08, y - 0.28 + idle, 0.032, 0.035, '#e4cd85');
    ellipse(ctx, x + 0.08, y - 0.28 + idle, 0.032, 0.035, '#e4cd85');
  }
  if (enemy.hp < enemy.maxHp) {
    ctx.fillStyle = '#111b1bd9';
    ctx.fillRect(x - 0.31, y - 1.28, 0.62, 0.075);
    ctx.fillStyle = '#b58d6b';
    ctx.fillRect(x - 0.29, y - 1.26, 0.58 * Math.max(0, enemy.hp / enemy.maxHp), 0.035);
  }
}

function objectKnown(object, explored, hero) {
  return Math.hypot(object.x - hero.x, object.y - hero.y) < 2.2 ||
    explored.has(Math.floor(object.x) + ',' + Math.floor(object.y));
}

function drawFog(ctx, map, explored, hero, viewport) {
  // A world-aligned pixel per tile keeps the entire feathered fog cache below 32 KB.
  const padding = 2;
  const width = map.width + padding * 2;
  const height = map.height + padding * 2;
  if (fogCache?.map !== map) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    fogCache = { map, canvas, context, pixels: context.createImageData(width, height),
      alpha: new Float32Array(width * height), horizontal: new Float32Array(width * height) };
  }
  const { canvas, context, pixels, alpha, horizontal } = fogCache;
  const heroX = Math.round(hero.x * 4) / 4;
  const heroY = Math.round(hero.y * 4) / 4;
  // Discovery only grows, so its size invalidates the mask without hashing tile keys.
  if (fogCache.heroX !== heroX || fogCache.heroY !== heroY || fogCache.exploredCount !== explored.size) {
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const x = px - padding;
        const y = py - padding;
        const distance = Math.hypot(x + 0.5 - heroX, y + 0.5 - heroY);
        const known = explored.has(x + ',' + y);
        alpha[py * width + px] = x < 0 || y < 0 || x >= map.width || y >= map.height ? 0.98
          : known ? Math.min(0.2, Math.max(0, distance - 4) * 0.035)
          : Math.min(0.95, Math.max(0, (distance - 2.5) / 3.6) * 0.95);
      }
    }
    const kernel = [1, 4, 6, 4, 1];
    // The Gaussian is separable: two five-sample passes replace 25 samples per pixel.
    for (let py = 0; py < height; py += 1) {
      const row = py * width;
      for (let px = 0; px < width; px += 1) {
        let opacity = 0;
        for (let k = -2; k <= 2; k += 1) {
          opacity += alpha[row + Math.max(0, Math.min(width - 1, px + k))] * kernel[k + 2];
        }
        horizontal[row + px] = opacity / 16;
      }
    }
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        let opacity = 0;
        for (let k = -2; k <= 2; k += 1) {
          opacity += horizontal[Math.max(0, Math.min(height - 1, py + k)) * width + px] * kernel[k + 2];
        }
        const index = (py * width + px) * 4;
        pixels.data[index] = 10;
        pixels.data[index + 1] = 23;
        pixels.data[index + 2] = 23;
        pixels.data[index + 3] = Math.round(opacity / 16 * 255);
      }
    }
    context.putImageData(pixels, 0, 0);
    fogCache.heroX = heroX;
    fogCache.heroY = heroY;
    fogCache.exploredCount = explored.size;
  }
  const left = Math.max(-padding, viewport.left);
  const top = Math.max(-padding, viewport.top);
  const right = Math.min(map.width + padding, viewport.right);
  const bottom = Math.min(map.height + padding, viewport.bottom);
  const cropWidth = right - left;
  const cropHeight = bottom - top;
  if (cropWidth <= 0 || cropHeight <= 0) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(canvas, left + padding, top + padding, cropWidth, cropHeight,
    left, top, cropWidth, cropHeight);
  ctx.restore();
}

/** Draw the game world. time is elapsed seconds; returned camera coordinates are tile units. */
export function renderWorld(canvas, state, { time = state.time || 0, reducedMotion = false } = {}) {
  const map = MAPS[state.location];
  if (!map) return { cameraX: 0, cameraY: 0, scale: 54 };
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || canvas.clientWidth || 800);
  const height = Math.max(1, rect.height || canvas.clientHeight || 600);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  const scale = width < 600 ? 48 : width > 1250 ? 58 : 54;
  const viewW = width / scale;
  const viewH = height / scale;
  const hero = state.hero;
  const cameraX = map.width < viewW ? (map.width - viewW) / 2 : Math.max(0, Math.min(map.width - viewW, hero.x - viewW / 2));
  const cameraY = map.height < viewH ? (map.height - viewH) / 2 : Math.max(0, Math.min(map.height - viewH, hero.y - viewH / 2));
  const t = reducedMotion ? 0 : time;
  const bounds = { left: cameraX - 2, top: cameraY - 3, right: cameraX + viewW + 2, bottom: cameraY + viewH + 3 };
  const visible = (x, y, pad = 2) => x > bounds.left - pad && x < bounds.right + pad && y > bounds.top - pad && y < bounds.bottom + pad;
  const explored = new Set(state.explored?.[state.location] || []);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#111e23';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-cameraX, -cameraY);
  ctx.drawImage(floorFor(map), 0, 0, map.width, map.height);
  const blocks = map.blocks || [];
  for (const block of blocks) {
    if (block.kind === 'water' || block.kind === 'chasm') groundBlock(ctx, block, map.theme, t);
  }
  const knownObjects = (map.objects || []).filter(object => objectKnown(object, explored, hero));
  for (const object of knownObjects) {
    if (!visible(object.x, object.y)) continue;
    if (object.type === 'rest') glow(ctx, object.x, object.y, 2.4, '#e8a75432');
    if (object.type === 'talk') glow(ctx, object.x + 0.33, object.y - 0.4, 1.3, '#f2c97814');
  }
  const items = [];
  for (const block of blocks) {
    if (block.kind === 'water' || block.kind === 'chasm') continue;
    if (!visible(block.x + (block.w || 1) / 2, block.y + (block.h || 1) / 2, Math.max(block.w || 1, block.h || 1))) continue;
    items.push({ y: block.y + (block.h || 1) * 0.75, draw: () => block.kind === 'tree'
      ? tree(ctx, block, PALETTES[map.theme] || PALETTES.ruins) : masonry(ctx, block, map.theme) });
  }
  for (const object of knownObjects) {
    if (visible(object.x, object.y)) items.push({ y: object.y, draw: () => objectSprite(ctx, object, map.theme, t) });
  }
  const enemies = (state.enemies?.[state.location] || []).filter(enemy => enemy.hp > 0);
  for (const enemy of enemies) {
    if (visible(enemy.x, enemy.y) && objectKnown(enemy, explored, hero)) items.push({ y: enemy.y, draw: () => enemySprite(ctx, enemy, t, reducedMotion) });
  }
  const classColor = CLASSES[hero.classId]?.color || '#a9bc7e';
  items.push({ y: hero.y, draw: () => {
    glow(ctx, hero.x, hero.y - 0.1, 0.8, '#d7d5a10d');
    ellipse(ctx, hero.x, hero.y + 0.05, 0.38, 0.18, '#d5c68b16');
    person(ctx, hero.x, hero.y, classColor, hero.facingX || 0, hero.facingY || 1,
      state.moving && !reducedMotion ? Math.sin(t * 15) * 0.035 : 0);
  } });
  items.sort((a, b) => a.y - b.y).forEach(item => item.draw());

  if (state.attackFx > 0) {
    const angle = Math.atan2(hero.facingY || 0, hero.facingX || 1);
    ctx.strokeStyle = '#f3deb4bc';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(hero.x, hero.y - 0.28, 0.72, angle - 0.95, angle + 0.95);
    ctx.stroke();
    ctx.strokeStyle = '#f7e4bf38';
    ctx.lineWidth = 0.18;
    ctx.stroke();
  }
  if (state.abilityFx > 0) {
    const radius = reducedMotion ? 1.15 : 1.1 + (1 - Math.min(1, state.abilityFx)) * 1.3;
    glow(ctx, hero.x, hero.y - 0.25, radius, classColor + '28');
    ctx.strokeStyle = classColor + 'b8';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.ellipse(hero.x, hero.y, radius, radius * 0.7, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = i * TAU / 8 + t * 0.3;
      ellipse(ctx, hero.x + Math.cos(a) * radius, hero.y + Math.sin(a) * radius * 0.7, 0.04, 0.04, classColor);
    }
  }

  drawFog(ctx, map, explored, hero, { left: cameraX, top: cameraY, right: cameraX + viewW, bottom: cameraY + viewH });
  for (const object of knownObjects) {
    const distance = Math.hypot(object.x - hero.x, object.y - hero.y);
    if (distance > 5 || !visible(object.x, object.y)) continue;
    const alpha = Math.min(0.95, (5 - distance) / 1.3);
    ctx.globalAlpha = alpha;
    const labelY = object.y - (object.type === 'travel' ? 1.65 : object.type === 'talk' ? 1.1 : 0.95);
    ctx.font = '500 0.19px Georgia, serif';
    ctx.textAlign = 'center';
    const label = object.label || '';
    const labelW = ctx.measureText(label).width + 0.3;
    ctx.fillStyle = '#101c1de3';
    ctx.fillRect(object.x - labelW / 2, labelY - 0.18, labelW, 0.31);
    ctx.fillStyle = distance < 1.7 ? '#edd59a' : '#c1c6ad';
    ctx.fillText(label, object.x, labelY + 0.025);
    if (distance < 1.7) {
      ctx.strokeStyle = '#d7bc6d99';
      ctx.lineWidth = 0.018;
      ctx.strokeRect(object.x - labelW / 2, labelY - 0.18, labelW, 0.31);
    }
    ctx.globalAlpha = 1;
  }
  for (const impact of state.impacts || []) {
    if (!visible(impact.x, impact.y) || impact.life <= 0) continue;
    ctx.globalAlpha = Math.min(1, impact.life * 2.5);
    ctx.font = 'bold 0.31px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 0.075;
    ctx.strokeStyle = '#101b1b';
    const y = impact.y - 0.9 - (1 - Math.min(1, impact.life)) * 0.5;
    ctx.strokeText(String(impact.label), impact.x, y);
    ctx.fillStyle = impact.color || '#e4d59b';
    ctx.fillText(String(impact.label), impact.x, y);
    ctx.globalAlpha = 1;
  }
  // Fireflies sit above the scene, but only in nearby explored space.
  if (map.theme === 'ruins') {
    for (let i = 0; i < 9; i += 1) {
      const x = hero.x + Math.sin(i * 8.17 + t * 0.055) * 5.5;
      const y = hero.y + Math.cos(i * 4.41 + t * 0.06) * 4;
      if (!explored.has(Math.floor(x) + ',' + Math.floor(y))) continue;
      ellipse(ctx, x, y, 0.018, 0.018, '#d7c48255');
    }
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2,
    width / 2, height / 2, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, 'rgba(7,14,17,0)');
  vignette.addColorStop(1, 'rgba(5,13,17,0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  return { cameraX, cameraY, scale };
}

export const ENEMY_ATTACK_RADIUS = 1.7;
export const SAVE_KEY = 'eldritch-fable-mossvale-demo-v1';

export const CLASSES = {
  ranger: { name: 'Ranger', color: '#9bbd70', damage: 15, range: 4.5, ability: 'Piercing shot', hint: 'A powerful shot at the nearest foe.' },
  knight: { name: 'Knight', color: '#d7a66b', damage: 22, range: 1.65, ability: 'Whirlwind', hint: 'Strike every nearby foe.' },
  mage: { name: 'Mage', color: '#a88cdb', damage: 17, range: 4.2, ability: 'Arcane flare', hint: 'A burst of magic around you.' },
  cleric: { name: 'Cleric', color: '#e8d49a', damage: 16, range: 3.5, ability: 'Mending light', hint: 'Restore 35 health.' },
  bard: { name: 'Bard', color: '#dc9ab8', damage: 16, range: 3.8, ability: 'Resonance', hint: 'A resonant burst around you.' },
  wizard: { name: 'Wizard', color: '#87b9e8', damage: 17, range: 4.2, ability: 'Frost nova', hint: 'A burst of magic around you.' },
  sorcerer: { name: 'Sorcerer', color: '#e08b66', damage: 18, range: 4.0, ability: 'Ember surge', hint: 'A burst of magic around you.' },
  monk: { name: 'Monk', color: '#70bcb0', damage: 21, range: 1.8, ability: 'Palm tempest', hint: 'Strike every nearby foe.' }
};

const mossObjects = [
  { id: 'keeper', type: 'talk', label: 'The lantern keeper', x: 24.5, y: 24.2 },
  { id: 'hearth', type: 'rest', label: 'Ember hearth', x: 22.3, y: 25.5 },
  { id: 'signpost', type: 'inspect', label: 'Weathered signpost', x: 20, y: 21 },
  { id: 'well', type: 'inspect', label: 'The old well', x: 22, y: 17.5 },
  { id: 'ward', type: 'inspect', label: 'A broken ward', x: 16, y: 13.3 },
  { id: 'cave-mouth', type: 'travel', label: 'A passage beneath the hill', x: 7.5, y: 7.5, target: 'cave' },
  { id: 'high-stair', type: 'travel', label: 'Steps above the clouds', x: 36.5, y: 7.5, target: 'temple' },
  { id: 'fallen-banner', type: 'inspect', label: 'A fallen banner', x: 33.5, y: 22 }
];

export const MAPS = {
  mossvale: {
    id: 'mossvale', name: 'Ruined Mossvale', width: 44, height: 34, theme: 'ruins',
    spawn: { x: 22, y: 27.2 },
    blocks: [
      { kind: 'ruin', x: 17, y: 24, w: 2.2, h: 1.2 },
      { kind: 'ruin', x: 27, y: 25, w: 2, h: 2 },
      { kind: 'ruin', x: 12, y: 18, w: 4, h: 4 },
      { kind: 'ruin', x: 27, y: 18, w: 4, h: 3 },
      { kind: 'ruin', x: 13, y: 7, w: 7, h: 4 },
      { kind: 'ruin', x: 28, y: 6, w: 4, h: 6 },
      { kind: 'ruin', x: 4, y: 23, w: 5, h: 4 },
      { kind: 'ruin', x: 34, y: 25, w: 5, h: 4 },
      { kind: 'water', x: 4, y: 12, w: 4, h: 6 },
      { kind: 'tree', x: 8, y: 3, w: 3, h: 2 },
      { kind: 'tree', x: 39, y: 12, w: 3, h: 4 },
      { kind: 'tree', x: 3, y: 29, w: 4, h: 3 },
      { kind: 'tree', x: 30, y: 30, w: 5, h: 2 }
    ],
    objects: mossObjects
  },
  cave: {
    id: 'cave', name: 'The Amber Hollows', width: 32, height: 26, theme: 'cave',
    spawn: { x: 16, y: 22 },
    blocks: [
      { kind: 'wall', x: 1, y: 1, w: 7, h: 8 },
      { kind: 'wall', x: 24, y: 1, w: 7, h: 8 },
      { kind: 'wall', x: 1, y: 18, w: 7, h: 7 },
      { kind: 'wall', x: 25, y: 17, w: 6, h: 8 },
      { kind: 'column', x: 11, y: 12, w: 2, h: 2 },
      { kind: 'column', x: 21, y: 14, w: 2, h: 2 },
      { kind: 'water', x: 3, y: 10, w: 4, h: 5 }
    ],
    objects: [
      { id: 'cave-exit', type: 'travel', label: 'Return to Mossvale', x: 16, y: 23.5, target: 'mossvale' },
      { id: 'cave-brazier', type: 'rest', label: 'An old brazier', x: 9, y: 19 },
      { id: 'cave-inscription', type: 'inspect', label: 'Miners’ inscription', x: 22.5, y: 9 },
      { id: 'cave-relic', type: 'reward', label: 'An amber reliquary', x: 16, y: 5 }
    ]
  },
  temple: {
    id: 'temple', name: 'The Windward Terrace', width: 32, height: 26, theme: 'temple',
    spawn: { x: 16, y: 22 },
    blocks: [
      { kind: 'chasm', x: 1, y: 1, w: 5, h: 24 },
      { kind: 'chasm', x: 26, y: 1, w: 5, h: 24 },
      { kind: 'column', x: 9, y: 8, w: 1.5, h: 1.5 },
      { kind: 'column', x: 21.5, y: 8, w: 1.5, h: 1.5 },
      { kind: 'column', x: 9, y: 17, w: 1.5, h: 1.5 },
      { kind: 'column', x: 21.5, y: 17, w: 1.5, h: 1.5 }
    ],
    objects: [
      { id: 'temple-exit', type: 'travel', label: 'Descend to Mossvale', x: 16, y: 23.5, target: 'mossvale' },
      { id: 'temple-brazier', type: 'rest', label: 'A sheltered flame', x: 12, y: 20 },
      { id: 'star-chart', type: 'inspect', label: 'A weathered star chart', x: 22.5, y: 13 },
      { id: 'temple-relic', type: 'reward', label: 'A silent observatory', x: 16, y: 4.5 }
    ]
  }
};

const SEEDS = {
  mossvale: [
    { id: 'thorn-a', x: 11, y: 14, type: 'thornling', maxHp: 45 },
    { id: 'thorn-b', x: 32.5, y: 15, type: 'thornling', maxHp: 45 },
    { id: 'thorn-c', x: 36, y: 21, type: 'thornling', maxHp: 45 }
  ],
  cave: [
    { id: 'crawl-a', x: 10, y: 14, type: 'crawler', maxHp: 52 },
    { id: 'crawl-b', x: 21, y: 11.5, type: 'crawler', maxHp: 52 },
    { id: 'crawl-c', x: 16, y: 8, type: 'crawler', maxHp: 65 }
  ],
  temple: [
    { id: 'stone-a', x: 15.5, y: 13, type: 'warden', maxHp: 90 },
    { id: 'stone-b', x: 17.5, y: 8, type: 'warden', maxHp: 90 }
  ]
};

export const JOURNAL = {
  'arrival': { title: 'Ashes & ivy', text: 'Moss has softened the edges of the ruins. There is warmth by the lanterns, and room to choose your own way.' },
  'seen:keeper': { title: 'A light still burning', text: 'Someone tends the hearth near the southern square. You can speak with them, or keep walking.' },
  'seen:signpost': { title: 'Old roads', text: 'A weathered sign stands north of the hearth.' },
  'seen:well': { title: 'The village well', text: 'The old well remains among the broken streets.' },
  'seen:ward': { title: 'A broken ward', text: 'There is a faint glimmer among the stones west of the square.' },
  'seen:cave-mouth': { title: 'Below the hill', text: 'A dark passage opens beneath the western hill. Warm air rises from it.' },
  'seen:high-stair': { title: 'Above the mist', text: 'Beyond the eastern ruins, a stair rises into bright cloud.' },
  'seen:fallen-banner': { title: 'A fallen banner', text: 'A torn banner lies beyond the eastern square.' },
  'read:signpost': { title: 'Two worn arrows', text: 'One arrow points northwest, beneath the hill. Another points northeast, toward the high steps. Neither road asks a promise.' },
  'read:well': { title: 'An ordinary echo', text: 'The well is deep, but the water below still reflects the sky.' },
  'read:ward': { title: 'A careful touch', text: 'You brushed moss from the ward without breaking its remaining stones. A small kindness to an old place.' },
  'read:fallen-banner': { title: 'A name remembered', text: 'The faded stitching reads Mossvale. You leave the banner where the sun can reach it.' },
  'helpedKeeper': { title: 'A kindness returned', text: 'You helped shelter the hearth. The keeper shared a safer way around the western ruins.' },
  'entered:cave': { title: 'The Amber Hollows', text: 'Torchlight catches the seams of an abandoned gallery. The stairs behind you remain open.' },
  'entered:temple': { title: 'The Windward Terrace', text: 'Weathered stone hangs above a sea of cloud. You can return down the stair whenever you choose.' },
  'read:cave-inscription': { title: 'Names in the stone', text: 'Miners carved their names here, each one a little different. The last line is unfinished.' },
  'read:star-chart': { title: 'A sky of small lights', text: 'The chart names familiar constellations. Several brass markers have been carefully polished.' },
  'clear:cave': { title: 'A quiet gallery', text: 'The small gallery is safe to explore. An amber reliquary stands near its northern wall.' },
  'clear:temple': { title: 'The wind settles', text: 'The terrace wardens have fallen still. The observatory is within reach.' },
  'read:cave-relic': { title: 'Amber remembered', text: 'A warm fragment rests in the reliquary. You record its shape and leave it undisturbed. This short demo ends here; the road home is open.' },
  'read:temple-relic': { title: 'A moment above the clouds', text: 'For a moment, all you hear is the wind. You sketch the observatory in your journal. This short demo ends here; the stair home is open.' }
};

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function seedEnemies(id) {
  return SEEDS[id].map(e => ({ ...e, hp: e.maxHp, homeX: e.x, homeY: e.y, windup: 0, attackTimer: 1.2 }));
}

export function createGame(classId = 'ranger') {
  const heroClass = Object.hasOwn(CLASSES, classId) ? classId : 'ranger';
  const state = {
    version: 1, location: 'mossvale',
    hero: { ...MAPS.mossvale.spawn, hp: 100, classId: heroClass, facingX: 0, facingY: -1 },
    discoveries: ['arrival'], visited: ['mossvale'],
    explored: { mossvale: [], cave: [], temple: [] },
    choices: { helpedKeeper: false },
    cleared: { cave: false, temple: false },
    enemies: Object.fromEntries(Object.keys(MAPS).map(id => [id, seedEnemies(id)])),
    impacts: [], attackFx: 0, abilityFx: 0, cooldown: 0, abilityCooldown: 0,
    dead: false, moving: false, time: 0, path: [], revealCell: ''
  };
  reveal(state);
  return state;
}

export function canWalk(mapId, x, y) {
  const map = MAPS[mapId];
  if (!map || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = 0.22;
  if (x < 1 + r || y < 1 + r || x > map.width - 1 - r || y > map.height - 1 - r) return false;
  return !map.blocks.some(b =>
    x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h
  );
}

export function lineOfSight(mapId, a, b) {
  const steps = Math.ceil(distance(a, b) * 5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!canWalk(mapId, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

export function findPath(mapId, start, goal) {
  const map = MAPS[mapId];
  if (!map) return [];
  const sx = Math.floor(start.x), sy = Math.floor(start.y);
  let gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  if (!canWalk(mapId, gx + 0.5, gy + 0.5)) {
    const nearby = [];
    for (let y = gy - 2; y <= gy + 2; y++) {
      for (let x = gx - 2; x <= gx + 2; x++) {
        if (canWalk(mapId, x + 0.5, y + 0.5)) nearby.push({ x, y });
      }
    }
    nearby.sort((a, b) => Math.hypot(a.x - goal.x, a.y - goal.y) - Math.hypot(b.x - goal.x, b.y - goal.y));
    if (!nearby.length) return [];
    gx = nearby[0].x; gy = nearby[0].y;
  }
  const key = (x, y) => x + ',' + y;
  const begin = key(sx, sy), target = key(gx, gy);
  const queue = [{ x: sx, y: sy }];
  const previous = new Map([[begin, null]]);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i], at = key(point.x, point.y);
    if (at === target) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = point.x + dx, y = point.y + dy, next = key(x, y);
      if (!previous.has(next) && canWalk(mapId, x + 0.5, y + 0.5)) {
        previous.set(next, at);
        queue.push({ x, y });
      }
    }
  }
  if (!previous.has(target)) return [];
  const result = [];
  for (let at = target; at !== begin && at; at = previous.get(at)) {
    const [x, y] = at.split(',').map(Number);
    result.unshift({ x: x + 0.5, y: y + 0.5 });
  }
  return result;
}

export function addDiscovery(state, id) {
  if (!state.discoveries.includes(id)) state.discoveries.push(id);
}

export function reveal(state) {
  const map = MAPS[state.location];
  const cell = state.location + ':' + Math.floor(state.hero.x) + ',' + Math.floor(state.hero.y);
  if (state.revealCell === cell) return;
  state.revealCell = cell;
  const explored = new Set(state.explored[state.location]);
  for (let y = Math.floor(state.hero.y) - 6; y <= state.hero.y + 6; y++) {
    for (let x = Math.floor(state.hero.x) - 6; x <= state.hero.x + 6; x++) {
      if (x >= 0 && y >= 0 && x < map.width && y < map.height &&
          Math.hypot(x + 0.5 - state.hero.x, y + 0.5 - state.hero.y) < 6.3) {
        explored.add(x + ',' + y);
      }
    }
  }
  state.explored[state.location] = [...explored];
  for (const object of map.objects) {
    if (distance(state.hero, object) < 4.1) addDiscovery(state, 'seen:' + object.id);
  }
}

export function moveHero(state, dx, dy, dt) {
  if (state.dead || !Number.isFinite(dt) || dt <= 0) return;
  const length = Math.hypot(dx, dy);
  state.moving = length > 0;
  if (!length) return;
  dx /= length; dy /= length;
  state.hero.facingX = dx; state.hero.facingY = dy;
  const step = Math.min(dt, 0.25) * 3.8;
  if (canWalk(state.location, state.hero.x + dx * step, state.hero.y)) state.hero.x += dx * step;
  if (canWalk(state.location, state.hero.x, state.hero.y + dy * step)) state.hero.y += dy * step;
  reveal(state);
}

export function enterLocation(state, mapId) {
  if (!Object.hasOwn(MAPS, mapId)) return false;
  state.location = mapId;
  state.hero.x = MAPS[mapId].spawn.x;
  state.hero.y = MAPS[mapId].spawn.y;
  state.path = [];
  state.impacts = [];
  state.revealCell = '';
  state.moving = false;
  if (!state.visited.includes(mapId)) state.visited.push(mapId);
  if (mapId !== 'mossvale') addDiscovery(state, 'entered:' + mapId);
  reveal(state);
  return true;
}

export function nearbyObject(state) {
  return MAPS[state.location].objects
    .filter(o => distance(state.hero, o) < 1.9)
    .sort((a, b) => distance(state.hero, a) - distance(state.hero, b))[0] || null;
}

export function inCombat(state) {
  return state.enemies[state.location].some(e => e.hp > 0 && distance(e, state.hero) < 4);
}

function impact(state, target, label, color = '#f1dca6') {
  state.impacts.push({ x: target.x, y: target.y - 0.65, label, color, life: 0.9 });
  if (state.impacts.length > 20) state.impacts.shift();
}

function hit(state, enemy, damage) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  impact(state, enemy, String(damage));
  if (!enemy.hp) enemy.windup = 0;
}

export function attack(state) {
  if (state.dead || state.cooldown > 0) return false;
  const profile = CLASSES[state.hero.classId];
  const enemies = state.enemies[state.location].filter(e =>
    e.hp > 0 && distance(e, state.hero) <= profile.range && lineOfSight(state.location, state.hero, e)
  ).sort((a, b) => distance(a, state.hero) - distance(b, state.hero));
  if (!enemies.length) return false;
  hit(state, enemies[0], profile.damage);
  state.cooldown = 0.45;
  state.attackFx = 0.24;
  state.lastTarget = { x: enemies[0].x, y: enemies[0].y };
  checkClear(state);
  return true;
}

export function useAbility(state) {
  if (state.dead || state.abilityCooldown > 0) return false;
  const id = state.hero.classId;
  if (id === 'cleric') {
    const restored = Math.min(35, 100 - state.hero.hp);
    if (!restored) return false;
    state.hero.hp += restored;
    impact(state, state.hero, '+' + restored, '#a9d9a3');
  } else {
    const melee = id === 'knight' || id === 'monk';
    const range = melee ? 2.5 : id === 'ranger' ? 6 : 3.7;
    const targets = state.enemies[state.location]
      .filter(e => e.hp > 0 && distance(e, state.hero) < range && lineOfSight(state.location, state.hero, e))
      .sort((a, b) => distance(a, state.hero) - distance(b, state.hero));
    if (!targets.length) return false;
    for (const enemy of id === 'ranger' ? targets.slice(0, 1) : targets) hit(state, enemy, id === 'ranger' ? 48 : 36);
  }
  state.abilityCooldown = 5;
  state.abilityFx = 0.6;
  checkClear(state);
  return true;
}

function checkClear(state) {
  if (state.location !== 'mossvale' && !state.cleared[state.location] &&
      state.enemies[state.location].every(e => e.hp <= 0)) {
    state.cleared[state.location] = true;
    addDiscovery(state, 'clear:' + state.location);
    impact(state, state.hero, 'The way is quiet', '#e4c57e');
  }
}

export function advanceCombat(state, dt) {
  dt = clamp(Number(dt) || 0, 0, 0.1);
  state.time += dt;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.abilityCooldown = Math.max(0, state.abilityCooldown - dt);
  state.attackFx = Math.max(0, state.attackFx - dt);
  state.abilityFx = Math.max(0, state.abilityFx - dt);
  for (const hit of state.impacts) { hit.life -= dt; hit.y -= dt * 0.45; }
  state.impacts = state.impacts.filter(hit => hit.life > 0);
  if (state.dead) return;
  const hearth = MAPS[state.location].objects.find(o => o.type === 'rest');
  const safe = hearth && distance(state.hero, hearth) < 2.8;
  for (const enemy of state.enemies[state.location]) {
    if (enemy.hp <= 0) continue;
    enemy.attackTimer -= dt;
    if (enemy.windup > 0) {
      enemy.windup -= dt;
      if (enemy.windup <= 0) {
        if (distance(enemy, state.hero) < ENEMY_ATTACK_RADIUS && !safe) {
          const damage = enemy.type === 'warden' ? 17 : 10;
          state.hero.hp = Math.max(0, state.hero.hp - damage);
          impact(state, state.hero, '-' + damage, '#ef9c83');
        }
        enemy.attackTimer = 1.65;
      }
      continue;
    }
    const dist = distance(enemy, state.hero);
    if (safe || dist > 6.5 || !lineOfSight(state.location, enemy, state.hero)) continue;
    if (dist < 1.5 && enemy.attackTimer <= 0) {
      enemy.windup = 0.8;
    } else if (dist > 1.15) {
      const speed = enemy.type === 'warden' ? 0.7 : 1.15;
      const dx = (state.hero.x - enemy.x) / dist * speed * dt;
      const dy = (state.hero.y - enemy.y) / dist * speed * dt;
      if (canWalk(state.location, enemy.x + dx, enemy.y)) enemy.x += dx;
      if (canWalk(state.location, enemy.x, enemy.y + dy)) enemy.y += dy;
    }
  }
  checkClear(state);
  if (state.hero.hp <= 0) {
    state.dead = true;
    state.path = [];
    state.moving = false;
  }
}

export function recover(state) {
  const failed = state.location;
  if (failed !== 'mossvale' && !state.cleared[failed]) state.enemies[failed] = seedEnemies(failed);
  state.hero.hp = 100;
  state.dead = false;
  state.cooldown = 0;
  state.abilityCooldown = 0;
  enterLocation(state, 'mossvale');
}

export function saveGame(storage, state) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage) {
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || 'null');
    if (!data || data.version !== 1 || !data.hero || !Object.hasOwn(MAPS, data.location) ||
        !Object.hasOwn(CLASSES, data.hero.classId) ||
        !Number.isFinite(data.hero.hp) || data.hero.hp < 0 || data.hero.hp > 100 ||
        !canWalk(data.location, data.hero.x, data.hero.y)) return createGame();
    const state = createGame(data.hero.classId);
    state.location = data.location;
    state.hero = { ...state.hero, x: data.hero.x, y: data.hero.y, hp: data.hero.hp };
    state.dead = state.hero.hp === 0;
    state.choices.helpedKeeper = data.choices?.helpedKeeper === true;
    state.discoveries = Array.isArray(data.discoveries)
      ? [...new Set(data.discoveries.filter(id => typeof id === 'string' && id.length < 80))].slice(0, 128)
      : ['arrival'];
    state.visited = Array.isArray(data.visited) ? data.visited.filter(id => Object.hasOwn(MAPS, id)) : ['mossvale'];
    for (const id of Object.keys(MAPS)) {
      state.explored[id] = Array.isArray(data.explored?.[id])
        ? data.explored[id].filter(v => typeof v === 'string' && /^\d{1,2},\d{1,2}$/.test(v)).slice(0, 1800)
        : [];
      if (id !== 'mossvale') state.cleared[id] = data.cleared?.[id] === true;
      for (const enemy of state.enemies[id]) {
        const saved = Array.isArray(data.enemies?.[id]) && data.enemies[id].find(e => e.id === enemy.id);
        if (!saved) continue;
        if (Number.isFinite(saved.hp)) enemy.hp = clamp(saved.hp, 0, enemy.maxHp);
        if (canWalk(id, saved.x, saved.y)) { enemy.x = saved.x; enemy.y = saved.y; }
      }
    }
    state.revealCell = '';
    reveal(state);
    return state;
  } catch {
    return createGame();
  }
}

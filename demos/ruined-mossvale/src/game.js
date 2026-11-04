import {
  CLASSES,
  MAPS,
  JOURNAL,
  SAVE_KEY,
  createGame,
  loadGame,
  saveGame,
  findPath,
  moveHero,
  stopHero,
  enterLocation,
  nearbyObject,
  distance,
  reveal,
  addDiscovery,
  attack,
  useAbility,
  advanceCombat,
  recover,
  inCombat,
} from './world.js';
import { renderWorld, renderCharacterPreview } from './render.js';
import { APPEARANCE_OPTIONS, defaultAppearance, sanitizeAppearance } from './appearance.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#world');
const dialog = $('#game-dialog');
const keys = new Set();
const media = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
let sessionOnly = false;
try {
  storage = window.localStorage;
  const probe = SAVE_KEY + '-probe';
  storage.setItem(probe, '1');
  storage.removeItem(probe);
} catch {
  sessionOnly = true;
  const memory = new Map();
  storage = {
    getItem: key => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value),
  };
}
let state = loadGame(storage);
let camera = { cameraX: 0, cameraY: 0, scale: 52 };
let reducedMotion = media.matches;
let autoInteract = null;
let lastFrame = performance.now();
let hudTimer = 0;
let saveTimer = 0;
let toastTimer;
let firstMovement = true;
let lastFocused = null;
let activeDialogCleanup = null;

for (const [id, profile] of Object.entries(CLASSES)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = profile.name;
  $('#class-select').append(option);
}
$('#class-select').value = state.hero.classId;

function notify(message, duration = 3500) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(
    () => $('#toast').classList.remove('visible'),
    duration
  );
}

function persist() {
  const saved = saveGame(storage, state);
  $('#save-status').textContent =
    sessionOnly || !saved
      ? 'Session only · browser storage is unavailable'
      : 'Your progress stays in this browser';
  return saved;
}

function clearInput() {
  keys.clear();
  stopHero(state);
  document
    .querySelectorAll('.move-button')
    .forEach(button => button.classList.remove('pressed'));
}

function closeDialog() {
  dialog.close();
}

function paragraph(text, parent = $('#dialog-content')) {
  const p = document.createElement('p');
  p.textContent = text;
  parent.append(p);
  return p;
}

function openDialog(
  title,
  paragraphs = [],
  actions = [],
  eyebrow = 'MOSSVALE'
) {
  activeDialogCleanup?.();
  activeDialogCleanup = null;
  dialog.classList.remove('appearance-dialog');
  clearInput();
  state.path = [];
  autoInteract = null;
  lastFocused = document.activeElement;
  $('#dialog-title').textContent = title;
  $('#dialog-eyebrow').textContent = eyebrow;
  $('#dialog-content').replaceChildren();
  $('#dialog-actions').replaceChildren();
  paragraphs.forEach(text => paragraph(text));
  for (const action of actions) {
    const button = document.createElement('button');
    button.textContent = action.label;
    if (action.primary) button.classList.add('primary');
    if (action.danger) button.classList.add('danger');
    button.addEventListener('click', action.run);
    $('#dialog-actions').append(button);
  }
  if (!dialog.open) dialog.showModal();
  persist();
}

dialog.addEventListener('close', () => {
  activeDialogCleanup?.();
  activeDialogCleanup = null;
  clearInput();
  lastFrame = performance.now();
  if (state.dead) {
    // A downed hero cannot resume combat by dismissing the recovery surface.
    queueMicrotask(openRecovery);
    return;
  }
  if (lastFocused?.isConnected && lastFocused !== document.body)
    lastFocused.focus();
  else canvas.focus({ preventScroll: true });
});
dialog.addEventListener('cancel', event => {
  if (state.dead) event.preventDefault();
});
$('#dialog-close').addEventListener('click', () => {
  if (!state.dead) closeDialog();
});

function travel(target) {
  if (!Object.hasOwn(MAPS, target)) return;
  closeDialog();
  const previous = state.location;
  enterLocation(state, target);
  // Returning along a known entrance places you by that entrance in the ruins.
  if (target === 'mossvale' && previous !== 'mossvale') {
    const entrance = MAPS.mossvale.objects.find(
      object => object.target === previous
    );
    state.hero.x = entrance.x;
    state.hero.y = entrance.y + 1.5;
    state.revealCell = '';
    reveal(state);
  }
  autoInteract = null;
  updateHud();
  persist();
  canvas.focus({ preventScroll: true });
}

function walkTo(object) {
  closeDialog();
  state.path = findPath(state.location, state.hero, object);
  autoInteract = object.id;
  if (!state.path.length && distance(state.hero, object) >= 1.9)
    notify('That path is blocked. Try approaching from another side.');
  canvas.focus({ preventScroll: true });
}

function interact(object = nearbyObject(state)) {
  if (!object || state.dead) {
    notify('Move closer to a landmark to interact.');
    return;
  }
  if (distance(state.hero, object) >= 1.95) return;
  if (object.type === 'travel') {
    const returning = object.target === 'mossvale';
    openDialog(
      object.label,
      [
        returning
          ? 'The road back is open. The ruins will be waiting.'
          : object.target === 'cave'
            ? 'Warm air moves between the stones. A narrow stair leads into a gallery below.'
            : 'Wind brushes the worn steps. Pale stone waits above the mist.',
      ],
      [
        {
          label: returning ? 'Return to Mossvale' : 'Step through',
          primary: true,
          run: () => travel(object.target),
        },
        { label: 'Keep exploring here', run: closeDialog },
      ],
      returning ? 'THE WAY HOME' : 'A PATH DISCOVERED'
    );
    return;
  }
  if (object.type === 'rest') {
    if (inCombat(state)) {
      notify('Draw away from nearby foes before resting.');
      return;
    }
    state.hero.hp = 100;
    persist();
    notify('You rest by the flame. Vitality restored.');
    return;
  }
  if (object.id === 'keeper') {
    openDialog(
      'The lantern keeper',
      [
        state.choices.helpedKeeper
          ? '“The fire holds, thanks to you. There are still good roads here, if you look for them.”'
          : '“I keep a little light for whoever passes through. Stay a while, or take the old roads. You owe me neither.”',
      ],
      [
        ...(state.choices.helpedKeeper
          ? []
          : [
              {
                label: 'Help shelter the flame',
                primary: true,
                run: () => {
                  state.choices.helpedKeeper = true;
                  state.hero.hp = 100;
                  addDiscovery(state, 'helpedKeeper');
                  addDiscovery(state, 'seen:cave-mouth');
                  closeDialog();
                  notify(
                    'The keeper shares the western landmark. Your journal remembers.'
                  );
                  persist();
                },
              },
            ]),
        {
          label: 'Ask about the old roads',
          run: () => {
            addDiscovery(state, 'read:signpost');
            openDialog(
              'The old roads',
              [
                '“Northwest, a stair goes beneath the hill. Northeast, another goes above the cloud. Both have been quiet a long time.”',
                '“The sign near the well still points the way.”',
              ],
              [{ label: 'Thank the keeper', primary: true, run: closeDialog }],
              'A LITTLE LOCAL KNOWLEDGE'
            );
          },
        },
        { label: 'Leave them to the fire', run: closeDialog },
      ]
    );
    return;
  }
  if (object.type === 'reward' && !state.cleared[state.location]) {
    notify('Nearby guardians still stir. Give yourself room to face them.');
    return;
  }
  addDiscovery(state, 'read:' + object.id);
  const note = JOURNAL['read:' + object.id];
  const paragraphs = note
    ? [note.text]
    : ['Time and weather have left their marks here.'];
  const actions = [];
  if (object.id === 'signpost') {
    actions.push(
      {
        label: 'Follow the western road',
        run: () => walkTo(MAPS.mossvale.objects.find(o => o.target === 'cave')),
      },
      {
        label: 'Follow the high steps',
        run: () =>
          walkTo(MAPS.mossvale.objects.find(o => o.target === 'temple')),
      }
    );
  }
  actions.push({
    label: 'Continue exploring',
    primary: true,
    run: closeDialog,
  });
  openDialog(
    note?.title || object.label,
    paragraphs,
    actions,
    object.type === 'reward' ? 'A SMALL DISCOVERY' : 'AMONG THE RUINS'
  );
}

function openJournal() {
  openDialog(
    'Your field journal',
    [
      'Only the things you have encountered are recorded here. There is no prescribed order.',
    ],
    [{ label: 'Back to the road', primary: true, run: closeDialog }],
    'LEAVES FROM THE JOURNEY'
  );
  for (const id of state.discoveries) {
    const entry = JOURNAL[id];
    if (!entry) continue;
    const section = document.createElement('section');
    section.className = 'journal-entry';
    const title = document.createElement('h3');
    title.textContent = entry.title;
    section.append(title);
    paragraph(entry.text, section);
    $('#dialog-content').append(section);
  }
}


function openAppearance() {
  if (inCombat(state) || state.dead) {
    notify('Find a quiet spot before changing your look.');
    return;
  }
  let draft = sanitizeAppearance(state.hero.appearance);
  let draftClass = state.hero.classId;
  let facing = Math.PI / 2;
  let pose = 'idle';
  let animationFrame;
  openDialog(
    'Make this hero yours',
    [],
    [
      {
        label: 'Save look',
        primary: true,
        run: () => {
          state.hero.appearance = sanitizeAppearance(draft);
          state.hero.classId = draftClass;
          persist();
          updateHud();
          closeDialog();
          notify('Your look is saved for this journey.');
        },
      },
      { label: 'Cancel', run: closeDialog },
    ],
    'YOUR CHARACTER'
  );
  dialog.classList.add('appearance-dialog');
  const layout = document.createElement('div');
  layout.className = 'appearance-layout';
  const preview = document.createElement('section');
  preview.className = 'appearance-preview';
  preview.setAttribute('aria-label', 'Character preview');
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = 300;
  previewCanvas.height = 280;
  previewCanvas.setAttribute('role', 'img');
  previewCanvas.setAttribute('aria-label', 'Your character appearance preview');
  const previewName = document.createElement('p');
  previewName.className = 'appearance-class-name';
  const rotation = document.createElement('div');
  rotation.className = 'appearance-rotation';
  for (const [label, turn] of [['Turn left', -1], ['Turn right', 1]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => { facing += turn * Math.PI / 2; });
    rotation.append(button);
  }
  const poses = document.createElement('div');
  poses.className = 'appearance-poses';
  poses.setAttribute('role', 'group');
  poses.setAttribute('aria-label', 'Preview animation');
  for (const id of ['idle', 'walk', 'attack']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = id[0].toUpperCase() + id.slice(1);
    button.setAttribute('aria-pressed', String(id === pose));
    button.addEventListener('click', () => {
      pose = id;
      for (const sibling of poses.children) {
        sibling.setAttribute('aria-pressed', String(sibling === button));
      }
    });
    poses.append(button);
  }
  preview.append(previewCanvas, previewName, rotation, poses);
  const fields = document.createElement('div');
  fields.className = 'appearance-fields';
  const controls = {};
  function addSelect(labelText, id, options, value, onChange) {
    const label = document.createElement('label');
    label.htmlFor = 'appearance-' + id;
    label.textContent = labelText;
    const select = document.createElement('select');
    select.id = label.htmlFor;
    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.label;
      select.append(element);
    }
    select.value = value;
    select.addEventListener('change', () => onChange(select.value));
    label.append(select);
    fields.append(label);
    controls[id] = select;
  }
  addSelect(
    'Class to try',
    'class',
    Object.entries(CLASSES).map(([id, profile]) => ({ id, label: profile.name })),
    draftClass,
    value => { draftClass = value; }
  );
  const labels = {
    skinTone: 'Skin tone',
    hairStyle: 'Hair style',
    hairColor: 'Hair color',
    outfit: 'Clothing palette',
    accent: 'Metal trim',
    build: 'Build',
  };
  for (const field of ['skinTone', 'hairStyle', 'hairColor', 'outfit', 'accent', 'build']) {
    addSelect(labels[field], field, APPEARANCE_OPTIONS[field], draft[field], value => {
      draft[field] = value;
    });
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'appearance-reset';
  reset.textContent = 'Reset look';
  reset.addEventListener('click', () => {
    draft = defaultAppearance();
    for (const field of Object.keys(draft)) controls[field].value = draft[field];
  });
  fields.append(reset);
  layout.append(preview, fields);
  $('#dialog-content').append(layout);
  const note = paragraph(
    'Your class keeps its own silhouette and equipment. These choices change your look, not your combat stats. This solo demo lets you try every class.'
  );
  note.className = 'prototype-note';
  function animatePreview(now) {
    const time = now / 1000;
    const moving = pose === 'walk';
    const attackFx = pose === 'attack' ? Math.max(0, 0.24 - (time % 1.3)) : 0;
    const hero = {
      ...state.hero,
      classId: draftClass,
      appearance: draft,
      facingX: Math.cos(facing),
      facingY: Math.sin(facing),
      motion: {
        ...state.hero.motion,
        speed: moving ? 3.8 : 0,
        phase: moving ? time * 9 : 0,
        heading: facing,
        leanX: moving ? Math.cos(facing) * 0.4 : 0,
        leanY: moving ? Math.sin(facing) * 0.4 : 0,
      },
    };
    previewName.textContent = CLASSES[draftClass].name;
    renderCharacterPreview(previewCanvas, hero, {
      time, facing, moving, attackFx, reducedMotion,
      classColor: CLASSES[draftClass].color,
    });
    animationFrame = requestAnimationFrame(animatePreview);
  }
  activeDialogCleanup = () => cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animatePreview);
}

function openHelp() {
  openDialog(
    'A few things for the road',
    [
      'Walk wherever you like. Speak to people, examine landmarks, or simply follow a path. Nothing asks you to accept a quest first.',
    ],
    [{ label: 'I am ready to wander', primary: true, run: closeDialog }],
    'CONTROLS'
  );
  for (const [key, description] of [
    ['WASD / arrows', 'Walk'],
    ['Click / tap the ground', 'Walk to that point'],
    ['E / Interact', 'Speak, examine or enter'],
    ['Space / Attack', 'Attack the nearest foe in range'],
    ['Q / Ability', 'Use your class ability'],
    ['J', 'Open your journal'],
    ['C', 'Customize your character'],
    ['Esc', 'Pause'],
  ]) {
    const line = document.createElement('div');
    line.className = 'control-line';
    const label = document.createElement('kbd');
    label.textContent = key;
    const detail = document.createElement('span');
    detail.textContent = description;
    line.append(label, detail);
    $('#dialog-content').append(line);
  }
  paragraph(
    'On touch screens, hold a direction button to move. A red ring signals an attack: move away before it lands.'
  );
  const note = paragraph(
    'A solo prototype: one ruined village and two short encounters. Your discoveries stay in this browser.'
  );
  note.className = 'prototype-note';
}

function openPause() {
  openDialog(
    'A moment by the road',
    [],
    [
      { label: 'Continue exploring', primary: true, run: closeDialog },
      ...(state.location === 'mossvale'
        ? []
        : [
            {
              label: 'Return to Mossvale',
              run: () => travel('mossvale'),
            },
          ]),
      { label: 'Start a fresh demo', run: confirmReset },
    ],
    'PAUSED'
  );
  const row = document.createElement('label');
  row.className = 'setting-row';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = reducedMotion;
  checkbox.addEventListener('change', () => {
    reducedMotion = checkbox.checked;
  });
  row.append(
    checkbox,
    document.createTextNode('Reduce ambient motion and effects')
  );
  $('#dialog-content').append(row);
  paragraph(
    sessionOnly
      ? 'Browser storage is unavailable. You can still play for this session.'
      : 'Your discoveries and encounter progress are saved in this browser.'
  );
  const note = paragraph(
    'An isolated exploration prototype. Your Eldritch Fable account and live game are separate.'
  );
  note.className = 'prototype-note';
}

function confirmReset() {
  openDialog(
    'Start a fresh demo?',
    [
      'This clears only this demo’s local discoveries and encounter progress. Your live game and account are unaffected.',
    ],
    [
      { label: 'Keep exploring', primary: true, run: closeDialog },
      {
        label: 'Start again',
        danger: true,
        run: () => {
          const classId = state.hero.classId;
          state = createGame(classId);
          closeDialog();
          persist();
          updateHud();
          notify('A fresh road begins. You are free to wander.');
        },
      },
    ],
    'LOCAL SAVE'
  );
}

function openRecovery() {
  if (!state.dead) return;
  openDialog(
    'The light finds you',
    [
      'Your strength gives out. There is still warmth among the ruins.',
      'Wake in Mossvale when you are ready. Your discoveries remain with you.',
    ],
    [
      {
        label: 'Wake in Mossvale',
        primary: true,
        run: () => {
          recover(state);
          closeDialog();
          persist();
          updateHud();
          notify('You wake by the hearth. The next step is yours.');
        },
      },
    ],
    'A RETURN'
  );
}

function doAttack(showHint = true) {
  const success = attack(state);
  if (!success && showHint && state.cooldown <= 0)
    notify('No foe in reach. Move closer, or try another path.');
}
function doAbility() {
  if (state.abilityCooldown > 0) return;
  const success = useAbility(state);
  if (!success)
    notify(
      state.hero.classId === 'cleric'
        ? 'Your vitality is already full.'
        : 'No foe within your ability’s reach.'
    );
}

$('#appearance-button').addEventListener('click', openAppearance);
$('#journal-button').addEventListener('click', openJournal);
$('#help-button').addEventListener('click', openHelp);
$('#pause-button').addEventListener('click', openPause);
$('#attack-button').addEventListener('click', () => doAttack());
$('#ability-button').addEventListener('click', doAbility);
$('#interact-button').addEventListener('click', () => interact());
$('#class-select').addEventListener('change', event => {
  if (inCombat(state) || state.dead) return;
  const id = event.target.value;
  if (Object.hasOwn(CLASSES, id)) {
    state.hero.classId = id;
    persist();
    updateHud();
    canvas.focus({ preventScroll: true });
    notify(CLASSES[id].name + ' · ' + CLASSES[id].hint);
  }
});

const moveCodes = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

window.addEventListener('keydown', event => {
  if (
    dialog.open ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
  )
    return;
  if (moveCodes[event.code]) {
    event.preventDefault();
    keys.add(moveCodes[event.code]);
    state.path = [];
    autoInteract = null;
  } else if (event.code === 'Space') {
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    keys.add('attack');
  } else if (!event.repeat) {
    if (event.code === 'KeyE') {
      event.preventDefault();
      interact();
    }
    if (event.code === 'KeyQ') {
      event.preventDefault();
      doAbility();
    }
    if (event.code === 'KeyC') {
      event.preventDefault();
      openAppearance();
    }
    if (event.code === 'KeyJ') {
      event.preventDefault();
      openJournal();
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      openPause();
    }
  }
});
window.addEventListener('keyup', event => {
  if (moveCodes[event.code]) keys.delete(moveCodes[event.code]);
  if (event.code === 'Space') keys.delete('attack');
});
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => {
  clearInput();
  persist();
  lastFrame = performance.now();
});
window.addEventListener('pagehide', persist);

for (const button of document.querySelectorAll('[data-move]')) {
  const direction = button.dataset.move;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (dialog.open || state.dead) return;
    button.setPointerCapture(event.pointerId);
    keys.add(direction);
    button.classList.add('pressed');
    state.path = [];
    autoInteract = null;
  });
  const release = () => {
    keys.delete(direction);
    button.classList.remove('pressed');
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
$('#attack-button').addEventListener('pointerdown', event => {
  if (dialog.open || state.dead) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  keys.add('attack');
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  $('#attack-button').addEventListener(event, () => keys.delete('attack'));
}

canvas.addEventListener('pointerdown', event => {
  if (dialog.open || state.dead || !event.isPrimary) return;
  canvas.focus({ preventScroll: true });
  const rect = canvas.getBoundingClientRect();
  const goal = {
    x: camera.cameraX + (event.clientX - rect.left) / camera.scale,
    y: camera.cameraY + (event.clientY - rect.top) / camera.scale,
  };
  const object = MAPS[state.location].objects.find(
    o => distance(o, goal) < 0.8
  );
  state.path = findPath(state.location, state.hero, object || goal);
  autoInteract = object?.id || null;
  if (object && distance(state.hero, object) < 1.9) interact(object);
});
canvas.addEventListener('contextmenu', event => {
  event.preventDefault();
  state.path = [];
  autoInteract = null;
});

function updateHud() {
  const profile = CLASSES[state.hero.classId];
  const map = MAPS[state.location];
  $('#location-name').textContent = map.name;
  $('#region-kind').textContent =
    map.theme === 'ruins'
      ? 'THE RUINS'
      : map.theme === 'cave'
        ? 'BENEATH THE HILL'
        : 'ABOVE THE MIST';
  $('#class-select').value = state.hero.classId;
  $('#class-select').disabled = inCombat(state) || state.dead;
  $('#appearance-button').disabled = inCombat(state) || state.dead;
  document.documentElement.style.setProperty('--hero-color', profile.color);
  $('#hero-symbol').textContent = ['knight', 'monk'].includes(
    state.hero.classId
  )
    ? '⚔'
    : state.hero.classId === 'cleric'
      ? '✧'
      : state.hero.classId === 'ranger'
        ? '➶'
        : '✦';
  $('#health-text').textContent = Math.ceil(state.hero.hp) + ' / 100';
  $('#health-bar').setAttribute(
    'aria-valuenow',
    String(Math.ceil(state.hero.hp))
  );
  $('#health-bar').firstElementChild.style.width = state.hero.hp + '%';
  $('#ability-name').textContent = profile.ability;
  $('#ability-button').title = profile.hint;
  $('#ability-button').setAttribute(
    'aria-label',
    profile.ability + ': ' + profile.hint
  );
  $('#ability-cooldown').textContent =
    state.abilityCooldown > 0 ? Math.ceil(state.abilityCooldown) + 's' : '';
  $('#ability-button').disabled = state.dead || state.abilityCooldown > 0;
  const object = nearbyObject(state);
  $('#interaction-prompt').hidden = !object || dialog.open || state.dead;
  $('#interaction-label').textContent = object?.label || '';
  $('#interact-button').disabled = !object || state.dead;
  $('#attack-button').disabled = state.dead;
}

function frame(now) {
  const dt = Math.min(Math.max(0, (now - lastFrame) / 1000), 0.25);
  lastFrame = now;
  let remaining = dt;
  // Fixed small simulation steps preserve movement speed and collision on slow devices.
  while (remaining > 0 && !dialog.open && !document.hidden && !state.dead) {
    const step = Math.min(remaining, 0.025);
    remaining -= step;
    let dx = Number(keys.has('right')) - Number(keys.has('left'));
    let dy = Number(keys.has('down')) - Number(keys.has('up'));
    if (dx || dy) {
      state.path = [];
      moveHero(state, dx, dy, step);
    } else if (state.path.length) {
      const next = state.path[0];
      const d = distance(state.hero, next);
      if (d < 0.12) {
        state.path.shift();
        if (!state.path.length) stopHero(state);
      } else {
        dx = next.x - state.hero.x;
        dy = next.y - state.hero.y;
        moveHero(state, dx, dy, Math.min(step, d / 3.8));
      }
      if (autoInteract) {
        const target = MAPS[state.location].objects.find(
          o => o.id === autoInteract
        );
        if (target && distance(state.hero, target) < 1.75) {
          state.path = [];
          autoInteract = null;
          interact(target);
        }
      }
    } else moveHero(state, 0, 0, step);
    if (firstMovement && state.moving) {
      firstMovement = false;
      $('#walking-hint').style.opacity = '0.45';
    }
    if (keys.has('attack')) doAttack(false);
    advanceCombat(state, step);
    if (state.dead) openRecovery();
  }
  camera = renderWorld(canvas, state, { time: now / 1000, reducedMotion });
  hudTimer += dt;
  saveTimer += dt;
  if (hudTimer > 0.12) {
    updateHud();
    hudTimer = 0;
  }
  if (saveTimer > 2) {
    persist();
    saveTimer = 0;
  }
  requestAnimationFrame(frame);
}

media.addEventListener('change', event => {
  reducedMotion = event.matches;
});
updateHud();
persist();
notify(
  'The next step is yours. Walk, look around, or follow an old road.',
  5500
);
requestAnimationFrame(frame);
if (state.dead) openRecovery();

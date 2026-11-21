import { resolveAppearance } from '../../shared/appearance-catalog.mjs';

// Original vector paintings, drawn in the actors' local coordinates with the feet at (0, 0).
// Review forms separately: quarry-warden (armored), quarry-seer (robed), quarry-repairer and quarry-crawler.
// The paths stay at full resolution across different camera scales and device pixel ratios.
const contours = new Map();
const TAU = Math.PI * 2;
const ink = '#1a1921';
const colors = {
  ranger: '#687c54', knight: '#73949a', bard: '#a96056', monk: '#aa8255',
  mage: '#7b65a5', wizard: '#536eae', cleric: '#b39e70', sorcerer: '#a66052',
};

function contour(data) {
  let result = contours.get(data);
  if (!result) {
    result = new Path2D(data);
    contours.set(data, result);
  }
  return result;
}

function paint(c, data, fill, outline = ink, width = 1) {
  const path = contour(data);
  if (fill) { c.fillStyle = fill; c.fill(path); }
  if (outline) { c.strokeStyle = outline; c.lineWidth = width; c.stroke(path); }
}

function glint(c, data, color, width = 0.85) {
  paint(c, data, null, color, width);
}

function glaze(c, x1, y1, x2, y2, stops) {
  const gradient = c.createLinearGradient(x1, y1, x2, y2);
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  return gradient;
}

function shadow(c, width) {
  c.save();
  c.translate(1.5, 0.3);
  c.scale(width, width * 0.31);
  const wash = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  wash.addColorStop(0, 'rgba(10,11,20,.60)');
  wash.addColorStop(0.57, 'rgba(12,14,23,.40)');
  wash.addColorStop(1, 'rgba(14,16,24,0)');
  c.fillStyle = wash;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
}

function coatPaint(c, dye) {
  return glaze(c, -12, -56, 11, -17, [[0,'#e4caa1'],[0.15,dye],[0.69,'#3f4048'],[1,'#242b36']]);
}

function metalPaint(c) {
  return glaze(c, -9, -7, 7, 10, [[0,'#fff0c2'],[0.19,'#9cacaa'],[0.4,'#4e6971'],[0.74,'#334851'],[1,'#98877a']]);
}

function leg(c, x, y, swing, front) {
  c.save();
  c.translate(x, y);
  c.rotate(0.23 * swing);
  paint(c, 'M-3.7 0 Q0 -2.5 3.7 0 L3 9 Q3 12 .7 14 L-3 13 Q-4.8 6 -3.7 0Z', front ? '#524443' : '#34333c');
  c.translate(-0.5, 11.5);
  c.rotate(-0.36 * Math.max(0, -swing));
  paint(c, 'M-3 -1 Q-.6 -2.5 2.7 -.9 L3.6 1.9 2 7.8 2.3 11.3 Q4.2 12.2 6 12.4 Q8.2 13.3 7.4 15 Q4 16 -.1 15.6 L-3.3 15.1 Q-4.3 14 -3.7 12.5 L-3.1 6.6Z', front ? '#684c3e' : '#443637');
  paint(c, 'M-4.2 -1.1 Q-.9 -2.7 3.5 -1.3 L3.1 1.9 Q-.4 .5 -3.6 2.6Z', front ? '#a58562' : '#6c5d50', '#30272a', 0.7);
  glint(c, 'M-2 4 Q-.3 5 1.9 4.5 M-2.2 7.3 L1.3 6.3 M.2 12.3 Q4.2 11.9 5.2 13.1', front ? '#a58266' : '#655650', 0.6);
  glint(c, 'M-3.1 14.7 Q.2 16 6.8 14.6', '#b19972', 0.8);
  c.restore();
}

function fittedCoat(c, p, robe, back, variant) {
  const hem = robe
    ? 'M-10 -56 Q-5 -61 2 -59 Q9 -60 12 -54 L8 -40 Q8 -29 15 -12 Q12 -7 5 -9 L1 -6 -4 -9 Q-12 -7 -16 -12 Q-9 -28 -9 -41Z'
    : 'M-11 -55 Q-6 -61 1 -59 Q8 -61 12 -53 L8 -41 Q7 -35 12 -25 L7 -22 1 -25 -4 -21 -12 -24 Q-9 -33 -9 -41Z';
  paint(c, hem, coatPaint(c, p.outfit), '#25242c', 1.3);
  if (robe) {
    paint(c, 'M-6.4 -40 Q-8.7 -26 -13.6 -12.4 Q-11.8 -9.9 -8.7 -10.4 L-3 -36Z', '#242b43', null);
    paint(c, 'M3.7 -39 Q3.3 -24 5.5 -10.2 L9.3 -10.1 Q6.5 -27 6.1 -39Z', '#b1a490', null);
    glint(c, 'M-14.2 -13 Q-11 -10 -6 -11 L-.8 -8.8 4 -11 Q9 -9.7 13 -12.8 M-4 -35 Q-5 -20 -7 -13', p.accent, 0.95);
  } else {
    paint(c, 'M-10 -39 Q-7 -33 -9 -26 L-5 -23 -2 -26 -2 -38Z', '#493a33', '#312a2b', 0.7);
    glint(c, 'M5 -36 Q5 -29 8.3 -25.6 M-8.9 -29.2 L-5.2 -28.6', p.accent, 0.8);
  }
  if (back) {
    paint(c, 'M-9 -56 Q-4 -61 4 -60 Q9 -58 10 -54 L5 -48 Q-.3 -47 -6 -50Z', '#5e5453');
    glint(c, 'M-8 -55 Q-1 -51 7 -55', p.accent);
  } else if (robe) {
    paint(c, 'M-8 -56 Q-5 -60 -2 -59 Q-2 -53 2 -49 Q5 -54 5 -59 L9 -57 Q8 -51 3.8 -46 L1.3 -42 -1.4 -46Z', '#c9b89b', '#4d4948', 0.75);
    glint(c, 'M-3.6 -56.5 L1.4 -48 6.5 -54.7 M-1.5 -41 Q2 -39 5 -41', '#e4d4ae', 1);
    paint(c, 'M-1.4 -48 Q.5 -50 3.3 -48.8 L4.3 -46.7 1.8 -43.4 -1.1 -45Z', '#829fb1', p.accent, 1);
  } else {
    const cuirass = glaze(c,-10,-59,9,-35,[[0,'#d8c899'],[0.23,'#869693'],[0.51,'#556770'],[0.8,'#32424c'],[1,'#726655']]);
    paint(c, 'M-8.7 -54.6 L-3 -57.3 Q-.6 -54 4.4 -56.9 L9.9 -54.2 8 -47.3 5.8 -38.5 .4 -35.6 -6 -38.5 -8.9 -46Z', cuirass, '#2b3336');
    glint(c,'M-7.2 -52.9 Q-3.8 -54 -1.4 -51.7 L.5 -40.6 3.3 -51.3 7.8 -53.3 M-5.2 -39.1 L0 -37 4.6 -39.1','#cebf91',0.9);
    paint(c, 'M-4 -57.7 L-1.8 -58.8 9.2 -43 7.6 -40.9Z', '#6e4b35', '#3d302d', 0.75);
    glint(c,'M.1 -52.2 L2.8 -53.1 4.3 -50.8 1.4 -49.7Z',p.accent,0.8);
  }
  paint(c,'M-8.6 -39.8 Q1 -37.1 8 -40 L8.2 -36.7 Q1.5 -33.9 -8.9 -36.8Z','#5f4437','#342b29',0.8);
  paint(c,'M-.5 -38.3 L3.6 -38.5 3.9 -35.8 -.6 -35.4Z',p.accent,'#463c32',0.65);
  paint(c,'M-8.8 -37.6 Q-5.5 -38 -4.7 -36.1 L-5.1 -31.5 Q-7.5 -30.4 -10 -32.2 L-10.1 -35.6Z','#8a6649');
  glint(c,'M-9.7 -35 Q-7.2 -33.7 -5.3 -35.2','#bc9b71',0.65);
  if (variant) glint(c,'M6 -36 L5 -29.2 6.7 -26.3 M7.7 -36.7 L7.4 -31.2 9 -29.4',p.accent,1);
}

function mantle(c, palette, robe, swing) {
  c.save();
  c.translate(-5,-56);
  c.rotate(swing * 0.035);
  const cloth = glaze(c,-15,0,8,35,[[0,palette.outfit],[0.25,robe?'#625776':'#52605b'],[0.64,robe?'#3b354e':'#364547'],[1,'#242d37']]);
  paint(c, 'M2 -1 Q-5 -3 -9 4 Q-9 16 -16 29 L-13 29 -16 36 Q-12 38 -9 37 L-5 40 -2 36 2 36 Q0 26 4 18 Q7 7 6 2Z',cloth,'#222933',1.2);
  paint(c, 'M-5 5 Q-6 20 -12 30 L-9 34 Q-4 27 -2 13Z','#aaa19055',null);
  glint(c, 'M-11 32 L-12 35 -8.7 35.7 -5.1 37.8 -2.2 34.1 M-8 7 Q-8.7 18 -12.2 24.3',palette.accent,0.7);
  c.restore();
}

function head(c, p, back, smith, lean) {
  c.save(); c.translate(0,-65); c.rotate(lean);
  paint(c, 'M-3.7 1.5 Q-.4 4 3.2 2.1 L3.6 6.1 6 7.2 Q2.1 10 -4.8 6.9 L-3.5 5Z', p.skin, '#493c38', 0.75);
  const hair = glaze(c,-8,-9,6,7,[[0,smith?'#f0dbac':'#baab93'],[0.35,p.hair],[1,'#34303b']]);
  if (smith) {
    paint(c,'M-6.5 -7.4 C-12 -12 -15 -8 -13 -4 Q-12 -1 -9 -1 Q-14 1 -11 3 Q-7 4 -3 -.6Z',hair);
    glint(c,'M-12 -6 Q-9.5 -9 -7.5 -7.5 M-11.5 -3.6 Q-10.3 -4 -9 -5.4','#d6bda3',0.7);
  }
  if (p.hairStyle === 'long' || p.hairStyle === 'braid') {
    paint(c,'M-6.7 -5 Q-9 -2 -7.5 3.7 Q-6.8 8.8 -9 13.4 L-6.9 12.2 -7.3 16.6 Q-2.1 14.3 -1.3 8.4 L-.2 -.6Z',hair);
    glint(c,'M-6.1 2.1 Q-3.8 6.9 -7 12.9', '#b09a7c',0.65);
    if (p.hairStyle === 'braid') glint(c,'M-6.6 4 L-3.3 6.2 -6.2 9.2 -4.3 10.3 -6.5 12.6',p.accent,0.8);
  }
  const skin = glaze(c,-4,-8,7,4,[[0,'#ffe5b7'],[0.31,p.skin],[0.65,p.skin],[1,'#805f52']]);
  paint(c,'M-6.7 -5 C-5.5 -10.3 1 -11.3 4.9 -8 Q7.3 -6.3 6.9 -3.5 L8.9 -.8 Q9 .1 7 .2 L6.5 2.5 Q6.1 4 3.4 5 L-.2 5.8 -3.8 3.8 -4.6 .9 Q-7.9 .6 -7.4 -2.1Z',skin,'#403439',0.9);
  if (!back) {
    paint(c,'M-1 -4.7 Q2.2 -6.9 5.8 -5.1 L5.5 -4.2 Q2 -4.9 .9 -2.9Z','#624c46',null);
    glint(c,'M1.5 -3.1 Q3.3 -4.1 5.1 -3.5 M4.4 .5 L6 .1 M3 2.7 Q4.6 2.1 5.9 2.3','#59403d',0.68);
    glint(c,'M.6 -4.8 L3.8 -5.4 M2.2 -1.7 L4.9 -2.1','#efc999',0.72);
    glint(c,'M-5.2 -2.5 Q-7.1 -3.5 -6.1 -1.1 L-4.2 -.2','#89604e',0.7);
    if (smith) {
      glint(c,'M-.8 -4 Q1 -6 3.1 -4.5 Q4.9 -2.2 2.7 -1 Q.3 0 -.6 -2.2Z M3.7 -4 L5.5 -4.2 M-1 -3.4 L-5 -4.3',p.accent,1);
      glint(c,'M-2 1.1 L.9 .4 M-.2 2.7 L1 2.3','#8a695c',0.62);
    }
  }
  if (back || p.hairStyle !== 'shaved') {
    const cut = back ? 'M-7 -1 Q-8 -5.9 -5.1 -8.6 Q-2.3 -12 2 -10.3 Q6.8 -10.4 7.1 -6.1 L6.5 -.8 3.2 .6 3.7 2.9 -.5 2.1 -2 4.1 -5 2.3 -6.4 3.3Z'
      : 'M-6.9 -1.6 Q-9.2 -6.6 -4.1 -9.5 Q-1.1 -11.8 2 -10.3 Q7.2 -11 7.6 -7.1 L5.1 -6.6 4.3 -7.6 Q.2 -7.3 -2.6 -4.4 L-3.6 -1.3 -4.9 -3.1 -7 -2.6Z';
    paint(c,cut,hair,'#3e3338',0.85);
    glint(c,'M-6 -6 Q-2.6 -10 .9 -9 M-.8 -7 Q2.9 -9.4 5.6 -8',smith?'#e6ceae':'#ab9781',0.7);
  }
  if (smith) {
    paint(c,'M-7.8 -7 Q-1.4 -10.5 7 -7.2 L7.2 -5.5 Q.8 -7.8 -7.2 -4.8Z','#89554b','#483a36',0.7);
    glint(c,'M-6.5 -6.6 Q-.5 -9.2 6.6 -7.1','#d99b71',0.75);
  }
  c.restore();
}

function weapon(c, kind, p) {
  const wood = '#76563a';
  if (kind === 'ranger') {
    paint(c, 'M4 -22 C-.5 -17 1.5 -11 -2 -6 Q-6 .8 -3 5.5 Q-.5 10.4 -.4 15.5 Q-.5 19 2.2 22.6 Q-2.8 20.3 -3.9 14 Q-4.3 11.1 -6.1 6 Q-8.2 -.4 -4.8 -7 Q-.9 -12 -1.1 -15 Q-1.1 -19 4 -22Z',wood,'#302b29',0.85);
    glint(c, 'M4 -21.6 L-1 -1 2.2 22.3', '#d2c5a8',0.52);
    glint(c, 'M-.5 -15 Q-.4 -10 -4 -4 M-3.5 9 Q-2 16.7 .3 20','#c3a370',0.72);
  } else if (kind === 'knight' || kind === 'warden' || kind === 'death-knight') {
    paint(c,'M-1.3 -3 L-1.4 -21.3 1.9 -30.3 3.3 -21.6 1.9 -3 0 -.9Z','#aeb9af','#333d42',0.85);
    glint(c,'M1.9 -27.5 L.7 -5.1','#f4e0b9',0.95);
    paint(c,'M-5.7 -4.9 Q-3.4 -2.8 -.2 -3.3 Q3 -3.4 5.6 -4.5 L5.1 -1.8 2.1 -.9 .7 .4 -1.2 -.7 -4.7 -1.1Z',p.accent,'#4a3e35',0.7);
    glint(c,'M.3 -.1 L0 6',wood,2);
  } else if (kind === 'smith') {
    glint(c,'M.3 3 L-.5 -13.4','#342b29',3.4);
    glint(c,'M.2 3 L-.3 -13.5','#b58d65',1.7);
    paint(c,'M-6.7 -16.5 L1.2 -17.1 4 -15.6 6.1 -14.8 4.6 -12.8 1.7 -13.3 -5.8 -12Z','#718182');
    glint(c,'M-6 -15.5 L1 -16.3 4.1 -14.6','#d6d0b6',1);
  } else if (kind === 'monk') {
    glint(c,'M0 -23 Q1 -11 -1.8 21',wood,3);
    glint(c,'M.3 -22 L.4 -13 M-1.1 13 L-1.8 20.2',p.accent,1.1);
  } else if (kind === 'bard') {
    paint(c, 'M0 -15.5 L2 -16.4 2.2 -5.2 Q6.5 -4.8 7.6 .4 Q9.4 5.4 6.8 9.5 Q3.1 13.2 -1.1 10.5 Q-6 7.8 -4.3 3.5 Q-3.9 -.2 -.1 -4.8Z', '#ac7148');
    glint(c, 'M.5 -14 L1.5 7 M1.8 -14 L2.8 7','#e6c699',0.62);
  } else {
    paint(c,'M-2.5 20.7 L-1.5 -11.2 Q-5.3 -14 -4.6 -17.7 Q-4.3 -20.6 -2.4 -22.8 Q-3.9 -16.7 -1.1 -15.5 Q1.1 -15 2.5 -17.8 L3.2 -22.8 Q6.5 -18.1 4.5 -14.7 L1 -11 -.5 21.5Z',wood,'#3c3533',0.9);
    paint(c, 'M-1.8 -18 Q-2.3 -21.4 .8 -24.9 Q4.4 -20.8 1.5 -17.4Z', kind === 'sorcerer'?'#efa768':'#95c9c5',p.accent,0.75);
    glint(c,'M-1 -10.2 L.9 -10.8 M-1 -8.3 L.7 -8.7 M-1 17.2 L-.6 21',p.accent,0.85);
  }
}

function arm(c, x, y, p, kind, near, tilt, forearm) {
  const smith = kind === 'smith';
  c.save(); c.translate(x,y); c.rotate(tilt);
  paint(c,'M-3.5 -.7 Q-1.7 -3.2 1.3 -2 Q4.6 -.8 4.1 2.4 L3 9.5 1 12.1 -3 10.4 Q-4.2 4.3 -3.5 -.7Z',smith?'#a59173':p.outfit,'#37343b');
  paint(c, 'M-3.1 6.6 Q.7 8 3.6 6.4 L3.4 9 Q.8 10.3 -3.4 9Z',smith?'#ded2b8':'#687273','#4b4643',0.7);
  c.translate(0,9.6); c.rotate(forearm);
  paint(c, 'M-2.9 -.7 Q-.1 -2.2 2.7 -.6 L3.1 3.2 1.9 7.7 -1.5 8.2 -2.8 5Z',smith ? p.skin : '#785d4e','#443c39',0.8);
  if (!smith) {
    paint(c, 'M-2.6 2 Q.3 3 2.9 1.5 L2.5 5.6 1.7 7.3 -1.9 7.5Z',near?'#849193':'#586568','#414344',0.7);
    glint(c,'M-1.8 3.6 L2.4 3 M-1.4 6.3 L1.7 5.7',p.accent,0.65);
  }
  c.translate(.2,8);
  if (near) {
    // Keep the implement clear of the forearm as elbow and shoulder turn.
    const toolPitch = kind === 'ranger' ? 0.18 : smith ? 0.2 - tilt * 1.65 : 0.28 - tilt * 0.9;
    c.save(); c.rotate(toolPitch - tilt - forearm);
    weapon(c,kind,p);
    c.restore();
  }
  paint(c,'M-2.2 -.7 Q-1.5 -1.9 .5 -1.3 L1.9 -.6 Q4.1 -1.5 4.6 .1 L3.9 1.4 2.5 2.2 1.1 3 -1 2.4 -2 1.5Z',p.skin,'#534239',0.75);
  glint(c,'M.7 1.5 L2.6 .4', '#b78866',0.55);
  c.restore();
}

function apron(c) {
  const leather = glaze(c,-10,-55,8,-21,[[0,'#d5a57d'],[0.25,'#9d6950'],[0.62,'#745044'],[1,'#493c39']]);
  paint(c,'M-6.7 -57.3 L-3.2 -54.2 3 -54.6 5.2 -58.4 7.4 -56.6 6.9 -48.7 8.7 -43.2 8.3 -37.7 12.2 -23.8 Q3.6 -19.4 -8 -21.6 L-11.6 -24.1 -7.4 -38.8 -9.3 -50.3Z',leather,'#473730',0.95);
  glint(c,'M-7.6 -49.7 L-6.1 -39.1 -9.4 -24.5 Q-6 -22.5 -1.8 -22.7 M4.7 -51.5 L4.2 -44.2 -2.1 -43.9 -2.7 -49.9Z','#d4aa7d',0.75);
  glint(c,'M-2.6 -47.7 L4.8 -48.7 M-9.2 -35.1 Q-1 -32.6 9 -36.6','#453835',2.4);
  paint(c,'M3.9 -36.4 L6.3 -36.7 9.5 -26.9 8.4 -24.2 7.5 -27.2Z','#858981','#423e37',0.6);
  glint(c,'M-2.8 -32.5 L-4.4 -30.2 M1.2 -29.5 L-.4 -28.2 M-3.5 -27.7 L-5 -27.1','#c4926c',0.55);
}

function human(c, actor, back) {
  const { kind, action = 'idle', variant = 0 } = actor;
  const smith = kind === 'smith';
  const calling = String(actor.classId || (kind === 'seer' || variant % 2 ? 'mage' : 'knight')).toLowerCase();
  const role = smith ? 'smith' : calling;
  const robe = ['mage','wizard','cleric','sorcerer'].includes(calling) && !smith;
  const p = smith ? {skin:'#b48269',hair:'#b9ada0',hairStyle:'cropped',outfit:'#8b8470',accent:'#dbb779',widthScale:1.09,heightScale:0.93} :
    resolveAppearance(actor.appearance, colors[calling] || '#849d9b');
  const time = Number.isFinite(actor.time) ? actor.time : 0;
  const gait = action === 'walk' ? Math.sin(time * 9 + variant * 0.8) : 0;
  const cycle = (1 - Math.cos(time * (smith ? 4.5 : 8.5))) / 2;
  const striking = action === 'attack' || action === 'skill' || (smith && action === 'work');
  const thrust = striking ? cycle : 0;
  c.scale(p.widthScale,p.heightScale);
  if (action === 'dead') { c.scale(1,0.76); c.rotate(-0.24); }
  leg(c,-4.7,-27.6,gait,false);
  leg(c,4.9,-25.6,-gait,true);
  c.save();
  c.translate(action === 'hit' ? -2.3 : 0,-Math.abs(gait) * 1.1 + Math.sin(time*2.2) * 0.35);
  c.rotate(action === 'hit' ? -0.055 : (smith ? 0.062 : 0) + thrust * 0.04);
  if (!smith && !back) mantle(c,p,robe,gait);
  const handSwing = 0.14 * gait;
  arm(c,-8.8,-54.2,p,role,false,0.12+handSwing + (smith ? -0.25 : 0),smith ? -0.9 : -0.1);
  fittedCoat(c,p,robe,back,variant % 2);
  if (smith && !back) apron(c);
  if (!smith && back) mantle(c,p,robe,gait);
  if (!smith && robe) {
    paint(c,'M-9.9 -56.2 Q-5.1 -61.3 .2 -60.8 Q5.4 -61.5 9.5 -57.6 L11.3 -53 Q6.8 -54.7 3.3 -51.1 L.6 -47.4 -2.9 -50.7 Q-7.6 -52 -12.6 -51.7Z',p.outfit,'#32323f',0.9);
    glint(c,'M-10.3 -53.4 Q-5.6 -54.6 -2 -52.8 L.5 -49 3.2 -53 Q6.3 -55.6 9 -55.5',p.accent,0.85);
  }
  head(c,p,back,smith,smith?0.08+thrust*0.04:0.018*gait);
  if (!smith && !robe) {
    c.save(); c.translate(-8.8,-55.2);
    paint(c,'M-6.4 2.5 Q-5.8 -4.9 .1 -5.4 Q4 -5.3 5.3 -1.7 L4.9 1.6 Q.2 2.5 -2 6.5 L-6.7 5.2Z',metalPaint(c));
    glint(c,'M-5.1 2.7 Q-3.9 -3.8 .3 -4 M-5.2 4.8 L-2.8 5.6 Q.2 2 4.3 1.1',p.accent,0.85);
    c.restore();
  }
  arm(c,8.5,-54.8,p,role,true,-0.13-handSwing - thrust * (smith?0.72:0.78),-0.28 - (smith?1.01:0.37) + thrust * (smith?-0.49:0.42));
  if (action === 'skill') {
    c.save();
    c.globalAlpha *= 0.45 + 0.3 * cycle;
    glint(c,'M12 -61 Q30 -53 28 -35 Q28 -26 21 -21 M17 -59 Q33 -47 29 -33', '#b5e5d8',1.4);
    c.restore();
  }
  c.restore();
}

function crawlerLeg(c, x, y, length, near, lift) {
  c.save();
  c.translate(x,y); c.scale(length,1);
  c.rotate(lift);
  const chitin = near ? '#74635e' : '#433e4a';
  paint(c,'M-2 -1 Q1.3 -3.9 4 -2.1 L10.6 -.5 Q13.5 0 15.2 3.2 L15.7 5.7 11.9 5.6 8.2 2.9 3.2 2.5 1.5 4.1Z',chitin,'#272734',1.1);
  paint(c,'M11.3 3.5 Q15.6 2.1 17.3 5.6 L19 12.4 24.8 18.7 21.7 18.9 18.4 16 14.9 13.7 12.5 7.2Z',near?'#746c6a':'#484453','#272734',.85);
  paint(c,'M19.7 14.8 L23.4 16.6 25.4 20.6 29 21.7 25.2 22.4 22.8 21.2 21.3 18.4Z','#55525a','#262634',0.75);
  glint(c,'M4.5 -1.5 L9.5 -.2 12.8 2.6 M15.9 6.1 L17.6 11.3',near?'#c0a48a':'#736e79',0.8);
  c.restore();
}

function shellPlate(c, x, y, scale, tilt, dark) {
  c.save(); c.translate(x,y); c.rotate(tilt); c.scale(scale,scale);
  const shell=glaze(c,-8,-11,8,10,[[0,'#ddc9a4'],[0.19,dark?'#989588':'#b2a78c'],[0.43,dark?'#736e72':'#958979'],[0.66,'#63606b'],[0.86,'#454553'],[1,'#8a8682']]);
  paint(c,'M-10.4 -1 Q-11.8 -7 -6.6 -10 Q-2.2 -13 3 -10.4 L6.4 -11.9 7.1 -7.6 Q10.1 -5.3 10.8 -.9 L9.4 3.8 10.1 7.2 6.5 6.8 3.5 10.6 -.2 8.2 -3.3 9.8 -5 6.3 -8.2 6.8 -8.1 3.3Z',shell,'#373541',1.25);
  paint(c,'M-7.8 -2 Q-6.4 -8.4 -.7 -9.5 L3 -8.8 -.2 -6.4 -2 -1.7 -4.4 -2.9 -5.5 1Z','#c2b69b',null);
  paint(c,'M2.8 -7.4 L3.7 -3.3 6.3 -2.1 5.2 .9 7.3 4.5 4.9 4.3 2.8 7.4 2.5 2.2 .8 .1 1.4 -2.4Z','#666575',null);
  glint(c,'M-9 -.3 Q-10 -6.8 -5.8 -8.7 L-1.5 -9.9 M1.8 -7 L-.2 -3.4 1.3 -1.7 -1.8 2.1 -1.7 4.7 M-.3 -3.5 L-3.5 -4.3', '#e3d6af',0.82);
  glint(c,'M-4.5 4.3 L-2.8 7.1 M5.1 .9 L3.7 2.3 M7.8 -.8 L8.1 1.3','#a0a0a3',0.65);
  c.restore();
}

function crawler(c, time, action, back) {
  const gait = action === 'walk' ? Math.sin(time*7.8) : 0;
  const warning = action === 'windup' || action === 'warning' || action === 'telegraph';
  const attack = action === 'attack' ? (1-Math.cos(time*12))*0.5 : 0;
  if (back) c.transform(1, -0.1, 0, 1, 0, 0);
  if (action === 'dead') { c.scale(1,0.53); c.globalAlpha *= 0.78; }
  c.translate(attack*2.6 + (action==='hit'?-2:0), -Math.abs(gait)*0.8);
  for (const [x,y,len] of [[-18,-22,-0.88],[-7,-24,-0.27],[10,-25,0.63],[19,-25,0.8]]) {
    crawlerLeg(c,x,y,len,false,0.45+gait*0.06);
  }
  const belly=glaze(c,-21,-27,17,-7,[[0,'#817878'],[.45,'#62586b'],[1,'#333543']]);
  paint(c,'M-32 -20 Q-33 -30 -24 -34 Q-11 -44 7 -35 L17 -30 26 -27 Q34 -23 33 -18 Q31 -12 22 -10 L17 -8 10 -10 5 -8 -2 -9 -6 -7 -15 -10 -22 -11 Q-31 -13 -32 -20Z',belly);
  for(const [x,y,len,phase] of [[-19,-17,-0.8,1],[-9,-17,-0.55,-1],[2,-15,0.25,1],[13,-18,.77,-1]]) {
    crawlerLeg(c,x,y,len,true,-0.21+phase*gait*0.1);
  }
  c.save();
  c.translate(0,warning?-1.5+Math.sin(time*7)*.8:Math.sin(time*2)*.45);
  shellPlate(c,-23,-22,.78,-.59,true);
  shellPlate(c,-14,-26,.98,-.38,false);
  shellPlate(c,-3,-28,1.06,-.12,false);
  shellPlate(c,7,-26,.91,.13,true);
  c.restore();
  c.save(); c.translate(23+attack*2.4,-21-(warning?2:0)); c.rotate(warning?-.12:attack*.09);
  const skull = glaze(c,-7,-12,10,7,[[0,'#e4d1aa'],[.29,'#ac9b8b'],[.66,'#74767e'],[1,'#4e4e5c']]);
  paint(c,'M-12 -4 Q-11 -10 -6.5 -10.8 L-4.7 -14.8 -1 -11.4 4 -13.3 4.2 -9.2 8 -10.7 8.7 -6.3 12.1 -2.2 12.3 2.6 9.3 5.4 8.7 9.2 5.1 7.8 2 9.1 -2.8 6.3 -7.1 6.2 -8.2 2.6Z',skull);
  paint(c,'M4.5 -.1 Q8.8 -2.8 11.7 -.9 L11.8 1.8 9.1 2.4 7 .9 5.2 2.2Z','#282d37');
  glint(c,'M6.6 .1 L8.1 -.3 M9.6 -.8 L11 -.8',warning?'#ffbb65':'#bee1c4',1.45);
  glint(c,'M-7.4 -6.5 L-4.4 -8.5 -1.4 -7.3 1.2 -9 M-.7 -3.4 L3.5 -4.8 4.7 -3.7','#eee0bb',.85);
  c.save(); c.translate(5,6); c.rotate(warning?-.24:attack*.22);
  paint(c,'M-2.1 -2.4 Q2 -2.4 4.2 .6 Q7.2 3.5 12.6 .6 Q11.5 4.2 8.1 5.5 Q2.7 7.2 -1.3 3.9 L-3.6 1.5Z','#c0a487','#544749',.9);
  glint(c,'M.8 1.4 Q5.7 6 10.2 3','#f0d8af',.82); c.restore();
  glint(c,'M9.7 -3.4 Q15.7 -8.8 19.4 -6.8 M8.1 -5 Q12.2 -12.8 16.9 -12.9','#afa798',.75);
  c.restore();
}

/** Draw an original actor at its ground contact. Time is seconds. Keep reduced motion at time zero. */
export function drawQuarryActor(ctx, actor) {
  const { kind = 'hero', x, y, scale = 1, facing = 'right', action = 'idle', time = 0 } = actor;
  const heading = typeof facing === 'string' ? facing.toLowerCase() : null;
  const left = heading ? /left|west|^(?:nw|sw|w)$/.test(heading) : Math.cos(facing) < -0.05;
  const back = heading ? /up|north|^(?:nw|ne|n)$/.test(heading) : Math.sin(facing) < -0.3;
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.lineJoin='round'; ctx.lineCap='round';
  shadow(ctx,kind==='crawler'?44:18);
  ctx.scale(left?-1:1,1);
  if(kind==='crawler') crawler(ctx,time,action,back);
  else human(ctx,actor,back);
  ctx.restore();
}

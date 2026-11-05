import { useEffect, useRef } from 'react';
import { drawHero } from '../../shared/hero-renderer.mjs';
import { LANDMARKS } from '../../shared/exploration-catalog.mjs';
import { advancePose, createPose, visibleEffects, MAX_RENDER_ACTORS } from './render-motion.js';
import {
  WIDTH, HEIGHT, DEFAULT_REGION_ID, regionById, CLASSES, tile as worldTile, type Realm, type Player, type RealmEffect, type ResourceNode,
} from './shared/game';

const S = 32;
const W = WIDTH * S;
const H = HEIGHT * S;
const TAU = Math.PI * 2;
type Effect = RealmEffect;
type RenderRealm = Realm & { effects?: Effect[] };
type Pose = ReturnType<typeof createPose>;

function random(x: number, y: number, salt = 0) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill();
}
function stroke(c: CanvasRenderingContext2D, color: string, width: number, points: number[][]) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
}
function glow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color); g.addColorStop(1, 'transparent'); c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function tree(c: CanvasRenderingContext2D, x: number, y: number, seed: number, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  ellipse(c, 9, 7, 29, 11, '#030b1290');
  const trunk = c.createLinearGradient(-6, 0, 7, 0);
  trunk.addColorStop(0, '#17252a'); trunk.addColorStop(.55, '#555044'); trunk.addColorStop(1, '#172a2c');
  c.fillStyle = trunk; c.beginPath(); c.moveTo(-7, 12); c.lineTo(-4, -43); c.lineTo(4, -43); c.lineTo(8, 13); c.closePath(); c.fill();
  stroke(c, '#776957', 1, [[-1, -33], [1, 9], [5, 13]]);
  const shades = ['#11252d', '#17343a', '#244343', '#35504b'];
  for (let i = 0; i < 4; i++) {
    const top = -72 + i * 13;
    c.fillStyle = shades[i]; c.beginPath(); c.moveTo(-2, top);
    c.bezierCurveTo(-11, top + 11, -18 - i * 3, top + 15, -27 - i * 2, top + 26);
    c.bezierCurveTo(-8, top + 24, 3, top + 33, 28 + i * 2, top + 27);
    c.bezierCurveTo(15, top + 15, 8, top + 15, -2, top); c.fill();
    stroke(c, seed > .5 ? '#55706470' : '#4c646670', 1.2, [[-3, top + 8], [-11, top + 18], [-21, top + 24]]);
  }
  if (seed > .78) { ellipse(c, -16, -20, 2, 1.2, '#d9b67b'); ellipse(c, 17, -36, 1.5, 1, '#b4ccc0'); }
  c.restore();
}
function terrain(regionId: string) {
  const region = regionById(regionId);
  const { spawn: SPAWN, shrine: SHRINE } = region;
  const tile = (x: number, y: number) => worldTile(x, y, regionId);
  const highlands = region.theme === 'highlands', coast = region.theme === 'coast';
  const colors = highlands ? ['#695638', '#877448', '#4d493b'] : coast ? ['#304a57', '#53716e', '#243b50'] : ['#162f36', '#263e36', '#1a2b31'];
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const c = layer.getContext('2d')!;
  const ground = c.createLinearGradient(0, 0, W, H);
  ground.addColorStop(0, colors[0]); ground.addColorStop(.6, colors[1]); ground.addColorStop(1, colors[2]);
  c.fillStyle = ground; c.fillRect(0, 0, W, H);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const kind = tile(x, y); const n = random(x, y);
    const px = x * S; const py = y * S;
    if (kind === 'water') {
      c.fillStyle = coast ? '#193e57' : highlands ? '#405453' : '#102a39'; c.fillRect(px, py, S, S);
      const bank = tile(x - 1, y) !== 'water' || tile(x + 1, y) !== 'water';
      if (bank) { c.fillStyle = '#47727550'; c.fillRect(px, py, S, S); }
    } else if (kind === 'path') {
      c.fillStyle = highlands ? '#ad9060' : coast ? '#818c88' : '#716550'; c.fillRect(px, py, S, S);
      c.fillStyle = '#a4936a20'; c.fillRect(px, py + 8, S, 17);
      for (let i = 0; i < 5; i++) {
        ellipse(c, px + random(x,y,i+1)*S, py+random(x,y,i+9)*S, 1+random(x,y,i+18)*2, .7, '#b4a27a50');
      }
      if (tile(x,y-1) === 'grass') { c.fillStyle = '#33443870'; c.fillRect(px, py, S, 3); }
      if (tile(x,y+1) === 'grass') { c.fillStyle = '#23362d80'; c.fillRect(px, py+29, S, 3); }
    } else if (kind === 'bridge') {
      c.fillStyle = '#4d4035'; c.fillRect(px, py, S, S);
      for (let k = 0; k < 4; k++) {
        const plank = c.createLinearGradient(0, py+k*8, 0, py+k*8+7);
        plank.addColorStop(0,'#baa176'); plank.addColorStop(1,'#7c6850'); c.fillStyle=plank; c.fillRect(px,py+k*8,S,7);
        stroke(c,'#514b3b80',.6,[[px+3,py+k*8+4],[px+25,py+k*8+3]]);
        ellipse(c,px+3,py+k*8+2,1,.8,'#4b4c46'); ellipse(c,px+28,py+k*8+2,1,.8,'#4b4c46');
      }
      if (y===11 || y===13) { c.fillStyle='#493b32';c.fillRect(px,py+(y===11?0:29),S,3); }
    } else {
      for (let i = 0; i < 7; i++) {
        const gx=px+random(x,y,i+1)*S,gy=py+random(x,y,i+10)*S;
        ellipse(c,gx,gy,2+random(x,y,i+20)*4,1.3,highlands ? '#d8bc6b50' : coast ? '#82b3a135' : n>.5?'#57735835':'#071f2840');
        if (i<3) stroke(c,highlands?'#e6cd8f70':coast?'#a5c9bf60':'#71907845',.7,[[gx-1,gy+2],[gx,gy-2],[gx+2,gy]]);
      }
      if (n>.91) {
        const gx=px+17, gy=py+20;
        stroke(c,'#6c8b68',1,[[gx,gy+5],[gx,gy-2]]);
        for(let i=0;i<5;i++) ellipse(c,gx+Math.cos(i*TAU/5)*2.5,gy+Math.sin(i*TAU/5)*2,1.8,1.2,n>.96?'#c6a0c4':'#d9c997');
        ellipse(c,gx,gy,.9,.8,'#e9d8a0');
      }
    }
  }
  // The broken road and its moss-softened stones.
  for (let i=0;i<70;i++) {
    const x=40+random(i,8)*880,y=40+random(i,19)*620;
    if (tile(Math.floor(x/S),Math.floor(y/S))!=='grass') continue;
    const n=random(i,9); ellipse(c,x+2,y+2,3+n*4,2+n*2,'#07181b60');
    ellipse(c,x,y,3+n*3,2+n*2,'#61706a'); stroke(c,'#a1a39660',.8,[[x-2,y-1],[x+1,y-2],[x+3,y]]);
  }
  // Rope posts keep the bridge legible against the river.
  for(const x of [3,4,5,6]) if(tile(x,12)==='bridge') for(const y of [11,14]) {
    c.fillStyle='#564332';c.fillRect(x*S+1,y*S-8,4,18);
    ellipse(c,x*S+3,y*S-8,3,2,'#c4ad7c');
    stroke(c,'#bfad7c',1.4,[[x*S+3,y*S-4],[x*S+31,y*S-2]]);
  }
  const cx=SPAWN.x*S+16,cy=SPAWN.y*S+16;
  ellipse(c,cx+5,cy-35,80,44,'#17262c90');
  c.fillStyle='#786044';c.beginPath();c.moveTo(cx-66,cy-40);c.quadraticCurveTo(cx-43,cy-93,cx-18,cy-109);c.quadraticCurveTo(cx+7,cy-82,cx+35,cy-42);c.closePath();c.fill();
  const fabric=c.createLinearGradient(cx-60,cy-90,cx+30,cy-40);fabric.addColorStop(0,'#b39d72');fabric.addColorStop(.5,'#d1bb89');fabric.addColorStop(.51,'#89704d');fabric.addColorStop(1,'#bca276');
  c.fillStyle=fabric;c.beginPath();c.moveTo(cx-64,cy-42);c.lineTo(cx-18,cy-108);c.lineTo(cx+34,cy-42);c.closePath();c.fill();
  c.fillStyle='#253033';c.beginPath();c.moveTo(cx-19,cy-92);c.lineTo(cx-36,cy-42);c.lineTo(cx+4,cy-42);c.closePath();c.fill();
  stroke(c,'#e2cda0',1,[[cx-18,cy-108],[cx+34,cy-42],[cx+42,cy-35]]);
  stroke(c,'#dec79a80',1,[[cx-18,cy-104],[cx-62,cy-42],[cx-71,cy-35]]);
  c.fillStyle='#32443f';c.fillRect(cx-66,cy-24,32,11);c.fillStyle='#857857';c.fillRect(cx-67,cy-25,34,4);
  for(let i=0;i<8;i++) ellipse(c,cx+54+Math.cos(i*TAU/8)*17,cy-16+Math.sin(i*TAU/8)*8,5,3.5,'#79766a');
  stroke(c,'#69503b',5,[[cx+43,cy-13],[cx+65,cy-21]]);stroke(c,'#9a7a50',3,[[cx+45,cy-23],[cx+65,cy-12]]);
  // The moon gate: layered stone, bronze inlay, and a dormant violet heart.
  const sx=SHRINE.x*S+16,sy=SHRINE.y*S+16;
  ellipse(c,sx,sy+13,52,24,'#081c2960');
  for(let i=0;i<3;i++) {c.fillStyle=['#384b50','#617073','#8e9390'][i];c.beginPath();c.ellipse(sx,sy+14-i*5,43-i*5,15-i*2,0,0,TAU);c.fill();}
  for(const side of [-1,1]) {
    const x=sx+side*26;c.fillStyle='#566a70';c.fillRect(x-7,sy-48,14,54);c.fillStyle='#9aa29a';c.fillRect(x-8,sy-49,16,7);
    stroke(c,'#b9aa7a',1,[[x-3,sy-41],[x+3,sy-34],[x-3,sy-27],[x+3,sy-20],[x-3,sy-13]]);
    c.fillStyle='#273e4b';c.fillRect(x+4,sy-40,3,40);
  }
  c.strokeStyle='#8b9491';c.lineWidth=13;c.beginPath();c.arc(sx,sy-43,27,Math.PI,0);c.stroke();
  c.strokeStyle='#beab7c';c.lineWidth=1.5;c.beginPath();c.arc(sx,sy-43,29,Math.PI+.12,-.12);c.stroke();
  c.fillStyle='#c4a66f';c.beginPath();c.moveTo(sx,sy-79);c.lineTo(sx+7,sy-67);c.lineTo(sx,sy-59);c.lineTo(sx-7,sy-67);c.closePath();c.fill();
  if (highlands) {
    // Wind-worn watchstones and terrace lines distinguish the upland silhouette.
    for (const [tx, ty, size] of [[3,4,1.2],[8,3,.9],[19,3,1.1],[26,18,1]]) {
      const x=tx*S+16,y=ty*S+16;
      ellipse(c,x+9,y+7,29*size,9,'#382f3080');
      c.fillStyle='#746c58';c.beginPath();c.moveTo(x-16,y);c.lineTo(x-12,y-55*size);c.lineTo(x+9,y-63*size);c.lineTo(x+20,y);c.closePath();c.fill();
      stroke(c,'#d5c391',2,[[x-12,y-55*size],[x+9,y-63*size],[x+13,y-30]]);
      stroke(c,'#a9986c',1,[[x-5,y-40],[x+5,y-32],[x-4,y-22]]);
      for(let j=0;j<3;j++)stroke(c,'#c5aa6b45',1,[[x-40,y+20+j*8],[x-12,y+14+j*8],[x+31,y+18+j*8]]);
    }
  }
  if (coast) {
    // Harbor beacons, mooring ropes and a quiet skiff at the tidal edge.
    for(const tx of [9,12,18,22]) {
      const x=tx*S+16,y=16*S+20;
      c.fillStyle='#42545e';c.fillRect(x-4,y-32,8,39);
      stroke(c,'#c0b797',1.5,[[x,y-14],[x+32,y-5],[x+64,y-14]]);
      glow(c,x,y-35,27,'#ffd98a32');c.fillStyle='#e3c986';c.fillRect(x-6,y-43,12,14);
      stroke(c,'#344350',2,[[x-8,y-44],[x+8,y-44],[x,y-52],[x-8,y-44]]);
    }
    const x=22*S,y=19*S;
    ellipse(c,x,y+7,43,12,'#102b3970');c.fillStyle='#7a6555';c.beginPath();c.moveTo(x-43,y-8);c.quadraticCurveTo(x,y+30,x+43,y-8);c.closePath();c.fill();
    stroke(c,'#d7b88a',2,[[x-42,y-8],[x+42,y-8]]);stroke(c,'#a9b7b7',2,[[x,y],[x,y-58]]);
    c.fillStyle='#b6c6bf';c.beginPath();c.moveTo(x-2,y-55);c.lineTo(x-2,y-12);c.lineTo(x-30,y-13);c.closePath();c.fill();
  }
  for (const exit of region.exits) {
    const x=exit.x*S+16,y=exit.y*S+16;
    ellipse(c,x,y+7,22,11,'#d5b87b25');
    stroke(c,'#aa8c60',4,[[x,y+8],[x,y-35]]);
    c.fillStyle='#bd9c69';c.beginPath();c.moveTo(x-16,y-32);c.lineTo(x+11,y-32);c.lineTo(x+21,y-24);c.lineTo(x+11,y-17);c.lineTo(x-16,y-17);c.closePath();c.fill();
    stroke(c,'#4b4236',1.5,[[x-7,y-24],[x+10,y-24],[x+5,y-28],[x+10,y-24],[x+5,y-20]]);
  }
  // Gentle moonlight gives the same terrain depth without changing walkability.
  const light=c.createRadialGradient(W*.74,H*.18,10,W*.7,H*.2,W*.9);light.addColorStop(0,'#b5d6ce18');light.addColorStop(1,'#0209133d');
  c.fillStyle=light;c.fillRect(0,0,W,H);
  return layer;
}
function forest(regionId: string) {
  const region = regionById(regionId);
  const tile = (x: number, y: number) => worldTile(x, y, regionId);
  const layer=document.createElement('canvas');layer.width=W;layer.height=H;const c=layer.getContext('2d')!;
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const border=y<=1||y>=HEIGHT-2||x===0||x===WIDTH-1;
    const grove=(x>=10&&x<=18&&y>=18)||(x>=14&&x<=18&&y>=2&&y<=3)||(x>=27&&y>=15&&y<=18);
    if(region.theme === 'forest'&&(border||grove)&&tile(x,y)==='grass'&&random(x,y,4)>.22) tree(c,x*S+15,y*S+24,random(x,y),.9+random(x,y,9)*.25);
  }
  return layer;
}
function hero(c: CanvasRenderingContext2D, p: Player, x: number, y: number, time: number, walking: boolean, pose: Pose, reducedMotion: boolean, attackFx: number, abilityFx: number) {
  c.save(); c.translate(x, y + 10); c.scale(S * 1.08, S * 1.08);
  if (p.heroClass === 'death-knight') {
    // The visiting guardian keeps its Draconian outline around the shared rig.
    const trail = reducedMotion ? 0 : Math.sin(pose.phase - .7) * Math.min(1, pose.speed / 3.8) * .035;
    for (const side of [-1, 1]) {
      c.fillStyle = '#293044'; c.strokeStyle = '#8b83c3aa'; c.lineWidth = .025;
      c.beginPath(); c.moveTo(side * .2, -.63);
      c.bezierCurveTo(side * .48, -1.05 + trail, side * .82, -1.17 + trail, side * .98, -.99 + trail);
      c.lineTo(side * .82, -.28); c.lineTo(side * .56, -.52);
      c.lineTo(side * .48, -.1); c.lineTo(side * .2, -.25);
      c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(side * .22, -.6); c.lineTo(side * .75, -.93 + trail); c.lineTo(side * .82, -.28);
      c.strokeStyle = '#b2a9dd80'; c.lineWidth = .02; c.stroke();
    }
  }
  drawHero(c, { x: 0, y: 0, classId: p.heroClass, appearance: p.appearance, motion: pose }, {
    time: time / 1000, moving: walking, reducedMotion, attackFx, abilityFx, classColor: CLASSES[p.heroClass]?.color,
  });
  c.restore();
}
function thornling(c: CanvasRenderingContext2D, x: number, y: number, time: number, hp: number, theme = 'forest') {
  c.save();c.translate(x,y+Math.sin(time/650+x)*1.5);
  ellipse(c,2,10,15,5,'#04170d80');
  const g=c.createLinearGradient(-12,-19,13,11);g.addColorStop(0,theme === 'highlands' ? '#d3ad71' : theme === 'coast' ? '#9dcbd3' : '#8d9f68');g.addColorStop(1,theme === 'highlands' ? '#695445' : theme === 'coast' ? '#36687c' : '#294938');c.fillStyle=g;
  c.beginPath();c.moveTo(-13,6);c.bezierCurveTo(-18,-10,-6,-25,2,-22);c.bezierCurveTo(18,-21,21,2,11,11);c.quadraticCurveTo(0,15,-13,6);c.fill();
  for(const side of [-1,1]) {
    stroke(c,'#496247',3,[[side*8,-15],[side*14,-25],[side*13,-32]]);
    stroke(c,'#afaa7c',1,[[side*12,-26],[side*19,-28]]);
    stroke(c,'#506e46',4,[[side*11,0],[side*19,5]]);
  }
  if(theme==='highlands') stroke(c,'#ecd3a0',3,[[-12,-17],[-7,-30],[0,-21],[8,-33],[13,-15]]);
  if(theme==='coast') {glow(c,0,-5,25,'#a1e8ed25');stroke(c,'#a2d5d0',2,[[-10,7],[-20,15],[-13,20]]);stroke(c,'#a2d5d0',2,[[9,7],[20,13],[14,19]]);}
  ellipse(c,-5,-5,3,3,'#dfe4a2');ellipse(c,7,-5,3,3,'#dfe4a2');ellipse(c,-4,-5,1,2,'#293b32');ellipse(c,6,-5,1,2,'#293b32');
  stroke(c,'#254634',1.4,[[-2,3],[2,5],[5,3]]);
  if(hp<42&&hp>0) {c.fillStyle='#10242b';c.fillRect(-16,-39,32,4);c.fillStyle='#dfb677';c.fillRect(-16,-39,32*hp/42,4);}
  c.restore();
}
// Optional metadata keeps old persisted effects and mixed-version replies readable.
function paintClassAttack(c: CanvasRenderingContext2D, effect: Effect, t: number): boolean {
  const x = effect.x * S + 16, y = effect.y * S + 7;
  const ox = Number.isFinite(effect.originX) ? effect.originX! * S + 16 : x;
  const oy = Number.isFinite(effect.originY) ? effect.originY! * S + 7 : y;
  const color = effect.color || '#dfc294';
  const travel = Math.min(1, t * 4);
  const px = ox + (x - ox) * travel, py = oy + (y - oy) * travel;
  const radius = effect.type === 'area' ? (effect.radius || 1) * S : 24;
  switch (effect.attackStyle) {
    case 'arrow': {
      const angle = Math.atan2(y - oy, x - ox);
      c.save(); c.translate(px, py); c.rotate(angle);
      stroke(c, color, 2, [[-19, 0], [9, 0], [3, -5], [9, 0], [3, 5]]);
      stroke(c, color, 1, [[-17, 0], [-23, -4], [-19, 0], [-23, 4]]); c.restore();
      break;
    }
    case 'blade':
      c.lineWidth = 4; c.beginPath(); c.arc(x, y, 12 + t * 23, -2.6 + t, .6 + t); c.stroke();
      stroke(c, color, 2, [[x - 15, y + 15], [x + 15, y - 15]]); break;
    case 'arcane':
      ellipse(c, px, py, 6, 6, color);
      c.beginPath(); c.arc(x, y, radius * (.25 + t), 0, TAU); c.stroke();
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t; ellipse(c, x + Math.cos(a) * radius * t, y + Math.sin(a) * radius * t, 3, 3, color); }
      break;
    case 'notes':
      for (let i = 0; i < 3; i++) {
        const nx = px + (i - 1) * 15, ny = py - Math.sin(t * Math.PI + i) * 10;
        ellipse(c, nx, ny, 5, 3, color); stroke(c, color, 2, [[nx + 4, ny], [nx + 4, ny - 17], [nx + 10, ny - 13]]);
      } break;
    case 'radiance':
      stroke(c, color, 4, [[x, y - 54], [x, y + 12]]);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; stroke(c, color, 2, [[x + Math.cos(a) * 10, y + Math.sin(a) * 10], [x + Math.cos(a) * (18 + t * 20), y + Math.sin(a) * (18 + t * 20)]]); }
      break;
    case 'runes':
      c.save(); c.translate(x, y); c.rotate(t * .7);
      c.strokeRect(-radius * .6, -radius * .6, radius * 1.2, radius * 1.2);
      stroke(c, color, 2, [[0, -radius], [radius, 0], [0, radius], [-radius, 0], [0, -radius]]);
      c.restore(); break;
    case 'embers':
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10; const r = radius * (.2 + t);
        ellipse(c, x + Math.cos(a) * r, y + Math.sin(a) * r - t * 14, 3, 5 * (1 - t) + 1, i % 2 ? color : '#f4cf89');
      } break;
    case 'palm':
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x + (i - 1) * 10, y, 7 + t * 23, 12 + t * 16, -.4, -.9, Math.PI * 1.4); c.stroke(); }
      break;
    default: return false;
  }
  return true;
}

function paintEffect(c: CanvasRenderingContext2D, effect: Effect, age: number, reducedMotion = false) {
  if(age<0||age>1600) return;const t=reducedMotion ? .35 : age/1600;const x=effect.x*S+16,y=effect.y*S+16;const color=effect.color||'#dfc294';
  c.save();c.globalAlpha=(1-t)*.85;c.strokeStyle=color;c.lineWidth=2;
  if(effect.type==='execute') {
    glow(c,x,y-15,68*(.3+t),'#afa7ef80');
    stroke(c,'#e4dbff',Math.max(1,5*(1-t)),[[x-20,y-48+t*25],[x+22,y+18-t*15]]);
    c.beginPath();c.ellipse(x,y,26+t*36,12+t*14,0,0,TAU);c.stroke();
  } else if(effect.type==='heal'||effect.type==='ward') {
    const r=(effect.radius||1)*S*(.5+t*.3);c.beginPath();c.ellipse(x,y,r,r*.45,0,0,TAU);c.stroke();
    for(let i=0;i<7;i++){const a=i*TAU/7;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.45-t*28;stroke(c,color,2,[[px-3,py],[px+3,py]]);stroke(c,color,2,[[px,py-3],[px,py+3]]);}
  } else if ((effect.type === 'strike' || effect.type === 'area') && paintClassAttack(c, effect, t)) {
    // The class-specific presentation uses the same server-confirmed hit.
  } else {
    const radius=effect.type==='area'?(effect.radius||1.5)*S:19;
    c.beginPath();c.arc(x,y-9,radius*(.35+t),-2.6+t,1.1+t);c.stroke();
    for(let i=0;i<9;i++){const a=i*TAU/9;ellipse(c,x+Math.cos(a)*radius*t,y-9+Math.sin(a)*radius*t,2*(1-t),2*(1-t),color);}
  }
  c.restore();
}

// These physical props are public opportunities, not rewards or client-owned availability.
function resource(c: CanvasRenderingContext2D, node: ResourceNode, now: number, nearby: boolean, time: number) {
  const x = node.x * S + 16, y = node.y * S + 16;
  const waiting = node.availableAt > now;
  const color = node.skillId === 'foraging' ? '#b7cf91' : node.skillId === 'mining' ? '#d8b885' : '#91c8d1';
  c.save();
  ellipse(c, x + 2, y + 9, 22, 8, '#08151b88');
  c.globalAlpha = waiting ? .55 : 1;
  if (node.skillId === 'foraging') {
    // Broad-leaf beds with clipped stems while regrowing.
    for (let i = 0; i < 5; i++) {
      const px = x + (i - 2) * 7, py = y + Math.abs(i - 2) * 2;
      stroke(c, '#7c9871', 2, [[px, py + 5], [px - 1, py - (waiting ? 3 : 14)]]);
      if (!waiting) {
        c.save(); c.translate(px, py - 9); c.rotate((i - 2) * .35);
        ellipse(c, -4, -2, 7, 4, i % 2 ? '#748e58' : '#9ebc76');
        ellipse(c, 4, -7, 6, 4, '#b2c787'); c.restore();
        ellipse(c, px, py - 15, 2, 2, '#e4c489');
      }
    }
    stroke(c, '#827155', 2, [[x - 23, y + 7], [x + 20, y + 10]]);
  } else if (node.skillId === 'mining') {
    for (const [dx, dy, size] of [[-10, 2, 12], [7, 0, 17], [0, -8, 12]]) {
      c.fillStyle = '#4c5b61'; c.beginPath(); c.moveTo(x + dx - size, y + dy + 7);
      c.lineTo(x + dx - size * .6, y + dy - size); c.lineTo(x + dx + size * .4, y + dy - size * 1.2);
      c.lineTo(x + dx + size, y + dy); c.closePath(); c.fill();
      stroke(c, waiting ? '#667474' : '#b8a582', 1.5, [[x + dx - size * .6, y + dy - size], [x + dx + size * .4, y + dy - size * 1.2], [x + dx + size, y + dy]]);
      if (!waiting) stroke(c, '#e0bc7d', 2, [[x + dx - 5, y + dy - 7], [x + dx + 2, y + dy - 3], [x + dx - 1, y + dy + 2]]);
    }
  } else {
    // A creel and fishing rod stand on a reachable bank tile.
    c.fillStyle = '#9b8059'; c.fillRect(x - 15, y - 1, 19, 12);
    ellipse(c, x - 5, y - 1, 10, 4, '#d2b17e'); ellipse(c, x - 5, y - 1, 6, 2, '#504d3b');
    for (let i = 0; i < 4; i++) stroke(c, '#66553e', 1, [[x - 13 + i * 5, y + 1], [x - 13 + i * 5, y + 10]]);
    stroke(c, '#b3a078', 2, [[x + 6, y + 8], [x + 13, y - 31]]);
    stroke(c, '#d0d9cd', .8, [[x + 13, y - 31], [x + 24, y - 8]]);
    ellipse(c, x + 24, y - 6 + Math.sin(time / 800) * (waiting ? 0 : 1), 2, 3, waiting ? '#6f898c' : '#ded1a3');
  }
  c.globalAlpha = 1;
  // A consistent small badge keeps resource types identifiable at map scale.
  ellipse(c, x, y + 15, 9, 6, '#132328e8');
  c.font = 'bold 9px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = color;
  c.fillText(node.skillId === 'foraging' ? 'F' : node.skillId === 'mining' ? 'M' : '~', x, y + 18);
  if (nearby) {
    c.strokeStyle = waiting ? '#899288' : color; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(x, y + 9, 26, 12, 0, 0, TAU); c.stroke();
    const label = node.name + (waiting ? ' · ' + Math.ceil((node.availableAt - now) / 1000) + 's' : ' · Lv. ' + node.requiredLevel);
    c.font = '600 11px system-ui, sans-serif'; const width = c.measureText(label).width;
    const lx = Math.max(width / 2 + 8, Math.min(W - width / 2 - 8, x));
    c.fillStyle = '#10201ff0'; c.fillRect(lx - width / 2 - 6, y + 28, width + 12, 19);
    c.fillStyle = color; c.fillText(label, lx, y + 41);
  }
  c.restore();
}

export default function GameCanvas({ realm, playerId, onTile }: {
  realm: Realm | null; playerId: string | null; onTile: (x: number, y: number) => void;
}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const latest=useRef({realm,playerId,receivedAt:Date.now()});
  latest.current={realm,playerId,receivedAt:latest.current.realm===realm?latest.current.receivedAt:Date.now()};

  useEffect(() => {
    const canvas=ref.current; if(!canvas) return;const c=canvas.getContext('2d');if(!c)return;
    const pixelRatio=Math.min(window.innerWidth<760?1.25:2,window.devicePixelRatio||1);
    canvas.width=W*pixelRatio;canvas.height=H*pixelRatio;c.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    let paintedRegion = ""; let ground: HTMLCanvasElement, canopy: HTMLCanvasElement;
    let waterTiles: {x: number; y: number}[] = [], landmarks = LANDMARKS.slice(0, 0);
    const poses = new Map<string, Pose>();
    // Static lighting and a reusable mote sprite avoid rebuilding gradients per frame.
    const shade = document.createElement('canvas'); shade.width = W; shade.height = H;
    const sc = shade.getContext('2d')!;
    const vignette = sc.createRadialGradient(W*.5,H*.45,H*.12,W*.5,H*.5,W*.64);
    vignette.addColorStop(0,'transparent'); vignette.addColorStop(.75,'#07101a20'); vignette.addColorStop(1,'#050b15a0');
    sc.fillStyle = vignette; sc.fillRect(0, 0, W, H);
    const mote = document.createElement('canvas'); mote.width = 16; mote.height = 16;
    const mc = mote.getContext('2d')!; glow(mc, 8, 8, 7, '#d6de9d80'); ellipse(mc, 8, 8, 1, 1, '#e2e4ad');
    const motes = Array.from({ length: 16 }, (_, i) => ({ x: random(i, 12)*W, y: random(i, 37)*H, phase: i }));
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation = 0, lastFrame = 0;
    let visible = document.visibilityState !== 'hidden';
    const draw=(stamp:number)=>{
      if (!visible) return;
      animation = requestAnimationFrame(draw);
      // 60fps positioning; reduced-motion users need no decorative high-rate redraw.
      if (stamp - lastFrame < (motion.matches ? 32 : 15)) return;
      const delta = Math.min(.05, Math.max(.008, (stamp-lastFrame)/1000)); lastFrame = stamp;
      const reduced=motion.matches;const time=reduced?0:stamp;
      const state=latest.current;const world=state.realm as RenderRealm|null;
      const regionId = world?.regionId || DEFAULT_REGION_ID;
      const region = regionById(regionId);
      const { spawn: SPAWN, shrine: SHRINE, crystals: CRYSTALS } = region;
      if (paintedRegion !== regionId) {
        ground = terrain(regionId); canopy = forest(regionId); paintedRegion = regionId; poses.clear();
        waterTiles = [];
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
          if (worldTile(x, y, regionId) === 'water') waterTiles.push({ x, y });
        }
        landmarks = LANDMARKS.filter(item => (item.regionId || DEFAULT_REGION_ID) === regionId);
      }
      const now=(world?.serverTime||Date.now())+(Date.now()-state.receivedAt);
      // Cache terrain and forest once; the live layer stays light enough for phones.
      c.clearRect(0,0,W,H);c.imageSmoothingEnabled=true;c.drawImage(ground,0,0);
      for (const { x, y } of waterTiles) {
        const phase=(time/1000+x*.7+y*.4);c.strokeStyle='#b0d7d22e';c.lineWidth=.9;c.beginPath();c.ellipse(x*S+14+Math.sin(phase)*3,y*S+13,10,2,0,0,Math.PI);c.stroke();
        c.strokeStyle='#81b4c040';c.beginPath();c.moveTo(x*S+8,y*S+25);c.quadraticCurveTo(x*S+17,y*S+23+Math.sin(phase),x*S+25,y*S+25);c.stroke();
      }
      const cx=SPAWN.x*S+70,cy=SPAWN.y*S+1;
      glow(c,cx,cy,80,'#f5ae4c25');glow(c,cx,cy,32,'#f4b76035');
      for(let i=0;i<4;i++){
        const f=Math.sin(time/170+i*1.4)*2;c.fillStyle=i%2?'#ffe0a0':'#e99949';c.beginPath();c.moveTo(cx-9+i*3,cy+1);c.quadraticCurveTo(cx-10+i*5,cy-12-f,cx-6+i*4,cy-24-f);c.quadraticCurveTo(cx+2+i*3,cy-9,cx+7-i*2,cy+2);c.fill();
      }
      if(!reduced)for(let i=0;i<5;i++){const life=(time/2100+i*.21)%1;ellipse(c,cx+Math.sin(i*14+life*4)*12,cy-15-life*38,1.2*(1-life),1.8*(1-life),'#ecca8570');}
      const sx=SHRINE.x*S+16,sy=SHRINE.y*S+16;
      glow(c,sx,sy-22,61,'#aaa4ea25');ellipse(c,sx,sy-22,10+Math.sin(time/1000),17,'#c0c2f01c');
      c.strokeStyle='#b6b7df80';c.lineWidth=1;c.beginPath();c.ellipse(sx,sy-21,12,20,0,0,TAU);c.stroke();
      for(let i=0;i<7;i++){const a=i*TAU/7+time/14000;ellipse(c,sx+Math.cos(a)*13,sy-21+Math.sin(a)*20,1.1,1.1,'#e3dbb0');}
      for(const crystal of CRYSTALS){
        const x=crystal.x*S+16,y=crystal.y*S+16,b=Math.sin(time/1000+crystal.x)*2;
        glow(c,x,y-9,34,'#8fe8ef25');ellipse(c,x,y+7,14,4,'#06364290');
        const g=c.createLinearGradient(x-11,y-26,x+10,y+6);g.addColorStop(0,'#e1f6f0');g.addColorStop(.45,'#a0e0e5');g.addColorStop(.46,'#4e9ebc');g.addColorStop(1,'#305478');
        c.fillStyle=g;c.beginPath();c.moveTo(x,y-28+b);c.lineTo(x+11,y-10+b);c.lineTo(x+5,y+6+b);c.lineTo(x-9,y+2+b);c.lineTo(x-12,y-11+b);c.closePath();c.fill();
        stroke(c,'#dafaf6',.9,[[x,y-28+b],[x-2,y-8+b],[x+5,y+6+b]]);
        ellipse(c,x+16,y-19+Math.sin(time/600)*5,1.5,1.5,'#e0eee6');ellipse(c,x-17,y-6+Math.sin(time/800+2)*4,1,1,'#d8dcb5');
      }
      const explorer = [...(world?.players || []), ...(world?.visitors || [])].find(p => p.id === state.playerId);
      if (explorer) for (const landmark of landmarks) {
        const nearby = Math.hypot(explorer.x - landmark.x, explorer.y - landmark.y);
        if (nearby > 4) continue;
        const lx = landmark.x * S + 16, ly = landmark.y * S + 16;
        c.save();
        glow(c, lx, ly - 12, 23, '#f3d58e30');
        stroke(c, '#b49b6b', 2, [[lx, ly + 6], [lx, ly - 25], [lx + 9, ly - 25], [lx + 9, ly - 21]]);
        c.fillStyle = '#e9ce8c'; c.fillRect(lx + 5, ly - 21, 8, 11);
        c.strokeStyle = '#756442'; c.lineWidth = 1; c.strokeRect(lx + 5, ly - 21, 8, 11);
        if (nearby <= 1.8) {
          c.font = '11px Georgia, serif'; c.textAlign = 'center';
          const width = c.measureText(landmark.title).width;
          c.fillStyle = '#10201ee6'; c.fillRect(lx - width / 2 - 6, ly + 17, width + 12, 18);
          c.fillStyle = '#ead6a5'; c.fillText(landmark.title, lx, ly + 30);
        }
        c.restore();
      }
      const actors:Array<{y:number;draw:()=>void}>=[];
      const effects = visibleEffects(world?.effects, now) as Effect[];
      for (const node of (world?.resourceNodes || []).slice(0, 24)) {
        if (node.regionId !== regionId) continue;
        const near = !!explorer && Math.hypot(explorer.x - node.x, explorer.y - node.y) <= 2.8;
        actors.push({ y: node.y - .3, draw: () => resource(c, node, now, near, time) });
      }
      for(const enemy of (world?.enemies||[]).slice(0, 32))if(enemy.hp>0)actors.push({y:enemy.y,draw:()=>thornling(c,enemy.x*S+16,enemy.y*S+16,time,enemy.hp,region.theme)});
      const players=[...(world?.players||[]),...(world?.visitors||[])].filter(p => (p.regionId || DEFAULT_REGION_ID) === regionId).slice(0, MAX_RENDER_ACTORS);
      for(const p of players){
        const targetX=p.x*S+16,targetY=p.y*S+16;let pos=poses.get(p.id);
        if (!pos) { pos = createPose(targetX, targetY, stamp); poses.set(p.id, pos); }
        const walking = advancePose(pos, targetX, targetY, stamp, delta, { local: p.id === state.playerId, reducedMotion: reduced, tileSize: S });
        const x=pos.x,y=pos.y;
        const actorEffects = effects.filter(effect => effect.actorId === p.id);
        const hit=actorEffects.find(effect=>['strike','area'].includes(effect.type)&&now-effect.at>=0&&now-effect.at<240);
        const cast=actorEffects.find(effect=>['heal','ward'].includes(effect.type)&&now-effect.at>=0&&now-effect.at<600);
        const attackFx=hit?.at ? .24-(now-hit.at)/1000 : 0;
        const abilityFx=cast?.at ? .6-(now-cast.at)/1000 : 0;
        actors.push({y:(y-16)/S,draw:()=>{
          if(p.id===state.playerId){glow(c,x,y+8,31,'#e1c98c18');c.strokeStyle='#e6d09c';c.lineWidth=1.2;c.beginPath();c.ellipse(x,y+12,19,7,0,0,TAU);c.stroke();}
          hero(c,p,x,y,time,walking,pos!,reduced,attackFx,abilityFx);
          const maxHp = Math.max(1, p.maxHp || 100);
          if (p.hp < maxHp && p.heroClass !== 'death-knight') {
            c.fillStyle = '#101c23'; c.fillRect(x - 16, y + 22, 32, 4);
            c.fillStyle = p.hp / maxHp > .35 ? '#a9c38a' : '#e0a38a'; c.fillRect(x - 16, y + 22, 32 * Math.max(0, Math.min(1, p.hp / maxHp)), 4);
          }
          c.font='600 11px system-ui, sans-serif';c.textAlign='center';const label=p.name+(p.heroClass==='death-knight'?' · ???':p.id===state.playerId?' · you':'');
          const width=c.measureText(label).width;c.fillStyle='#0a1320db';c.fillRect(x-width/2-7,y-(p.heroClass==='wizard'?64:55),width+14,17);
          c.fillStyle=p.heroClass==='death-knight'?'#d0c5f1':'#ede5d0';c.fillText(label,x,y-(p.heroClass==='wizard'?52:43));
        }});
      }
      for(const id of poses.keys())if(!players.some(player=>player.id===id))poses.delete(id);
      actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.draw());c.drawImage(canopy,0,0);
      for (const effect of effects) paintEffect(c, effect, now - effect.at, reduced);
      // Slow fireflies reuse one tiny sprite; the static vignette is cached.
      if (!reduced) for (const motePoint of motes) {
        const i = motePoint.phase;
        c.globalAlpha = .35 + Math.sin(time / 1400 + i) * .2;
        c.drawImage(mote, motePoint.x + Math.sin(time/3600+i)*8 - 8, motePoint.y + Math.cos(time/2900+i)*5 - 8);
      }
      c.globalAlpha = 1; c.drawImage(shade, 0, 0);
      c.textAlign='center';c.font='10px Georgia, serif';
      const label=(text:string,x:number,y:number)=>{const w=c.measureText(text).width;c.fillStyle='#0c1923cd';c.fillRect(x-w/2-9,y-12,w+18,20);c.fillStyle='#d7c393';c.fillText(text,x,y+2);};
      label('WAYFARER CAMP',(SPAWN.x+1)*S,(SPAWN.y+2)*S);label(regionId === 'glade' ? 'OLD MOON SHRINE' : regionId === 'amberReach' ? 'WATCHSTONE SHRINE' : 'TIDEKEEPER SHRINE',SHRINE.x*S,(SHRINE.y-2)*S);
      for(const exit of region.exits) label('CROSSING',Math.max(60,Math.min(W-60,exit.x*S+16)),exit.y*S+53);
      c.save();c.translate(28*S,3*S);c.strokeStyle='#d6c297';c.lineWidth=1;c.beginPath();c.arc(0,6,19,0,TAU);c.stroke();stroke(c,'#d6c297',1,[[0,-19],[0,25],[-13,6],[13,6]]);c.fillStyle='#eadcba';c.beginPath();c.moveTo(0,-8);c.lineTo(5,12);c.lineTo(0,7);c.lineTo(-5,12);c.closePath();c.fill();c.font='11px Georgia, serif';c.fillText('N',0,-25);c.restore();
    };
    const visibility = () => {
      visible = document.visibilityState !== 'hidden';
      cancelAnimationFrame(animation);
      if (visible) { lastFrame = 0; poses.clear(); animation = requestAnimationFrame(draw); }
    };
    document.addEventListener('visibilitychange', visibility);
    if (visible) animation = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animation); poses.clear(); document.removeEventListener('visibilitychange', visibility); };

  },[]);
  return <canvas ref={ref} width={W} height={H} aria-label={regionById(realm?.regionId).name + " illustrated shared world map. Click a location to walk, or use the arrow keys. Signposts mark crossings. Herb beds, ore rocks and fishing creels mark gathering grounds. Use the Wilderness skills controls to walk to or gather from them."}
    onClick={event=>{const b=event.currentTarget.getBoundingClientRect();onTile(Math.floor((event.clientX-b.left)/b.width*WIDTH),Math.floor((event.clientY-b.top)/b.height*HEIGHT));}} />;
}

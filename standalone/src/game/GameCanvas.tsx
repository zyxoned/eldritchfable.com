import { useEffect, useRef } from 'react';
import {
  WIDTH, HEIGHT, SPAWN, SHRINE, CRYSTALS, CLASSES, tile, type Realm, type Player,
} from './shared/game';

const S = 32;
const W = WIDTH * S;
const H = HEIGHT * S;
const TAU = Math.PI * 2;
type Effect = { id: string; type: string; x: number; y: number; color?: string; at: number; radius?: number };
type RenderRealm = Realm & { seventh?: Player | null; effects?: Effect[] };

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
function terrain() {
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const c = layer.getContext('2d')!;
  const ground = c.createLinearGradient(0, 0, W, H);
  ground.addColorStop(0, '#162f36'); ground.addColorStop(.6, '#263e36'); ground.addColorStop(1, '#1a2b31');
  c.fillStyle = ground; c.fillRect(0, 0, W, H);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const kind = tile(x, y); const n = random(x, y);
    const px = x * S; const py = y * S;
    if (kind === 'water') {
      c.fillStyle = '#102a39'; c.fillRect(px, py, S, S);
      const bank = tile(x - 1, y) !== 'water' || tile(x + 1, y) !== 'water';
      if (bank) { c.fillStyle = '#47727550'; c.fillRect(px, py, S, S); }
    } else if (kind === 'path') {
      c.fillStyle = '#716550'; c.fillRect(px, py, S, S);
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
        ellipse(c,gx,gy,2+random(x,y,i+20)*4,1.3,n>.5?'#57735835':'#071f2840');
        if (i<3) stroke(c,'#71907845',.7,[[gx-1,gy+2],[gx,gy-2],[gx+2,gy]]);
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
  // Gentle moonlight gives the same terrain depth without changing walkability.
  const light=c.createRadialGradient(W*.74,H*.18,10,W*.7,H*.2,W*.9);light.addColorStop(0,'#b5d6ce18');light.addColorStop(1,'#0209133d');
  c.fillStyle=light;c.fillRect(0,0,W,H);
  return layer;
}
function forest() {
  const layer=document.createElement('canvas');layer.width=W;layer.height=H;const c=layer.getContext('2d')!;
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const border=y<=1||y>=HEIGHT-2||x===0||x===WIDTH-1;
    const grove=(x>=10&&x<=18&&y>=18)||(x>=14&&x<=18&&y>=2&&y<=3)||(x>=27&&y>=15&&y<=18);
    if((border||grove)&&tile(x,y)==='grass'&&random(x,y,4)>.22) tree(c,x*S+15,y*S+24,random(x,y),.9+random(x,y,9)*.25);
  }
  return layer;
}
function hero(c: CanvasRenderingContext2D, p: Player, x: number, y: number, time: number, walking: boolean) {
  const id=p.heroClass; const color=CLASSES[id]?.color||'#bd9bd9';const dark=id==='death-knight';
  const bob=Math.sin(time/(walking?90:650)+x)* (walking?1.7:.55);
  c.save();c.translate(x,y+bob);c.lineCap='round';c.lineJoin='round';
  ellipse(c,2,12,15,5,'#010a1490');
  if(dark) {
    glow(c,0,-8,47,'#9f9aff38');
    c.fillStyle='#293044';c.strokeStyle='#8b83c380';c.lineWidth=1;
    for(const side of [-1,1]) {
      c.beginPath();c.moveTo(side*8,-16);c.bezierCurveTo(side*20,-36,side*31,-40,side*38,-34);
      c.lineTo(side*31,-7);c.lineTo(side*21,-16);c.lineTo(side*20,0);c.lineTo(side*10,-4);c.closePath();c.fill();c.stroke();
      stroke(c,'#b2a9dd70',.8,[[side*9,-16],[side*28,-29],[side*31,-7]]);
    }
  }
  // Silhouettes are class-specific equipment, not interchangeable colored squares.
  const cloak=c.createLinearGradient(-9,-20,12,15);cloak.addColorStop(0,color);cloak.addColorStop(1,dark?'#121727':'#243640');
  c.fillStyle=cloak;c.beginPath();c.moveTo(-8,-18);c.quadraticCurveTo(-14,-2,-13,12);c.quadraticCurveTo(0,19,13,12);c.quadraticCurveTo(10,-5,8,-18);c.closePath();c.fill();
  stroke(c,'#081a26',4,[[-4,5],[-5,13]]);stroke(c,'#081a26',4,[[5,5],[7,13]]);
  if(id==='monk') {
    c.fillStyle='#d2b68c';c.beginPath();c.ellipse(0,-20,6,7,0,0,TAU);c.fill();
    stroke(c,'#143d40',4,[[-8,-10],[6,3]]);stroke(c,'#dfc7a2',3,[[-8,-9],[-13,-2]]);stroke(c,'#dfc7a2',3,[[8,-9],[13,-2]]);
    stroke(c,'#90d2bb',1,[[12,-4],[15,-3],[14,0]]);ellipse(c,-4,-21,1,1,'#3d4c49');ellipse(c,3,-21,1,1,'#3d4c49');
  } else {
    const face=dark?'#708b93':'#d8bf9a';
    ellipse(c,0,-20,6.3,7,face);
    if(id==='ranger'||id==='mage'||id==='sorcerer') {
      c.fillStyle=color;c.beginPath();c.moveTo(-9,-18);c.quadraticCurveTo(-9,-33,0,-31);c.quadraticCurveTo(10,-31,9,-18);c.lineTo(5,-22);c.quadraticCurveTo(0,-28,-5,-22);c.closePath();c.fill();
      if(id==='ranger') {stroke(c,'#d6d3a2',1,[[-4,-30],[-9,-39],[-6,-35]]);}
    }
    if(id==='wizard') {
      c.fillStyle=color;c.beginPath();c.moveTo(-13,-25);c.lineTo(10,-25);c.lineTo(4,-48);c.lineTo(-5,-32);c.closePath();c.fill();
      stroke(c,'#c1d7df',1,[[2,-40],[-1,-30],[8,-28]]);ellipse(c,1,-31,1.5,1.5,'#eadbb4');
    }
    if(id==='knight'||id==='death-knight'||id==='cleric') {
      const metal=dark?'#6a7390':id==='cleric'?'#d5c7a4':'#b9bdba';
      c.fillStyle=metal;c.beginPath();c.moveTo(-8,-20);c.quadraticCurveTo(-8,-31,0,-31);c.quadraticCurveTo(8,-31,8,-20);c.lineTo(4,-14);c.lineTo(0,-18);c.lineTo(-5,-14);c.closePath();c.fill();
      stroke(c,'#21303d',2,[[-5,-22],[5,-22]]);
      if(dark) {
        stroke(c,'#d0c7ff',1.5,[[-4,-22],[-1,-22]]);stroke(c,'#d0c7ff',1.5,[[2,-22],[5,-22]]);
        for(const side of [-1,1]) stroke(c,'#a7b1c1',3,[[side*5,-28],[side*11,-36],[side*9,-41]]);
        c.fillStyle='#424e69';c.beginPath();c.moveTo(-9,-15);c.lineTo(-14,-20);c.lineTo(-17,-7);c.lineTo(-7,-6);c.lineTo(0,0);c.lineTo(7,-6);c.lineTo(17,-7);c.lineTo(14,-20);c.lineTo(8,-15);c.closePath();c.fill();
        stroke(c,'#a9a5d8',1,[[-12,-14],[-6,-9],[0,-5],[7,-9],[13,-14]]);
      } else {stroke(c,'#e5deba',2,[[-10,-9],[-5,-12],[5,-12],[11,-9]]);}
    }
    if(id==='bard') {
      c.fillStyle='#663c65';c.beginPath();c.moveTo(-10,-25);c.quadraticCurveTo(-5,-38,6,-29);c.lineTo(12,-24);c.closePath();c.fill();
      stroke(c,'#eccf98',1.4,[[4,-30],[12,-39],[10,-32]]);
    }
    if(!dark) {ellipse(c,-3,-21,.8,1,'#25333a');ellipse(c,3,-21,.8,1,'#25333a');}
  }
  stroke(c,dark?'#9f9fd0':'#d6c498',2.2,[[-8,1],[7,1]]);
  if(id==='ranger') {
    c.strokeStyle='#caab78';c.lineWidth=2;c.beginPath();c.arc(12,-9,13,-Math.PI/2,Math.PI/2);c.stroke();stroke(c,'#e0d5ae',.8,[[12,-22],[12,4]]);
    stroke(c,'#8c6a4e',3,[[-9,-13],[-15,-29]]);stroke(c,'#d9d1aa',1,[[-15,-30],[-18,-26]]);
  } else if(id==='knight'||dark) {
    stroke(c,dark?'#c7d5ed':'#dfe2d4',dark?3:2.5,[[14,7],[16,-21]]);
    stroke(c,'#cab07b',2,[[10,-5],[20,-4]]);
    if(dark) {glow(c,16,-11,19,'#b3b0ff45');stroke(c,'#f2edff',1,[[16,-21],[15,-6]]);}
    else {c.fillStyle='#775b57';c.beginPath();c.moveTo(-17,-14);c.lineTo(-8,-12);c.lineTo(-8,-1);c.lineTo(-12,5);c.lineTo(-18,-1);c.closePath();c.fill();stroke(c,'#dbc79b',1,[[-17,-13],[-9,-12],[-9,-2],[-12,3],[-17,-2],[-17,-13]]);}
  } else if(id==='bard') {
    ellipse(c,10,-1,7,9,'#cb9f68');ellipse(c,10,-2,3,4,'#493744');stroke(c,'#dfbc85',3,[[9,-7],[12,-24]]);stroke(c,'#f0d7a3',.6,[[8,5],[13,-23]]);
  } else if(id==='monk') {
    stroke(c,'#b3ac83',2,[[-15,8],[17,-24]]);stroke(c,'#e1d3a4',1,[[13,-20],[17,-24]]);
  } else {
    stroke(c,id==='cleric'?'#d9c495':'#8b7565',2.4,[[14,12],[15,-29]]);
    if(id==='cleric') {
      stroke(c,'#f6e1a1',3,[[10,-27],[20,-27]]);stroke(c,'#f6e1a1',3,[[15,-33],[15,-21]]);glow(c,15,-27,13,'#f9dc8845');
    } else {
      const orb=id==='sorcerer'?'#f6af78':id==='wizard'?'#9edcfa':'#d5b6f1';glow(c,15,-31,13,orb+'50');ellipse(c,15,-31,3.5,4.5,orb);
      if(id==='sorcerer') {glow(c,-12,-4,10,'#ff986e60');ellipse(c,-12,-4,3,3,'#ffe2b0');}
    }
  }
  c.restore();
}
function thornling(c: CanvasRenderingContext2D, x: number, y: number, time: number, hp: number) {
  c.save();c.translate(x,y+Math.sin(time/650+x)*1.5);
  ellipse(c,2,10,15,5,'#04170d80');
  const g=c.createLinearGradient(-12,-19,13,11);g.addColorStop(0,'#8d9f68');g.addColorStop(1,'#294938');c.fillStyle=g;
  c.beginPath();c.moveTo(-13,6);c.bezierCurveTo(-18,-10,-6,-25,2,-22);c.bezierCurveTo(18,-21,21,2,11,11);c.quadraticCurveTo(0,15,-13,6);c.fill();
  for(const side of [-1,1]) {
    stroke(c,'#496247',3,[[side*8,-15],[side*14,-25],[side*13,-32]]);
    stroke(c,'#afaa7c',1,[[side*12,-26],[side*19,-28]]);
    stroke(c,'#506e46',4,[[side*11,0],[side*19,5]]);
  }
  ellipse(c,-5,-5,3,3,'#dfe4a2');ellipse(c,7,-5,3,3,'#dfe4a2');ellipse(c,-4,-5,1,2,'#293b32');ellipse(c,6,-5,1,2,'#293b32');
  stroke(c,'#254634',1.4,[[-2,3],[2,5],[5,3]]);
  if(hp<42&&hp>0) {c.fillStyle='#10242b';c.fillRect(-16,-39,32,4);c.fillStyle='#dfb677';c.fillRect(-16,-39,32*hp/42,4);}
  c.restore();
}
function paintEffect(c: CanvasRenderingContext2D, effect: Effect, age: number) {
  if(age<0||age>1600) return;const t=age/1600;const x=effect.x*S+16,y=effect.y*S+16;const color=effect.color||'#dfc294';
  c.save();c.globalAlpha=(1-t)*.85;c.strokeStyle=color;c.lineWidth=2;
  if(effect.type==='execute') {
    glow(c,x,y-15,68*(.3+t),'#afa7ef80');
    stroke(c,'#e4dbff',Math.max(1,5*(1-t)),[[x-20,y-48+t*25],[x+22,y+18-t*15]]);
    c.beginPath();c.ellipse(x,y,26+t*36,12+t*14,0,0,TAU);c.stroke();
  } else if(effect.type==='heal'||effect.type==='ward') {
    const r=(effect.radius||1)*S*(.5+t*.3);c.beginPath();c.ellipse(x,y,r,r*.45,0,0,TAU);c.stroke();
    for(let i=0;i<7;i++){const a=i*TAU/7;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.45-t*28;stroke(c,color,2,[[px-3,py],[px+3,py]]);stroke(c,color,2,[[px,py-3],[px,py+3]]);}
  } else {
    const radius=effect.type==='area'?(effect.radius||1.5)*S:19;
    c.beginPath();c.arc(x,y-9,radius*(.35+t),-2.6+t,1.1+t);c.stroke();
    for(let i=0;i<9;i++){const a=i*TAU/9;ellipse(c,x+Math.cos(a)*radius*t,y-9+Math.sin(a)*radius*t,2*(1-t),2*(1-t),color);}
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
    const ground=terrain(),canopy=forest();const poses=new Map<string,{x:number;y:number}>();
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation=0,lastFrame=0;let visible=document.visibilityState!=='hidden';
    const visibility=()=>{visible=document.visibilityState!=='hidden';};document.addEventListener('visibilitychange',visibility);
    const draw=(stamp:number)=>{
      animation=requestAnimationFrame(draw);
      if(!visible||stamp-lastFrame<32)return;lastFrame=stamp;
      const reduced=motion.matches;const time=reduced?0:stamp;
      const state=latest.current;const world=state.realm as RenderRealm|null;
      const now=(world?.serverTime||Date.now())+(Date.now()-state.receivedAt);
      // Cache terrain and forest once; the live layer stays light enough for phones.
      c.clearRect(0,0,W,H);c.imageSmoothingEnabled=true;c.drawImage(ground,0,0);
      for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(tile(x,y)==='water'){
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
      const actors:Array<{y:number;draw:()=>void}>=[];
      for(const enemy of world?.enemies||[])if(enemy.hp>0)actors.push({y:enemy.y,draw:()=>thornling(c,enemy.x*S+16,enemy.y*S+16,time,enemy.hp)});
      const players=[...(world?.players||[]),...(world?.seventh?[world.seventh]:[])];
      for(const p of players){
        const targetX=p.x*S+16,targetY=p.y*S+16;let pos=poses.get(p.id);
        if(!pos||Math.hypot(pos.x-targetX,pos.y-targetY)>S*4){pos={x:targetX,y:targetY};poses.set(p.id,pos);}
        const walking=Math.abs(pos.x-targetX)+Math.abs(pos.y-targetY)>1;
        pos.x+=(targetX-pos.x)*(reduced?1:.35);pos.y+=(targetY-pos.y)*(reduced?1:.35);
        const x=pos.x,y=pos.y;
        actors.push({y:p.y,draw:()=>{
          if(p.id===state.playerId){glow(c,x,y+8,31,'#e1c98c18');c.strokeStyle='#e6d09c';c.lineWidth=1.2;c.beginPath();c.ellipse(x,y+12,19,7,0,0,TAU);c.stroke();}
          hero(c,p,x,y,time,walking);
          c.font='600 11px system-ui, sans-serif';c.textAlign='center';const label=p.name+(p.heroClass==='death-knight'?' · ???':p.id===state.playerId?' · you':'');
          const width=c.measureText(label).width;c.fillStyle='#0a1320db';c.fillRect(x-width/2-7,y-(p.heroClass==='wizard'?64:55),width+14,17);
          c.fillStyle=p.heroClass==='death-knight'?'#d0c5f1':'#ede5d0';c.fillText(label,x,y-(p.heroClass==='wizard'?52:43));
        }});
      }
      actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.draw());c.drawImage(canopy,0,0);
      for(const effect of world?.effects||[])paintEffect(c,effect,now-effect.at);
      // Slow fireflies and a soft vignette, never flashes.
      if(!reduced)for(let i=0;i<23;i++){const x=random(i,12)*W+Math.sin(time/3600+i)*8,y=random(i,37)*H+Math.cos(time/2900+i)*5;const a=.18+Math.sin(time/1400+i)*.13;glow(c,x,y,7,'rgba(214,222,157,'+a+')');ellipse(c,x,y,1,1,'rgba(226,228,173,'+(a+.15)+')');}
      const vignette=c.createRadialGradient(W*.5,H*.45,H*.12,W*.5,H*.5,W*.64);vignette.addColorStop(0,'transparent');vignette.addColorStop(.75,'#07101a20');vignette.addColorStop(1,'#050b15a0');c.fillStyle=vignette;c.fillRect(0,0,W,H);
      c.textAlign='center';c.font='10px Georgia, serif';
      const label=(text:string,x:number,y:number)=>{const w=c.measureText(text).width;c.fillStyle='#0c1923cd';c.fillRect(x-w/2-9,y-12,w+18,20);c.fillStyle='#d7c393';c.fillText(text,x,y+2);};
      label('WAYFARER CAMP',11*S,15*S);label('OLD MOON SHRINE',24*S,3*S);
      c.save();c.translate(28*S,3*S);c.strokeStyle='#d6c297';c.lineWidth=1;c.beginPath();c.arc(0,6,19,0,TAU);c.stroke();stroke(c,'#d6c297',1,[[0,-19],[0,25],[-13,6],[13,6]]);c.fillStyle='#eadcba';c.beginPath();c.moveTo(0,-8);c.lineTo(5,12);c.lineTo(0,7);c.lineTo(-5,12);c.closePath();c.fill();c.font='11px Georgia, serif';c.fillText('N',0,-25);c.restore();
    };
    animation=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(animation);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  return <canvas ref={ref} width={W} height={H} aria-label="Whispering Glade illustrated shared world map. Click a location to walk, or use the arrow keys. Moon crystals shine blue, thornlings guard the paths, and the old shrine glows in the northeast."
    onClick={event=>{const b=event.currentTarget.getBoundingClientRect();onTile(Math.floor((event.clientX-b.left)/b.width*WIDTH),Math.floor((event.clientY-b.top)/b.height*HEIGHT));}} />;
}

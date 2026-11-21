// Painted environment plates are original assets for this expedition. The source-floor
// edges are registered to the same walkable band in all three scenes so upper-row
// footsteps stay on the paving and lower-row footsteps stop before the parapet.
const WIDTH = 1000;
const HEIGHT = 600;
const CUT_WIDTH = 1024;
const CUT_HEIGHT = 512;
const BACK = 345;
const FRONT = 558;
const TAU = Math.PI * 2;

const places = {
  market: {
    url: new URL('./art/quarry-market.jpg', import.meta.url).href,
    // Rear and near edge of the paving at x = 0, 1/4, 1/2, 3/4, 1.
    back: [398, 345, 319, 288, 278], front: [470, 480, 478, 444, 385],
    sky: '#352d34', stone: '#51483e', ground: '#756858', grout: '#363335',
  },
  gate: {
    url: new URL('./art/quarry-gate.jpg', import.meta.url).href,
    back: [329, 312, 294, 289, 320], front: [409, 462, 471, 443, 389],
    sky: '#172932', stone: '#33474a', ground: '#52616a', grout: '#29373d',
  },
  deep: {
    url: new URL('./art/quarry-landing.jpg', import.meta.url).href,
    back: [332, 310, 282, 270, 286], front: [396, 459, 437, 413, 386],
    sky: '#102832', stone: '#254449', ground: '#507c7c', grout: '#203c42',
  },
};

const studies = {
  "market": "0dWN9a2NjWlEafGNsbGNjWitjWnVsbFtaSWNjWmNaY2xaY1tjbFpjY3V1a2t0YmNaURpsdGxto1EJGlt9tH1aUVpza2RbWlJjdGxbW2x0Y2tafqtjYlFsY2NjY2xjWmxRERpaWltsUUkJElFbZGNRWmxsdZtRUSNrUmJaWmJiY2NaWlJaWmxjW2NjWmNaY1JJCVpJI3R+tXVsWmNSUlJRUREiYmJaUlpaY2taWmNsY2tsbGxsWmtSUklaUixsdWxjUlpSUlpjUlpREmtiYkkSY2tra1paWlpaWmxsbGNaUkkRUlEjY320Y1JaWlpsZFtaURpSa2NrY2JaWRERERliY1kZUVpjUkkRGmNjUlprY1paWlpsZG2jWlpaURJaUlEREQkRESJhYmtiYllZYmt0YlFbWlpaUVpREVpSG2Rso1pZWlEZERERGRkJERpJGVpRERpiYmJia3RjY0kja2taWVFjWmNbW2xZWhEba1ERGmIqGREbUlEaSRoRK0kRCQkJEVpJCRERCQkRbGNsdbWsSQkRGnRaETQzKhERI1pRG1JSUlJSUlJRGRFSURoaEREaUWNjbGy1o1ESUWN0UREiayJRERERGRtaWlERUlpaURpaWmNjW1taUlpaW1taWlJSURoaYlEjWhpiUVERElpjY2NaWlpSWltaW1pSUlJSUlpSUlJSUlJSa2NaY1pRK2N0dGxsY2NjWmNaWltbW1taW1tbWlpaWlJSUlJaUlJSUlosY1paWmtjY2t0Y2NbWmNjY2NbWlpbW2NaWlpbW1JaW1pSUlJSUlJbW2tbWlpja3V0a2NrY1taWlpjWltjWltjY1taW1taW1pSWlpbY2NjWlpbY2NjY2NsY3RjY2NjW1paW2NjY2NjY1paW2NaWlpSUlJSElpbUlpaWlpbY1pjY2NjWlpaY1paWmNaWltbY1paW1paWmNjY1pREVFSSRFaUlpkbGNaWlpaY1paWlpaW1paWltbW1taY2NbW1pRElJJEVJRUUlSWlpaWlpaWlJaW1pbWlpaWltbW1JaUlJSSVJRUlJRCRJSSRJaUlFSUk=",
  "gate": "JSklKQQlTiUkJG0lSUklBCVpJCQkJCQFJQVJJUklJSVJRSUkJEUlBCUpTVIlLlJOBCVJbW1JBCUlaSSNJCREJUkpJQQlAARFJURJBGlpRSRFSVIuKVJOKSklJUltJSUpRWlEaSUlJSlJJSQEJQAFSSVJJCRpaUklSW0pKS5OKSkpJSVtbSQpJUREJGhEKSlJaSUlJSUlJSUlRSUlSWlJJUltJSUpJS0pKUlJjZFpjWlpbSRIJSQlSUkEbSWNSWlpJUkpJWmRjUklbSUlKSlXTiklJW2RSYltbYlESUltSSRtJUlEREQlJCVpJSRpaUklSZIpKS4uLSUlJSWRkSQkJElERGlEaURESUUEKQUpJSkpaSUlSW1JJUmWaSkpJSkuJClJkpJEaERJRQAkJG1JJCRFJSklLikpSUUlJUmSSUUpcY0lKSktLmklSW2SJUlJSW1tRUmNSUlJaUlJKSUpLkVFJUVJkUlpSUltjSkuLSUkSUltTU1JTUkkJERJbUlJJUkkSSUpKUlFSWlFSW1JSSUlSW1pKSklJUkpSW1xSU1EiYhpSW1JSSRJaUklKSklSUlpRUmNaUklSUltSSlJSUlJSSlNTUlJSUlJRUlJSUlJSWlJSUlJJSUlJSRtkUlJSW1JJUklSU0pJSVJSUkpSUlJbUlJSUlJSUlNSUlJSUlJSUlJSUkpJUluSUlJSUlOSSVJSUlJSUlJSWlJSUlJSUlJSUlJSUlJSUlJKUlJSSkpTUlJSSlJTklJSUlJSUlJSUlpSUlJSUlJSUlJSUlJaU1JSUlJSUkpJSkpKUlJSUkpJUlJSUlJbW1JaW1tbWlJSUlJSUlJSUlJSUlJSSlJSU1NKUlJSUlJSUlJSUlJSUlpSW1NbW1JSUlJTUlJJUlJSUlJJSVJRUklSUlJSSlJKSlJSUlJSUlJSUlJTUlJTUlNTUlJSUlJSW1NKUlpaUVFJEmJaWltTUlJbUlJSUlJSUlJSU1JbU1NTU1JbUlJJSlJJUlJbUlJJSRESUltSUkkKUklSUlJTUltbUlJSSkkJCUpJUlJJSVJJSVJSWklJUk=",
  "deep": "BCUlJW1yKQUFCQUpKSkFCSkFBQUJCQUpLikkKSkpJQUlJUkFBSUlACUlBUlJTU0pBQkpKS0FKS4yKSkpKSkpVi4tLilJJUVFJSUlSU0pJQQlJQVJSWlJSQkpKQUpKSkuNi4uKSkpLlIpMi4uJUklJSQkaWltTUklSiklSW1JJW0tMi0lKSklKSkuMi4JLS4tCS4uKSklJUVFRERFSUkkJElJKUltKSVtKSktJU1JJS4lKTIpCS4uCQkpJS0pKUlFJElJSI1paCQpJUltkSlJcgUFBSlJSSkuKSkuKSkpKSkpSUVOTUlxSU1JSY3RjYkkJSVJkW0lKW0pLQlJKU0pKSkJCSlNKQUlKUlEKUkpbUklSU1JSUlEJCUlJU1NcUltKS4FKSkpCS0JBS0pKSkpLSUpKSlJSZJNACVJbW1JSUlJaiVJKSlJSSkFBQUFBQlSLSltTSktLTIFKQVtSZKSSQQpKW1taUltJUlpSSkpBU0JKSkFBQUFLQUlKSkFBQUJBQklKSltbSkEKSmNaUmNRSVJ0UkpJQQtBSlJKSkpKS0pSSVNJSkpTU1JSUlJSUlJSUlpbY1tSUVJaWltbUlJTUlpSUlJSUlJSU1tTUlJSU5STUlJSUltSUlJSY2xbUlJSUltSUlJTW12cm1tbW1NTVJWTU1NbU1SUk1NSU1JSUlNSU1tsW1tSW1t1Y1tbW1ydnJtbW1tbU1Ncm1NTW1tTU1NTU1NTUlNSU1tSW1JaUlJbY1tbW1tTW1NbZJxTU1NcXFtbXJxcXFxbU1NbU1tbUlNbU1JadVJSUltSU1NTU1xcU1NbW1NbU1tbW1tkW2RkXJtbW1tTU1ybU1pjW2NaWltbW1tTU1tbU1NTU1NbW2SknJxcZGRkpaRcW1ycnFtbUltSUlJSSVFbklpbU1JSUlNTXFtTXFxkpJxcklJKUlNJCkkJCUkJCQkKSQlJUkkJUVpSW1FbUltkpIkKUkpJSQpKSQkJAUFTQUFBQUESSUpBAQlKSltBSUlSUklJSUlSSQkBCQEBAUFKQUEBQUFCVIJCQUFBSUFBQUFBQUlsQU="
};

const plateCache = new Map();

function sample(stops, x) {
  const u = Math.max(0, Math.min(4, x / CUT_WIDTH * 4));
  const i = Math.min(3, Math.floor(u));
  return stops[i] + (stops[i + 1] - stops[i]) * (u - i);
}

function placeY(place, sx, sy) {
  const back = sample(place.back, sx);
  const front = sample(place.front, sx);
  if (sy <= back) return sy / back * BACK;
  if (sy <= front) return BACK + (sy - back) / (front - back) * (FRONT - BACK);
  return FRONT + (sy - front) / (CUT_HEIGHT - front) * (HEIGHT - FRONT);
}

function poly(c, points, fill) {
  c.fillStyle = fill;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fill();
}

function line(c, color, width, points) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.stroke();
}

function gradient(c, y1, y2, start, end) {
  const g = c.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, start);
  g.addColorStop(1, end);
  return g;
}

function lamp(c, x, y, radius, rgb, strength) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, 'rgba(' + rgb + ',' + strength + ')');
  g.addColorStop(0.35, 'rgba(' + rgb + ',' + strength * 0.43 + ')');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// The bundled miniature is a 40 × 20 color study of the same painting.
// Use it immediately on a slow connection and retain it after any image error.
function colorStudy(c, pixels) {
  const study = document.createElement('canvas');
  study.width = 40;
  study.height = 20;
  const brush = study.getContext('2d');
  if (!brush) return;
  const bytes = atob(pixels);
  const image = brush.createImageData(40, 20);
  for (let i = 0; i < bytes.length; i++) {
    const value = bytes.charCodeAt(i);
    image.data[4*i] = ((value >> 5) + .5) * 32;
    image.data[4*i+1] = (((value >> 2) & 7) + .5) * 32;
    image.data[4*i+2] = (value & 3) * 85;
    image.data[4*i+3] = 255;
  }
  brush.putImageData(image, 0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(study, 0, 0, WIDTH, HEIGHT);
}

function sketchArch(c, x, floor, width, height, shadow, trim) {
  const w = width/2;
  c.fillStyle = shadow;
  c.beginPath();
  c.moveTo(x-w, floor);
  c.lineTo(x-w, floor-height*.55);
  c.quadraticCurveTo(x-w, floor-height*.8, x, floor-height);
  c.quadraticCurveTo(x+w, floor-height*.8, x+w, floor-height*.55);
  c.lineTo(x+w, floor);
  c.fill();
  c.strokeStyle = trim;
  c.lineWidth = 4;
  c.stroke();
}

function fallback(c, scene, p) {
  c.fillStyle = gradient(c, 0, HEIGHT, p.sky, p.ground);
  c.fillRect(0, 0, WIDTH, HEIGHT);
  colorStudy(c, studies[scene]);
  c.fillStyle = gradient(c, BACK - 15, HEIGHT, p.ground, p.grout);
  c.fillRect(0, BACK-15, WIDTH, HEIGHT-BACK+15);
  c.save();
  c.beginPath(); c.rect(0,BACK-15,WIDTH,HEIGHT-BACK+15); c.clip();
  for (let i=-15; i<35; i++) {
    line(c, p.grout, 1.2, [[i*60,BACK-24],[i*60+280,HEIGHT]]);
    line(c, '#b1a58c42', 1, [[i*69,BACK-18],[i*69-382,HEIGHT]]);
  }
  c.restore();
  c.globalAlpha = .73;
  if (scene === 'market') {
    for (let i=0; i<4; i++) {
      const x=34+i*142, y=170+i*8;
      poly(c,[[x,y],[x+95,y-32],[x+158,y+6],[x+52,y+34]],i%2 ? '#9c7646':'#844833');
      line(c,'#be9a63',3,[[x+52,y+34],[x+52,y+138]]);
      line(c,'#7b5a40',4,[[x+144,y+12],[x+144,y+110]]);
    }
    sketchArch(c,892,325,138,196,'#292c2d','#957f64');
    lamp(c,198,266,75,'255,156,57',.6);
  } else {
    for(let i=0;i<6;i++) {
      const x=i*186+18, y=scene==='gate'?285:245;
      sketchArch(c,x,y,112,160+(i%3)*30,'#10232a','#687368');
    }
    const rig = scene === 'gate' ? 856 : 710;
    line(c,'#403c34',11,[[rig-65,324],[rig-64,102],[rig+56,72],[rig+57,305]]);
    line(c,'#ac8856',3,[[rig-60,107],[rig+50,81]]);
    line(c,'#b1966b',2,[[rig,94],[rig,216]]);
    poly(c,[[rig-15,219],[rig,211],[rig+16,217],[rig+15,260],[rig,269],[rig-15,258]],'#986f47');
  }
  c.globalAlpha = 1;
}

function painted(c, img, p) {
  // Render the registration once per load, never once per animation frame.
  // Two-pixel strips preserve mortar detail while aligning the tilted walkway.
  c.imageSmoothingEnabled = true;
  for (let x = 0; x < WIDTH; x += 2) {
    const sx = x / WIDTH * CUT_WIDTH;
    const sw = 2 / WIDTH * CUT_WIDTH;
    const b = sample(p.back, sx + sw / 2);
    const f = sample(p.front, sx + sw / 2);
    c.drawImage(img, sx, 0, sw, b, x, 0, 2, BACK);
    c.drawImage(img, sx, b, sw, f - b, x, BACK, 2, FRONT-BACK);
    c.drawImage(img, sx, f, sw, CUT_HEIGHT-f, x, FRONT, 2, HEIGHT-FRONT);
  }
  const wash = gradient(c, BACK-28, FRONT, '#18202508', '#17212b18');
  c.fillStyle = wash;
  c.fillRect(0, BACK-28, WIDTH, FRONT-BACK+28);
}

function frameFor(scene, p) {
  let entry = plateCache.get(scene);
  if (entry) return entry;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const brush = canvas.getContext('2d');
  if (!brush) throw new Error('A 2D canvas is required for the quarry expedition.');
  entry = { canvas, painted: false };
  plateCache.set(scene, entry);
  fallback(brush, scene, p);
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    painted(brush, img, p);
    entry.painted = true;
    window.dispatchEvent(new CustomEvent('quarry-art-ready', { detail: scene }));
  };
  img.src = p.url;
  return entry;
}

function beacon(c, p, sx, sy, r, rgb, t, speed) {
  const flicker = .67 + .21 * Math.sin(t*speed) + .12 * Math.sin(t*speed*2.8+.91);
  lamp(c, sx/CUT_WIDTH*WIDTH, placeY(p,sx,sy), r, rgb, .18*flicker);
}

function animate(c, scene, p, t) {
  c.save();
  if (scene === 'market') {
    beacon(c,p,199,278,68,'255,126,40',t,4.3);
    for(let i=0;i<10;i++) {
      const u=(t*(.16+(i%3)*.04)+i*.618)%1;
      const x=(197+Math.sin(i*44+t*.3)*15+u*9)/CUT_WIDTH*WIDTH;
      const y=placeY(p,198,275)-u*58;
      c.fillStyle='rgba(255,199,108,'+(.38*(1-u))+')';
      c.fillRect(x,y,1.4,1.8);
    }
  } else if (scene === 'gate') {
    beacon(c,p,463,273,73,'255,133,47',t,2.8);
    beacon(c,p,675,262,50,'255,130,53',t,2.2);
    const cx=552/CUT_WIDTH*WIDTH, cy=placeY(p,552,190);
    for(let i=0;i<6;i++) {
      const u=(t*.15+i/6)%1;
      const x=cx-u*12+Math.sin(t*.7+i)*u*5;
      const y=cy-43*u;
      lamp(c,x,y,3+u*11,'191,203,185',.075*Math.sin(Math.PI*u));
    }
  } else {
    beacon(c,p,64,266,44,'255,178,66',t,2.3);
    beacon(c,p,923,129,48,'255,176,64',t,2.8);
    for(let i=0;i<28;i++) {
      const sx=109+(i*157)%535;
      const sy=203+(i*23)%52;
      const u=(i*.31+t*.16)%1;
      const x=sx/CUT_WIDTH*WIDTH+3*u, y=placeY(p,sx,sy)+1.7*u;
      const opacity=.16*Math.sin(Math.PI*u);
      line(c,'rgba(145,243,233,'+opacity+')',.9,[[x,y],[x+3+9*u,y-.2],[x+6+10*u,y+.1]]);
    }
  }
  c.restore();
}

/** Draw the environment before actors. The return value is true once the full plate is on canvas. */
export function drawQuarryScene(ctx, scene, seconds = 0) {
  const key = Object.hasOwn(places, scene) ? scene : 'market';
  const p = places[key];
  const frame = frameFor(key, p);
  ctx.save();
  ctx.drawImage(frame.canvas, 0, 0, WIDTH, HEIGHT);
  animate(ctx, key, p, Number.isFinite(seconds) ? Math.max(0,seconds) : 0);
  ctx.restore();
  return frame.painted;
}

/** Draw after actors. Atmosphere and near-water glints sit below the playable foot line. */
export function drawQuarryForeground(ctx, scene, seconds = 0) {
  ctx.save();
  if (scene === 'deep') {
    const t=Number.isFinite(seconds)?Math.max(0,seconds):0;
    for(let i=0;i<14;i++) {
      const x=315+(i*131)%593;
      const y=576+(i*17)%19;
      const a=.07+.07*Math.sin(t*1.4+i*2.2);
      line(ctx,'rgba(148,239,218,'+a+')',1,[[x,y],[x+5+2*Math.sin(i+t),y-.6],[x+8,y]]);
    }
  }
  ctx.fillStyle=gradient(ctx,HEIGHT-23,HEIGHT,'rgba(9,14,20,0)','rgba(6,10,16,.25)');
  ctx.fillRect(0,HEIGHT-23,WIDTH,23);
  ctx.restore();
}

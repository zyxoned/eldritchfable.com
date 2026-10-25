import { useEffect, useRef } from 'react';
import {
  WIDTH, HEIGHT, SPAWN, SHRINE, CRYSTALS, CLASSES, tile, type Realm,
} from './shared/game';

const S = 32;

function random(x: number, y: number, salt = 0) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function tree(c: CanvasRenderingContext2D, x: number, y: number, variant: number) {
  c.fillStyle = '#1c202e';
  c.fillRect(x - 17, y + 6, 40, 13);
  c.fillStyle = '#795d3b';
  c.fillRect(x - 4, y - 10, 9, 26);
  c.fillStyle = variant > .5 ? '#2f2d3d' : '#262a39';
  c.fillRect(x - 25, y - 37, 51, 28);
  c.fillRect(x - 18, y - 50, 37, 49);
  c.fillRect(x - 9, y - 57, 19, 62);
  c.fillStyle = variant > .5 ? '#4f4457' : '#433b51';
  c.fillRect(x - 19, y - 39, 32, 9);
  c.fillRect(x - 10, y - 51, 21, 10);
  c.fillStyle = '#665366';
  c.fillRect(x - 8, y - 50, 11, 4);
}

function hero(c: CanvasRenderingContext2D, x: number, y: number, color: string, time: number) {
  const bounce = Math.sin(time / 450) > 0 ? 0 : 1;
  c.fillStyle = '#25493480';
  c.fillRect(x - 10, y + 9, 22, 7);
  c.fillStyle = '#263e36';
  c.fillRect(x - 7, y + 4, 5, 8);
  c.fillRect(x + 3, y + 4, 5, 8);
  c.fillStyle = color;
  c.fillRect(x - 9, y - 9 + bounce, 19, 16);
  c.fillRect(x - 7, y - 22 + bounce, 15, 15);
  c.fillRect(x - 11, y - 17 + bounce, 22, 7);
  c.fillStyle = '#f3d2a0';
  c.fillRect(x - 4, y - 14 + bounce, 11, 8);
  c.fillStyle = '#243d35';
  c.fillRect(x - 1, y - 12 + bounce, 2, 2);
  c.fillRect(x + 5, y - 12 + bounce, 2, 2);
  c.fillStyle = '#f0dfb5';
  c.fillRect(x - 8, y + 1, 17, 3);
  c.fillStyle = '#806a47';
  c.fillRect(x + 13, y - 16, 3, 28);
  c.fillStyle = '#e5e9c2';
  c.fillRect(x + 11, y - 19, 7, 8);
}

export default function GameCanvas({
  realm, playerId, onTile,
}: {
  realm: Realm | null;
  playerId: string | null;
  onTile: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ realm, playerId });
  latest.current = { realm, playerId };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    let animation = 0;
    const draw = (time: number) => {
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, WIDTH * S, HEIGHT * S);
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const kind = tile(x, y);
          const n = random(x, y);
          c.fillStyle = kind === 'water' ? '#373851'
            : kind === 'path' || kind === 'bridge' ? '#706256'
            : n > .6 ? '#343944' : n > .3 ? '#383c46' : '#3b4049';
          c.fillRect(x * S, y * S, S, S);
          if (kind === 'grass') {
            c.fillStyle = n > .5 ? '#555362' : '#2f303d';
            for (let i = 0; i < 3; i++) {
              const px = x * S + Math.floor(random(x, y, i + 1) * 26);
              const py = y * S + Math.floor(random(x, y, i + 7) * 26);
              c.fillRect(px, py, 3, 2);
            }
            if (n > .88) {
              c.fillStyle = '#d2b581';
              c.fillRect(x * S + 15, y * S + 18, 3, 3);
              c.fillStyle = '#4f4c59';
              c.fillRect(x * S + 16, y * S + 21, 2, 4);
            }
          }
          if (kind === 'path') {
            c.fillStyle = '#5b4e4a';
            c.fillRect(x * S + n * 24, y * S + 9, 4, 2);
            c.fillStyle = '#847461';
            c.fillRect(x * S + 19, y * S + 21, 6, 3);
          }
          if (kind === 'water') {
            c.fillStyle = '#686285';
            const offset = Math.floor(time / 800 + x) % 4;
            c.fillRect(x * S + 4 + offset, y * S + 12, 15, 2);
            c.fillRect(x * S + 13 - offset, y * S + 25, 10, 2);
          }
          if (kind === 'bridge') {
            c.fillStyle = '#a18458';
            c.fillRect(x * S, y * S, S, S);
            c.fillStyle = '#c1a16a';
            for (let k = 0; k < 4; k++) c.fillRect(x * S, y * S + k * 8, S, 6);
            c.fillStyle = '#6c6146';
            if (y === 11 || y === 13) c.fillRect(x * S, y * S + (y === 11 ? 0 : 27), S, 5);
          }
        }
      }
      // A tiny campsite, hand drawn in pixels.
      const cx = SPAWN.x * S + 16;
      const cy = SPAWN.y * S + 16;
      c.fillStyle = '#31313d';
      c.fillRect(cx - 50, cy - 93, 92, 50);
      c.fillStyle = '#d39864';
      c.beginPath();
      c.moveTo(cx - 48, cy - 48);
      c.lineTo(cx - 9, cy - 102);
      c.lineTo(cx + 31, cy - 48);
      c.fill();
      c.fillStyle = '#ebbd81';
      c.beginPath();
      c.moveTo(cx - 9, cy - 102);
      c.lineTo(cx - 4, cy - 48);
      c.lineTo(cx + 31, cy - 48);
      c.fill();
      c.fillStyle = '#63533a';
      c.beginPath();
      c.moveTo(cx - 10, cy - 77);
      c.lineTo(cx - 25, cy - 48);
      c.lineTo(cx + 3, cy - 48);
      c.fill();
      c.fillStyle = '#707059';
      c.fillRect(cx + 40, cy - 36, 28, 7);
      c.fillRect(cx + 34, cy - 30, 40, 7);
      c.fillStyle = '#8e6444';
      c.fillRect(cx + 40, cy - 27, 28, 8);
      c.fillStyle = '#efab51';
      c.fillRect(cx + 46, cy - 42, 16, 19);
      c.fillStyle = '#ffe19a';
      c.fillRect(cx + 51, cy - 48 + Math.floor(time / 200) % 4, 6, 19);
      c.fillStyle = '#785e3f';
      c.fillRect(14 * S, 13 * S + 5, 5, 30);
      c.fillRect(14 * S - 7, 13 * S + 3, 25, 13);
      c.fillStyle = '#e1cc95';
      c.fillRect(14 * S - 4, 13 * S + 7, 16, 3);

      const sx = SHRINE.x * S + 16;
      const sy = SHRINE.y * S + 16;
      c.fillStyle = '#4a414e';
      c.fillRect(sx - 39, sy - 8, 78, 31);
      c.fillStyle = '#897b83';
      c.fillRect(sx - 34, sy + 4, 69, 12);
      c.fillStyle = '#615866';
      c.fillRect(sx - 28, sy - 44, 13, 48);
      c.fillRect(sx + 17, sy - 44, 13, 48);
      c.fillRect(sx - 30, sy - 48, 62, 13);
      c.fillStyle = '#474052';
      c.fillRect(sx - 30, sy - 48, 29, 6);
      c.fillRect(sx + 18, sy - 18, 12, 6);
      c.fillStyle = '#dfb97b';
      c.fillRect(sx - 4, sy - 25, 8, 17);
      c.fillStyle = '#9a70ad';
      c.fillRect(sx - 8, sy - 19, 16, 6);

      for (const crystal of CRYSTALS) {
        const x = crystal.x * S + 16;
        const y = crystal.y * S + 16;
        c.fillStyle = '#6d915780';
        c.fillRect(x - 14, y + 4, 30, 10);
        c.fillStyle = '#d1f4de';
        c.beginPath();
        c.moveTo(x, y - 24);
        c.lineTo(x + 11, y - 8);
        c.lineTo(x + 4, y + 10);
        c.lineTo(x - 9, y + 1);
        c.lineTo(x - 10, y - 14);
        c.fill();
        c.fillStyle = '#7dbee0';
        c.beginPath();
        c.moveTo(x, y - 24);
        c.lineTo(x + 11, y - 8);
        c.lineTo(x + 4, y + 10);
        c.lineTo(x, y - 4);
        c.fill();
        c.fillStyle = '#addce5';
        c.fillRect(x + 13, y - 5, 6, 15);
        if (Math.sin(time / 650 + crystal.x) > .5) {
          c.fillStyle = '#fff5cc';
          c.fillRect(x - 18, y - 22, 3, 3);
          c.fillRect(x + 18, y - 29, 3, 3);
        }
      }

      const state = latest.current;
      for (const enemy of state.realm?.enemies || []) {
        if (enemy.hp <= 0 && enemy.respawnAt > Date.now()) continue;
        const x = enemy.x * S + 16;
        const y = enemy.y * S + 16;
        const b = Math.sin(time / 400 + enemy.x) > 0 ? 1 : 0;
        c.fillStyle = '#486b4580';
        c.fillRect(x - 13, y + 9, 27, 7);
        c.fillStyle = '#527847';
        c.fillRect(x - 12, y - 7 + b, 26, 20);
        c.fillRect(x - 8, y - 14 + b, 17, 25);
        c.fillStyle = '#7d9853';
        c.fillRect(x - 9, y - 9 + b, 17, 13);
        c.fillStyle = '#39573a';
        c.fillRect(x - 9, y - 19, 5, 10);
        c.fillRect(x + 5, y - 22, 5, 12);
        c.fillStyle = '#f5e5b6';
        c.fillRect(x - 6, y - 3 + b, 4, 4);
        c.fillRect(x + 5, y - 3 + b, 4, 4);
        c.fillStyle = '#314d37';
        c.fillRect(x - 4, y - 2 + b, 2, 2);
        c.fillRect(x + 6, y - 2 + b, 2, 2);
        if (enemy.hp < 42 && enemy.hp > 0) {
          c.fillStyle = '#466143';
          c.fillRect(x - 14, y - 28, 28, 4);
          c.fillStyle = '#d4a56d';
          c.fillRect(x - 14, y - 28, 28 * enemy.hp / 42, 4);
        }
      }
      const players = [...(state.realm?.players || [])].sort((a, b) => a.y - b.y);
      for (const p of players) {
        const x = p.x * S + 16;
        const y = p.y * S + 16;
        if (p.id === state.playerId) {
          c.strokeStyle = '#fff3c3';
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(x, y + 12, 18, 7, 0, 0, Math.PI * 2);
          c.stroke();
        }
        hero(c, x, y, CLASSES[p.heroClass].color, time);
        c.font = 'bold 11px sans-serif';
        const label = p.name + (p.id === state.playerId ? ' · you' : '');
        const labelWidth = c.measureText(label).width;
        c.fillStyle = '#17121fe6';
        c.fillRect(x - labelWidth / 2 - 6, y - 43, labelWidth + 12, 17);
        c.fillStyle = '#f3eee4';
        c.textAlign = 'center';
        c.fillText(label, x, y - 31);
      }

      // Trees frame the playable meadow without hiding its objectives.
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const border = y <= 1 || y >= HEIGHT - 2 || x === 0 || x === WIDTH - 1;
          const grove = (x >= 10 && x <= 18 && y >= 18)
            || (x >= 14 && x <= 18 && y >= 2 && y <= 3)
            || (x >= 27 && y >= 15 && y <= 18);
          if ((border || grove) && tile(x, y) === 'grass' && random(x, y, 4) > .22) {
            tree(c, x * S + 15, y * S + 21, random(x, y));
          }
        }
      }

      // Place names make the map legible as a little world.
      c.font = '10px monospace';
      c.textAlign = 'center';
      const label = (text: string, x: number, y: number) => {
        const w = c.measureText(text).width;
        c.fillStyle = '#18131fce';
        c.fillRect(x - w / 2 - 8, y - 11, w + 16, 19);
        c.fillStyle = '#e7d5b2';
        c.fillText(text, x, y + 2);
      };
      label('WAYFARER CAMP', 11 * S, 15 * S);
      label('OLD MOON SHRINE', 24 * S, 3 * S);
      c.fillStyle = '#f8edc4';
      c.font = 'bold 18px serif';
      c.fillText('N', 28 * S, 3 * S);
      c.fillRect(28 * S - 1, 3 * S + 8, 2, 18);
      c.beginPath();
      c.moveTo(28 * S, 3 * S + 4);
      c.lineTo(28 * S - 4, 3 * S + 12);
      c.lineTo(28 * S + 4, 3 * S + 12);
      c.fill();
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, []);

  return (
    <canvas
      ref={ref}
      width={WIDTH * S}
      height={HEIGHT * S}
      aria-label="Mossvale shared world map. Click a location to walk, or use the arrow keys. Thornlings are green creatures; crystals are blue."
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onTile(
          Math.floor((event.clientX - bounds.left) / bounds.width * WIDTH),
          Math.floor((event.clientY - bounds.top) / bounds.height * HEIGHT),
        );
      }}
    />
  );
}
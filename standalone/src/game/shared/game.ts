import { CLASS_CATALOG, PLAYER_CLASS_IDS as PLAYABLE_IDS, ADMIN_CLASS_ID as ADMIN_ID } from '../../../shared/class-catalog.mjs';

export type HeroClass = 'ranger' | 'knight' | 'mage' | 'bard' | 'cleric' | 'wizard' | 'sorcerer' | 'monk' | 'death-knight';
export type Equipment = { id: string; name: string; slot: string; rarity: string; description: string };
export type Skill = {
  id: string; name: string; description: string; cooldownMs: number;
  type: 'strike' | 'area' | 'heal' | 'ward' | 'passive' | 'execute';
  target: 'enemy' | 'self' | 'party';
  damage?: number; heal?: number; range?: number; radius?: number; ward?: number; durationMs?: number;
};
export type ClassDefinition = {
  id: HeroClass; name: string; color: string; description: string; role: string; lore: string;
  damage: number; range: number; armor: number; equipment: Equipment[]; skills: Skill[];
};
export const PLAYER_CLASS_IDS = PLAYABLE_IDS as readonly Exclude<HeroClass, 'death-knight'>[];
export const ADMIN_CLASS_ID: HeroClass = ADMIN_ID;
export const CLASSES = CLASS_CATALOG as Record<HeroClass, ClassDefinition>;

export type Player = {
  id: string;
  name: string;
  heroClass: HeroClass;
  x: number;
  y: number;
  hp: number;
  xp: number;
  gold: number;
  kills: number;
  gathered: string[];
  shrine: boolean;
  claimed: boolean;
  race?: string;
  levelLabel?: string;
  hidden?: boolean;
  equipment?: Equipment[];
  wardUntil?: number;
  wardAmount?: number;
};

export type Enemy = {
  id: string;
  x: number;
  y: number;
  hp: number;
  respawnAt: number;
};

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  time: number;
  system?: boolean;
};

export type RealmEffect = {
  id: string; type: 'strike' | 'area' | 'heal' | 'ward' | 'execute';
  x: number; y: number; color: string; at: number; radius?: number; actorId: string;
};

export type Realm = {
  revision: number;
  players: Player[];
  enemies: Enemy[];
  messages: ChatMessage[];
  serverTime: number;
  seventh?: Player | null;
  effects?: RealmEffect[];
};

export const WIDTH = 30;
export const HEIGHT = 22;
export const SPAWN = { x: 10, y: 13 };
export const SHRINE = { x: 24, y: 5 };

export const CRYSTALS = [
  { id: 'moon', x: 7, y: 5 },
  { id: 'fern', x: 24, y: 15 },
  { id: 'brook', x: 18, y: 17 },
];

export const ENEMIES = [
  { id: 'bramble', x: 17, y: 8 },
  { id: 'thistle', x: 21, y: 13 },
  { id: 'briar', x: 13, y: 5 },
  { id: 'sprig', x: 26, y: 10 },
];

export function tile(x: number, y: number): 'grass' | 'water' | 'path' | 'bridge' {
  const river = x >= 3 + Math.floor(y / 7) && x <= 5 + Math.floor(y / 7);
  if (river && y >= 11 && y <= 13) return 'bridge';
  if (river) return 'water';
  if ((y >= 12 && y <= 13 && x < 23) || (x >= 22 && x <= 23 && y > 4 && y < 14)) return 'path';
  return 'grass';
}

export function walkable(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1
    && x < WIDTH - 1 && y < HEIGHT - 1 && tile(x, y) !== 'water';
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function level(xp: number): number {
  return 1 + Math.floor(xp / 100);
}

export function questReady(player: Player): boolean {
  return player.kills >= 3 && player.gathered.length >= 2 && player.shrine;
}
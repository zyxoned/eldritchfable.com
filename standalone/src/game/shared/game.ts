import { REGIONS, DEFAULT_REGION_ID, regionById, regionTile, regionWalkable } from '../../../shared/world-catalog.mjs';
export { REGIONS, DEFAULT_REGION_ID, regionById };
export type RegionId = 'glade' | 'amberReach' | 'mistHarbor';
import { CLASS_CATALOG, PLAYER_CLASS_IDS as PLAYABLE_IDS, ADMIN_CLASS_ID as ADMIN_ID } from '../../../shared/class-catalog.mjs';

export type HeroClass = 'ranger' | 'knight' | 'mage' | 'bard' | 'cleric' | 'wizard' | 'sorcerer' | 'monk' | 'death-knight';
export type Equipment = { id: string; name: string; slot: string; rarity: string; description: string };
export type Skill = {
  id: string; name: string; description: string; cooldownMs: number;
  type: 'strike' | 'area' | 'heal' | 'ward' | 'passive';
  target: 'enemy' | 'self' | 'party';
  damage?: number; heal?: number; range?: number; radius?: number; ward?: number; durationMs?: number;
};
export type AttackStyle = 'arrow' | 'blade' | 'arcane' | 'notes' | 'radiance' | 'runes' | 'embers' | 'palm' | 'generic';
export type ClassDefinition = {
  id: HeroClass; name: string; color: string; description: string; role: string; lore: string;
  attackName: string; attackStyle: AttackStyle;
  damage: number; range: number; armor: number; equipment: Equipment[]; skills: Skill[];
};
export const PLAYER_CLASS_IDS = PLAYABLE_IDS as readonly Exclude<HeroClass, 'death-knight'>[];
export const ADMIN_CLASS_ID: HeroClass = ADMIN_ID;
export const CLASSES = CLASS_CATALOG as Record<HeroClass, ClassDefinition>;

export type Appearance = { skinTone: string; hairColor: string; hairStyle: string; outfit: string; accent: string; build: string };

export type Player = {
  regionId?: RegionId;
  appearance?: Appearance;
  id: string;
  name: string;
  heroClass: HeroClass;
  x: number;
  y: number;
  hp: number;
  maxHp?: number;
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
  attackStyle?: AttackStyle; originX?: number; originY?: number; skillId?: string;
};

export type GatheringSkillId = 'foraging' | 'mining' | 'fishing';
export type GatheringSkill = {
  id: GatheringSkillId; name: string; level: number; xp: number; levelXp: number;
  nextLevelXp: number; maxLevel: number; totalGathered: number;
};
export type ResourceNode = {
  id: string; name: string; regionId: RegionId; skillId: GatheringSkillId; materialId: string;
  x: number; y: number; requiredLevel: number; xp: number; regrowMs: number; availableAt: number;
};
export type GatheringProfile = {
  skills: GatheringSkill[];
  inventory: { id: string; name: string; skillId: GatheringSkillId; quantity: number; healHp?: number }[];
  cooldownUntil: number;
  maxInventory: number; nonredeemable: true;
};

export type Realm = {
  scopeId?: string;
  journey?: any;
  authored?: any;
  regionId?: RegionId;
  partyId: string | null;
  partyMode: 'open' | 'solo' | null;
  maxPlayers: number;
  maxVisitors: number;
  revision: number;
  players: Player[];
  enemies: Enemy[];
  messages: ChatMessage[];
  serverTime: number;
  visitors: Player[];
  effects?: RealmEffect[];
  resourceNodes?: ResourceNode[];
};

export const WIDTH = 30;
export const HEIGHT = 22;
// Legacy exports remain useful to the introductory glade and older clients.
export const SPAWN = regionById(DEFAULT_REGION_ID).spawn;
export const SHRINE = regionById(DEFAULT_REGION_ID).shrine;
export const CRYSTALS = regionById(DEFAULT_REGION_ID).crystals;
export const ENEMIES = regionById(DEFAULT_REGION_ID).enemies;
export function tile(x: number, y: number, regionId = DEFAULT_REGION_ID): 'grass' | 'water' | 'path' | 'bridge' {
  return regionTile(regionId, x, y);
}
export function walkable(x: number, y: number, regionId = DEFAULT_REGION_ID): boolean {
  return regionWalkable(regionId, x, y);
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

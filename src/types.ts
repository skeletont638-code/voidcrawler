import type { Room } from './dungeon.js';
import type { Player } from './entities.js';

export type RngFn = () => number;

export interface MonsterArchetype {
  id: string;
  name: string;
  hp: number;
  damage: number;
  critChance: number;
  dodgeChance: number;
  sightRange: number;
  ranged: boolean;
  range: number;
  fleeHpFraction: number;
  color: string;
  stationary?: boolean;
  trapRange?: number;
  trapDamage?: number;
}

export interface StartingClass {
  id: string;
  name: string;
  baseHp: number;
  str: number;
  dex: number;
  vit: number;
}

export interface TileGrid {
  grid: Uint8Array;
  width: number;
  height: number;
}

export interface Floor extends TileGrid {
  rooms: Room[];
  depth: number;
  stairsDown: { x: number; y: number };
}

export interface StatusEffect {
  damagePerTick: number;
  turnsRemaining: number;
}

export interface Affix {
  key: string;
  label: string;
  value: number;
}

export interface BaseItem {
  id: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll';
  name: string;
  baseDamage?: number;
  baseArmor?: number;
  healAmount?: number;
  statusEffect?: string;
}

export interface Item extends BaseItem {
  rarity: string;
  affixes: Affix[];
  identified: boolean;
}

export interface LootTableEntry {
  itemId: string | null;
  weight: number;
}

export type MonsterActionType = 'move' | 'attack' | 'rangedAttack' | 'placeTrap' | 'wait';

export interface MonsterAction {
  type: MonsterActionType;
  to?: { x: number; y: number };
  target?: Player;
  at?: { x: number; y: number };
}

export interface AttackStats {
  damage: number;
  critChance: number;
  dodgeChance: number;
}

export interface MetaProgression {
  currency: number;
  unlockedClasses: string[];
  unlockedPerks: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ShakeState { intensity: number; duration: number; elapsed: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; }
export interface FloatingText { x: number; y: number; text: string; color: string; life: number; vy: number; }
export interface TweenState<T = { x: number; y: number }> { from: T; to: T; duration: number; elapsed: number; }
export interface FxState {
  shake: ShakeState | null;
  particles: Particle[];
  floatingTexts: FloatingText[];
}

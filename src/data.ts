import type { MonsterArchetype, StartingClass, BaseItem, LootTableEntry, Biome, Perk } from './types.js';

export const TILE_SIZE = 24;
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 34;

export const XP_TABLE: number[] = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320];

export const STARTING_CLASSES: Record<string, StartingClass> = {
  adventurer: { id: 'adventurer', name: 'Adventurer', baseHp: 30, str: 5, dex: 5, vit: 5, unlockCost: 0 },
  berserker: { id: 'berserker', name: 'Berserker', baseHp: 26, str: 8, dex: 3, vit: 5, unlockCost: 100 },
  rogue: { id: 'rogue', name: 'Rogue', baseHp: 22, str: 4, dex: 9, vit: 4, unlockCost: 150 },
};

export const MONSTER_ARCHETYPES: Record<string, MonsterArchetype> = {
  rusher: {
    id: 'rusher',
    name: 'Rusher',
    hp: 12,
    damage: 4,
    critChance: 0.05,
    dodgeChance: 0.05,
    sightRange: 6,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#b33',
  },
  caster: {
    id: 'caster',
    name: 'Caster',
    hp: 8,
    damage: 5,
    critChance: 0.1,
    dodgeChance: 0.1,
    sightRange: 7,
    ranged: true,
    range: 5,
    fleeHpFraction: 0.3,
    color: '#33b',
  },
  trapper: {
    id: 'trapper',
    name: 'Trapper',
    hp: 10,
    damage: 6,
    critChance: 0.02,
    dodgeChance: 0.02,
    sightRange: 4,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#3b3',
    stationary: true,
    trapRange: 4,
    trapDamage: 6,
  },
  boss: {
    id: 'boss',
    name: 'Void Warden',
    hp: 60,
    damage: 9,
    critChance: 0.15,
    dodgeChance: 0.05,
    sightRange: 10,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#a0a',
  },
  brute: {
    id: 'brute',
    name: 'Brute',
    hp: 20,
    damage: 8,
    critChance: 0.02,
    dodgeChance: 0,
    sightRange: 5,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#732',
    turnsPerAction: 2,
  },
  swarmling: {
    id: 'swarmling',
    name: 'Swarmling',
    hp: 4,
    damage: 2,
    critChance: 0.05,
    dodgeChance: 0.1,
    sightRange: 8,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#dd6',
    packSize: 3,
  },
  shaman: {
    id: 'shaman',
    name: 'Shaman',
    hp: 9,
    damage: 3,
    critChance: 0.05,
    dodgeChance: 0.1,
    sightRange: 6,
    ranged: false,
    range: 1,
    fleeHpFraction: 0.5,
    color: '#6dd',
    support: true,
  },
  stalker: {
    id: 'stalker',
    name: 'Stalker',
    hp: 11,
    damage: 7,
    critChance: 0.2,
    dodgeChance: 0.08,
    sightRange: 6,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#616',
    invisible: true,
  },
  'caverns-boss': {
    id: 'caverns-boss',
    name: 'Spore Matriarch',
    hp: 70,
    damage: 7,
    critChance: 0.1,
    dodgeChance: 0.05,
    sightRange: 9,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#6a2',
    support: true,
  },
  'depths-boss': {
    id: 'depths-boss',
    name: 'The Unseen',
    hp: 90,
    damage: 11,
    critChance: 0.2,
    dodgeChance: 0.1,
    sightRange: 12,
    ranged: false,
    range: 1,
    fleeHpFraction: 0,
    color: '#818',
    invisible: true,
  },
};

export const BIOMES: Biome[] = [
  {
    id: 'catacombs',
    name: 'Catacombs',
    floors: [1, 2, 3],
    wallColor: '#241c1c',
    floorColor: '#3a2e2e',
    stairsColor: '#4a3a20',
    archetypeWeights: { rusher: 4, caster: 3, trapper: 2, swarmling: 2 },
    bossArchetypeId: 'boss',
  },
  {
    id: 'caverns',
    name: 'Fungal Caverns',
    floors: [4, 5, 6],
    wallColor: '#1c2418',
    floorColor: '#2e3a2a',
    stairsColor: '#3a4a20',
    archetypeWeights: { rusher: 2, caster: 2, brute: 3, swarmling: 4, shaman: 2 },
    bossArchetypeId: 'caverns-boss',
  },
  {
    id: 'depths',
    name: 'Void Depths',
    floors: [7, 8, 9],
    wallColor: '#1c1c26',
    floorColor: '#26263a',
    stairsColor: '#3a2e4a',
    archetypeWeights: { brute: 2, shaman: 2, stalker: 4, trapper: 2 },
    bossArchetypeId: 'depths-boss',
  },
];

export const PERK_POOL: Perk[] = [
  {
    id: 'vitality',
    label: '+15% max HP',
    apply: (p) => {
      const bonus = Math.round(p.maxHp * 0.15);
      p.maxHp += bonus;
      p.hp += bonus;
    },
  },
  {
    id: 'precision',
    label: '+8% crit chance',
    apply: (p) => {
      p.dex += 8;
    },
  },
  {
    id: 'evasion',
    label: '+10% dodge chance',
    apply: (p) => {
      p.dex += 6;
      p.vit += 2;
    },
  },
  {
    id: 'lifesteal',
    label: 'Heal 20% of crit damage dealt',
    apply: (p) => {
      p.perks.push('lifesteal');
    },
  },
  {
    id: 'resilience',
    label: '+2 trap/status damage resistance',
    apply: (p) => {
      p.perks.push('resilience');
    },
  },
];

export const BASE_ITEMS: BaseItem[] = [
  { id: 'short-sword', type: 'weapon', name: 'Short Sword', baseDamage: 4 },
  { id: 'long-sword', type: 'weapon', name: 'Long Sword', baseDamage: 6 },
  { id: 'leather-armor', type: 'armor', name: 'Leather Armor', baseArmor: 2 },
  { id: 'chain-armor', type: 'armor', name: 'Chain Armor', baseArmor: 4 },
  { id: 'health-potion', type: 'potion', name: 'Unidentified Potion', healAmount: 15 },
  { id: 'scroll-of-fire', type: 'scroll', name: 'Unidentified Scroll', statusEffect: 'burn' },
];

export const ACCESSORY_BASE_ITEMS: BaseItem[] = [
  { id: 'iron-ring', type: 'accessory', name: 'Iron Ring' },
  { id: 'jade-amulet', type: 'accessory', name: 'Jade Amulet' },
];

export function getLootTableForFloor(depth: number): LootTableEntry[] {
  return [
    { itemId: null, weight: 50 },
    { itemId: 'short-sword', weight: 10 },
    { itemId: 'long-sword', weight: Math.max(2, 10 - depth) },
    { itemId: 'leather-armor', weight: 10 },
    { itemId: 'chain-armor', weight: Math.max(2, 10 - depth) },
    { itemId: 'health-potion', weight: 15 },
    { itemId: 'scroll-of-fire', weight: 8 },
    { itemId: 'iron-ring', weight: 6 },
    { itemId: 'jade-amulet', weight: Math.max(1, 6 - depth) },
  ];
}

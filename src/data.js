export const TILE_SIZE = 24;
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 34;

export const XP_TABLE = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320];

export const STARTING_CLASSES = {
  adventurer: { id: 'adventurer', name: 'Adventurer', baseHp: 30, str: 5, dex: 5, vit: 5 },
};

export const MONSTER_ARCHETYPES = {
  rusher: {
    id: 'rusher', name: 'Rusher', hp: 12, damage: 4, critChance: 0.05, dodgeChance: 0.05,
    sightRange: 6, ranged: false, range: 1, fleeHpFraction: 0, color: '#b33',
  },
  caster: {
    id: 'caster', name: 'Caster', hp: 8, damage: 5, critChance: 0.1, dodgeChance: 0.1,
    sightRange: 7, ranged: true, range: 5, fleeHpFraction: 0.3, color: '#33b',
  },
  trapper: {
    id: 'trapper', name: 'Trapper', hp: 10, damage: 6, critChance: 0.02, dodgeChance: 0.02,
    sightRange: 4, ranged: false, range: 1, fleeHpFraction: 0, color: '#3b3',
    stationary: true, trapRange: 4, trapDamage: 6,
  },
  boss: {
    id: 'boss', name: 'Void Warden', hp: 60, damage: 9, critChance: 0.15, dodgeChance: 0.05,
    sightRange: 10, ranged: false, range: 1, fleeHpFraction: 0, color: '#a0a',
  },
};

export const BASE_ITEMS = [
  { id: 'short-sword', type: 'weapon', name: 'Short Sword', baseDamage: 4 },
  { id: 'long-sword', type: 'weapon', name: 'Long Sword', baseDamage: 6 },
  { id: 'leather-armor', type: 'armor', name: 'Leather Armor', baseArmor: 2 },
  { id: 'chain-armor', type: 'armor', name: 'Chain Armor', baseArmor: 4 },
  { id: 'health-potion', type: 'potion', name: 'Unidentified Potion', healAmount: 15 },
  { id: 'scroll-of-fire', type: 'scroll', name: 'Unidentified Scroll', statusEffect: 'burn' },
];

export function getLootTableForFloor(depth) {
  return [
    { itemId: null, weight: 50 },
    { itemId: 'short-sword', weight: 10 },
    { itemId: 'long-sword', weight: Math.max(2, 10 - depth) },
    { itemId: 'leather-armor', weight: 10 },
    { itemId: 'chain-armor', weight: Math.max(2, 10 - depth) },
    { itemId: 'health-potion', weight: 15 },
    { itemId: 'scroll-of-fire', weight: 8 },
  ];
}

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
};

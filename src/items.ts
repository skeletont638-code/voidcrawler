import type { RngFn, Affix, BaseItem, Item, LootTableEntry } from './types.js';

export const RARITY = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type Rarity = typeof RARITY[number];

export const RARITY_AFFIX_COUNT: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

interface AffixDef {
  key: string;
  label: string;
  roll: (rng: RngFn, tier: number) => number;
}

const AFFIX_POOL: AffixDef[] = [
  { key: 'damage', label: 'of Force', roll: (rng, tier) => Math.ceil((1 + rng() * 3) * tier) },
  { key: 'critChance', label: 'of Precision', roll: (rng, tier) => +(0.02 + rng() * 0.03 * tier).toFixed(2) },
  { key: 'resistance', label: 'of Warding', roll: (rng, tier) => +(0.05 + rng() * 0.1 * tier).toFixed(2) },
];

export function rollAffixes(rarity: Rarity, rng: RngFn, tierMultiplier = 1): Affix[] {
  const count = RARITY_AFFIX_COUNT[rarity];
  const pool = [...AFFIX_POOL];
  const affixes: Affix[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const pickIndex = Math.floor(rng() * pool.length);
    const def = pool.splice(pickIndex, 1)[0]!;
    affixes.push({ key: def.key, label: def.label, value: def.roll(rng, tierMultiplier) });
  }
  return affixes;
}

export function generateItem(baseItem: BaseItem, rarity: Rarity, rng: RngFn, floorDepth: number): Item {
  const tierMultiplier = 1 + floorDepth * 0.15;
  const identifiable = baseItem.type === 'weapon' || baseItem.type === 'armor';
  return {
    ...baseItem,
    rarity,
    affixes: identifiable ? rollAffixes(rarity, rng, tierMultiplier) : [],
    identified: identifiable,
  };
}

export function rollLootTable(table: LootTableEntry[], rng: RngFn): LootTableEntry {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of table) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return table[table.length - 1]!;
}

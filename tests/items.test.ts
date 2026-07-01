import { describe, it, expect } from 'vitest';
import { rollAffixes, generateItem, rollLootTable, RARITY_AFFIX_COUNT, type Rarity } from '../src/items.js';

function stubRng(values: number[]) {
  const queue = [...values];
  return () => (queue.length ? queue.shift()! : 0.999);
}

describe('rollAffixes', () => {
  it('returns exactly the expected count per rarity, no duplicate keys', () => {
    for (const rarity of Object.keys(RARITY_AFFIX_COUNT) as Rarity[]) {
      const rng = stubRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const affixes = rollAffixes(rarity, rng, 1);
      expect(affixes.length).toBe(RARITY_AFFIX_COUNT[rarity]);
      const keys = affixes.map((a) => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('generateItem', () => {
  it('marks weapons and armor as identified, potions/scrolls as not', () => {
    const rng = stubRng([0.1, 0.2, 0.3]);
    const weapon = generateItem({ id: 'sword', type: 'weapon', name: 'Sword', baseDamage: 5 }, 'common', rng, 1);
    const potion = generateItem({ id: 'potion', type: 'potion', name: 'Potion' }, 'common', rng, 1);
    expect(weapon.identified).toBe(true);
    expect(potion.identified).toBe(false);
  });
});

describe('rollLootTable', () => {
  it('respects weighted boundaries', () => {
    const table = [
      { itemId: 'a', weight: 1 },
      { itemId: 'b', weight: 9 },
    ];
    expect(rollLootTable(table, stubRng([0.05])).itemId).toBe('a');
    expect(rollLootTable(table, stubRng([0.5])).itemId).toBe('b');
  });
});

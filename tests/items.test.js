import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollAffixes, generateItem, rollLootTable, RARITY_AFFIX_COUNT } from '../src/items.js';

function stubRng(values) {
  const queue = [...values];
  return () => (queue.length ? queue.shift() : 0.999);
}

test('rollAffixes returns exactly the expected count per rarity, no duplicate keys', () => {
  for (const rarity of Object.keys(RARITY_AFFIX_COUNT)) {
    const rng = stubRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const affixes = rollAffixes(rarity, rng, 1);
    assert.equal(affixes.length, RARITY_AFFIX_COUNT[rarity]);
    const keys = affixes.map(a => a.key);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('generateItem marks weapons and armor as identified, potions/scrolls as not', () => {
  const rng = stubRng([0.1, 0.2, 0.3]);
  const weapon = generateItem({ id: 'sword', type: 'weapon', name: 'Sword', baseDamage: 5 }, 'common', rng, 1);
  const potion = generateItem({ id: 'potion', type: 'potion', name: 'Potion' }, 'common', rng, 1);
  assert.equal(weapon.identified, true);
  assert.equal(potion.identified, false);
});

test('rollLootTable respects weighted boundaries', () => {
  const table = [
    { itemId: 'a', weight: 1 },
    { itemId: 'b', weight: 9 },
  ];
  const pickLow = rollLootTable(table, stubRng([0.05]));
  const pickHigh = rollLootTable(table, stubRng([0.5]));
  assert.equal(pickLow.itemId, 'a');
  assert.equal(pickHigh.itemId, 'b');
});

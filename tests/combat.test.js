import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttack, tickStatuses } from '../src/combat.js';

function stubRng(values) {
  const queue = [...values];
  return () => (queue.length ? queue.shift() : 0.5);
}

test('attack is dodged when the dodge roll succeeds', () => {
  const result = resolveAttack({ damage: 10, critChance: 0, dodgeChance: 0.5 }, stubRng([0.1]));
  assert.equal(result.hit, false);
  assert.equal(result.damage, 0);
});

test('attack hits and is not a crit when both rolls fail', () => {
  const result = resolveAttack({ damage: 10, critChance: 0.2, dodgeChance: 0.1 }, stubRng([0.9, 0.9, 0.5]));
  assert.equal(result.hit, true);
  assert.equal(result.crit, false);
  assert.ok(result.damage >= 8 && result.damage <= 12, `damage ${result.damage} out of expected variance range`);
});

test('a crit hit deals roughly 1.5x damage', () => {
  const noCrit = resolveAttack({ damage: 10, critChance: 1, dodgeChance: 0 }, stubRng([0.9, 0.0, 0.5]));
  assert.equal(noCrit.crit, true);
  assert.equal(noCrit.damage, Math.round(10 * 1.0 * 1.5));
});

test('tickStatuses sums damage and expires statuses at zero turns remaining', () => {
  const statuses = [
    { damagePerTick: 2, turnsRemaining: 1 },
    { damagePerTick: 3, turnsRemaining: 2 },
  ];
  const { totalDamage, remaining } = tickStatuses(statuses);
  assert.equal(totalDamage, 5);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].turnsRemaining, 1);
});

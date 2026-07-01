import { describe, it, expect } from 'vitest';
import { resolveAttack, tickStatuses } from '../src/combat.js';

function stubRng(values: number[]) {
  const queue = [...values];
  return () => (queue.length ? queue.shift()! : 0.5);
}

describe('resolveAttack', () => {
  it('attack is dodged when the dodge roll succeeds', () => {
    const result = resolveAttack({ damage: 10, critChance: 0, dodgeChance: 0.5 }, stubRng([0.1]));
    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
  });

  it('attack hits and is not a crit when both rolls fail', () => {
    const result = resolveAttack({ damage: 10, critChance: 0.2, dodgeChance: 0.1 }, stubRng([0.9, 0.9, 0.5]));
    expect(result.hit).toBe(true);
    expect(result.crit).toBe(false);
    expect(result.damage).toBeGreaterThanOrEqual(8);
    expect(result.damage).toBeLessThanOrEqual(12);
  });

  it('a crit hit deals roughly 1.5x damage', () => {
    const result = resolveAttack({ damage: 10, critChance: 1, dodgeChance: 0 }, stubRng([0.9, 0.0, 0.5]));
    expect(result.crit).toBe(true);
    expect(result.damage).toBe(Math.round(10 * 1.0 * 1.5));
  });
});

describe('tickStatuses', () => {
  it('sums damage and expires statuses at zero turns remaining', () => {
    const statuses = [
      { damagePerTick: 2, turnsRemaining: 1 },
      { damagePerTick: 3, turnsRemaining: 2 },
    ];
    const { totalDamage, remaining } = tickStatuses(statuses);
    expect(totalDamage).toBe(5);
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.turnsRemaining).toBe(1);
  });
});

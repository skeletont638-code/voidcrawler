import { describe, it, expect } from 'vitest';
import { createRng } from '../src/rng.js';
import { generateFloor, isFullyConnected, TILE } from '../src/dungeon.js';

describe('generateFloor', () => {
  it('every generated floor is fully connected', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const floor = generateFloor(1, createRng(seed), 60, 34);
      expect(isFullyConnected(floor)).toBe(true);
    }
  });

  it('generated floor has at least 2 rooms and a stairs-down tile', () => {
    const floor = generateFloor(3, createRng(99), 60, 34);
    expect(floor.rooms.length).toBeGreaterThanOrEqual(2);
    expect(floor.grid[floor.stairsDown.y * floor.width + floor.stairsDown.x]).toBe(TILE.STAIRS_DOWN);
  });

  it('deeper floors are still connected at larger difficulty', () => {
    const floor = generateFloor(8, createRng(5), 60, 34);
    expect(isFullyConnected(floor)).toBe(true);
  });
});

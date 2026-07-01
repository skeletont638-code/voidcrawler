import { describe, it, expect } from 'vitest';
import { computeFOV } from '../src/fov.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width: number, height: number) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

describe('computeFOV', () => {
  it('open room: origin and nearby tile are visible, far tile beyond radius is not', () => {
    const floor = openFloor(20, 20);
    const visible = computeFOV(floor, 10, 10, 5);
    expect(visible.has('10,10')).toBe(true);
    expect(visible.has('10,13')).toBe(true);
    expect(visible.has('10,16')).toBe(false);
  });

  it('a wall blocks visibility of tiles behind it', () => {
    const floor = openFloor(20, 20);
    floor.grid[idx(12, 10, 20)] = TILE.WALL;
    const visible = computeFOV(floor, 10, 10, 8);
    expect(visible.has('11,10')).toBe(true);
    expect(visible.has('14,10')).toBe(false);
    expect(visible.has('8,10')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { aStar } from '../src/pathfinding.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width: number, height: number) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

describe('aStar', () => {
  it('finds a straight path in an open floor', () => {
    const floor = openFloor(10, 10);
    const path = aStar({ x: 0, y: 0 }, { x: 3, y: 0 }, floor);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4);
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it('routes around an obstacle', () => {
    const floor = openFloor(10, 10);
    for (let y = 0; y < 8; y++) floor.grid[idx(3, y, 10)] = TILE.WALL;
    const path = aStar({ x: 0, y: 0 }, { x: 6, y: 0 }, floor);
    expect(path).not.toBeNull();
    expect(path!.every((p) => floor.grid[idx(p.x, p.y, 10)] !== TILE.WALL)).toBe(true);
  });

  it('returns null when the goal is fully enclosed', () => {
    const floor = openFloor(10, 10);
    for (let x = 3; x <= 5; x++) {
      floor.grid[idx(x, 3, 10)] = TILE.WALL;
      floor.grid[idx(x, 5, 10)] = TILE.WALL;
    }
    for (let y = 3; y <= 5; y++) {
      floor.grid[idx(3, y, 10)] = TILE.WALL;
      floor.grid[idx(5, y, 10)] = TILE.WALL;
    }
    expect(aStar({ x: 0, y: 0 }, { x: 4, y: 4 }, floor)).toBeNull();
  });
});

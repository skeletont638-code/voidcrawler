import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aStar } from '../src/pathfinding.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width, height) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

test('finds a straight path in an open floor', () => {
  const floor = openFloor(10, 10);
  const path = aStar({ x: 0, y: 0 }, { x: 3, y: 0 }, floor);
  assert.ok(path);
  assert.equal(path.length, 4);
  assert.deepEqual(path[0], { x: 0, y: 0 });
  assert.deepEqual(path[path.length - 1], { x: 3, y: 0 });
});

test('routes around an obstacle', () => {
  const floor = openFloor(10, 10);
  for (let y = 0; y < 8; y++) floor.grid[idx(3, y, 10)] = TILE.WALL;
  const path = aStar({ x: 0, y: 0 }, { x: 6, y: 0 }, floor);
  assert.ok(path);
  assert.ok(path.every(p => floor.grid[idx(p.x, p.y, 10)] !== TILE.WALL));
});

test('returns null when the goal is fully enclosed', () => {
  const floor = openFloor(10, 10);
  for (let x = 3; x <= 5; x++) {
    floor.grid[idx(x, 3, 10)] = TILE.WALL;
    floor.grid[idx(x, 5, 10)] = TILE.WALL;
  }
  for (let y = 3; y <= 5; y++) {
    floor.grid[idx(3, y, 10)] = TILE.WALL;
    floor.grid[idx(5, y, 10)] = TILE.WALL;
  }
  const path = aStar({ x: 0, y: 0 }, { x: 4, y: 4 }, floor);
  assert.equal(path, null);
});

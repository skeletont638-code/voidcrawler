import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { generateFloor, isFullyConnected, TILE } from '../src/dungeon.js';

test('every generated floor is fully connected', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const floor = generateFloor(1, createRng(seed), 60, 34);
    assert.ok(isFullyConnected(floor), `seed ${seed} produced a disconnected floor`);
  }
});

test('generated floor has at least 2 rooms and a stairs-down tile', () => {
  const floor = generateFloor(3, createRng(99), 60, 34);
  assert.ok(floor.rooms.length >= 2);
  assert.equal(floor.grid[floor.stairsDown.y * floor.width + floor.stairsDown.x], TILE.STAIRS_DOWN);
});

test('deeper floors are still connected at larger difficulty', () => {
  const floor = generateFloor(8, createRng(5), 60, 34);
  assert.ok(isFullyConnected(floor));
});

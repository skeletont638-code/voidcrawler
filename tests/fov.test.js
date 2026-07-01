import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFOV } from '../src/fov.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width, height) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

test('open room: origin and nearby tile are visible, far tile beyond radius is not', () => {
  const floor = openFloor(20, 20);
  const visible = computeFOV(floor, 10, 10, 5);
  assert.ok(visible.has('10,10'));
  assert.ok(visible.has('10,13'));
  assert.ok(!visible.has('10,16'));
});

test('a wall blocks visibility of tiles behind it', () => {
  const floor = openFloor(20, 20);
  floor.grid[idx(12, 10, 20)] = TILE.WALL;
  const visible = computeFOV(floor, 10, 10, 8);
  assert.ok(visible.has('11,10'), 'tile before the wall should be visible');
  assert.ok(!visible.has('14,10'), 'tile behind the wall should be blocked');
  assert.ok(visible.has('8,10'), 'tile on the opposite, unobstructed side should be visible');
});

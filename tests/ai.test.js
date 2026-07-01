import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideMonsterAction } from '../src/ai.js';
import { Monster, Player } from '../src/entities.js';
import { MONSTER_ARCHETYPES, STARTING_CLASSES } from '../src/data.js';
import { TILE } from '../src/dungeon.js';

function openFloor(width, height) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}
const alwaysSee = () => true;
const neverSee = () => false;

test('idle monster stays idle when it cannot see the player', () => {
  const floor = openFloor(10, 10);
  const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
  const player = new Player(STARTING_CLASSES.adventurer);
  player.x = 8; player.y = 8;
  decideMonsterAction(monster, player, floor, neverSee);
  assert.equal(monster.state, 'idle');
});

test('idle monster becomes aggro and chases when it sees the player', () => {
  const floor = openFloor(10, 10);
  const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
  const player = new Player(STARTING_CLASSES.adventurer);
  player.x = 5; player.y = 8;
  const action = decideMonsterAction(monster, player, floor, alwaysSee);
  assert.equal(monster.state, 'chase');
  assert.equal(action.type, 'move');
});

test('monster attacks when adjacent to the player', () => {
  const floor = openFloor(10, 10);
  const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
  const player = new Player(STARTING_CLASSES.adventurer);
  player.x = 6; player.y = 5;
  const action = decideMonsterAction(monster, player, floor, alwaysSee);
  assert.equal(action.type, 'attack');
  assert.equal(action.target, player);
});

test('a monster with a flee threshold flees below that hp fraction', () => {
  const floor = openFloor(10, 10);
  const monster = new Monster(MONSTER_ARCHETYPES.caster, 5, 5);
  monster.hp = monster.maxHp * 0.1;
  const player = new Player(STARTING_CLASSES.adventurer);
  player.x = 6; player.y = 5;
  decideMonsterAction(monster, player, floor, alwaysSee);
  assert.equal(monster.state, 'flee');
});

test('a stationary archetype never moves — it places a trap toward a distant player', () => {
  const floor = openFloor(10, 10);
  const monster = new Monster(MONSTER_ARCHETYPES.trapper, 5, 5);
  const player = new Player(STARTING_CLASSES.adventurer);
  player.x = 5; player.y = 8;
  const action = decideMonsterAction(monster, player, floor, alwaysSee);
  assert.equal(action.type, 'placeTrap');
  assert.equal(monster.x, 5, 'a stationary monster must never have its own position changed by the AI');
  assert.equal(monster.y, 5);
  assert.deepEqual(action.at, { x: 5, y: 6 });
});

test('a stationary archetype attacks instead of placing a trap when the player is adjacent', () => {
  const floor = openFloor(10, 10);
  const monster = new Monster(MONSTER_ARCHETYPES.trapper, 5, 5);
  const player = new Player(STARTING_CLASSES.adventurer);
  player.x = 6; player.y = 5;
  const action = decideMonsterAction(monster, player, floor, alwaysSee);
  assert.equal(action.type, 'attack');
});

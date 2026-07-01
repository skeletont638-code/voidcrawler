import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, Monster, xpForNextLevel } from '../src/entities.js';
import { STARTING_CLASSES, MONSTER_ARCHETYPES } from '../src/data.js';

test('gaining enough xp levels up exactly once and grants a stat point', () => {
  const player = new Player(STARTING_CLASSES.adventurer);
  const needed = xpForNextLevel(1);
  const leveled = player.gainXp(needed);
  assert.equal(leveled, true);
  assert.equal(player.level, 2);
  assert.equal(player.statPoints, 1);
  assert.equal(player.hp, player.maxHp);
});

test('gaining a huge amount of xp can level up multiple times in one call', () => {
  const player = new Player(STARTING_CLASSES.adventurer);
  const bigAmount = xpForNextLevel(1) + xpForNextLevel(2) + 5;
  player.gainXp(bigAmount);
  assert.equal(player.level, 3);
  assert.equal(player.statPoints, 2);
});

test('gaining too little xp does not level up', () => {
  const player = new Player(STARTING_CLASSES.adventurer);
  const leveled = player.gainXp(1);
  assert.equal(leveled, false);
  assert.equal(player.level, 1);
});

test('monster starts at full hp from its archetype', () => {
  const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
  assert.equal(monster.hp, MONSTER_ARCHETYPES.rusher.hp);
  assert.equal(monster.state, 'idle');
});

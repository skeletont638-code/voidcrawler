import { describe, it, expect } from 'vitest';
import { Player, Monster, xpForNextLevel } from '../src/entities.js';
import { STARTING_CLASSES, MONSTER_ARCHETYPES } from '../src/data.js';

describe('Player.gainXp', () => {
  it('gaining enough xp levels up exactly once and grants a stat point', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const needed = xpForNextLevel(1);
    expect(player.gainXp(needed)).toBe(true);
    expect(player.level).toBe(2);
    expect(player.statPoints).toBe(1);
    expect(player.hp).toBe(player.maxHp);
  });

  it('gaining a huge amount of xp can level up multiple times in one call', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.gainXp(xpForNextLevel(1) + xpForNextLevel(2) + 5);
    expect(player.level).toBe(3);
    expect(player.statPoints).toBe(2);
  });

  it('gaining too little xp does not level up', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    expect(player.gainXp(1)).toBe(false);
    expect(player.level).toBe(1);
  });
});

describe('Monster', () => {
  it('starts at full hp from its archetype', () => {
    const monster = new Monster(MONSTER_ARCHETYPES.rusher!, 5, 5);
    expect(monster.hp).toBe(MONSTER_ARCHETYPES.rusher!.hp);
    expect(monster.state).toBe('idle');
  });
});

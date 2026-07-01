import { describe, it, expect } from 'vitest';
import { Player, Monster, xpForNextLevel } from '../src/entities.js';
import { STARTING_CLASSES, MONSTER_ARCHETYPES, PERK_POOL } from '../src/data.js';

describe('Player.gainXp', () => {
  it('gaining enough xp levels up exactly once and offers a perk choice at level 2', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const needed = xpForNextLevel(1);
    const { leveled, perkChoices } = player.gainXp(needed);
    expect(leveled).toBe(true);
    expect(player.level).toBe(2);
    expect(perkChoices.length).toBe(3);
    expect(player.hp).toBe(player.maxHp);
  });

  it('gaining a huge amount of xp can level up multiple times in one call, still surfacing a perk offer crossed along the way', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const { perkChoices } = player.gainXp(xpForNextLevel(1) + xpForNextLevel(2) + 5);
    expect(player.level).toBe(3);
    // this jump passes through level 2 (an offer level) on the way to level 3 (not an offer level) —
    // the offer from level 2 is still returned rather than silently dropped
    expect(perkChoices.length).toBe(3);
  });

  it('gaining too little xp does not level up', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const { leveled } = player.gainXp(1);
    expect(leveled).toBe(false);
    expect(player.level).toBe(1);
  });
});

describe('perk offers', () => {
  it('gainXp returns a list of 3 perk choices every 2 levels, empty otherwise', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const { perkChoices: firstLevelChoices } = player.gainXp(xpForNextLevel(1));
    expect(player.level).toBe(2);
    expect(firstLevelChoices.length).toBe(3);
    const uniqueIds = new Set(firstLevelChoices.map(p => p.id));
    expect(uniqueIds.size).toBe(3);
    for (const perk of firstLevelChoices) {
      expect(PERK_POOL.some(p => p.id === perk.id)).toBe(true);
    }

    const { perkChoices: secondLevelChoices } = player.gainXp(xpForNextLevel(2));
    expect(player.level).toBe(3);
    expect(secondLevelChoices.length).toBe(0);
  });

  it('applying a perk mutates the player as described', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const lifesteal = PERK_POOL.find(p => p.id === 'lifesteal')!;
    lifesteal.apply(player);
    expect(player.perks).toContain('lifesteal');

    const vitality = PERK_POOL.find(p => p.id === 'vitality')!;
    const before = player.maxHp;
    vitality.apply(player);
    expect(player.maxHp).toBeGreaterThan(before);
  });
});

describe('Monster', () => {
  it('starts at full hp from its archetype', () => {
    const monster = new Monster(MONSTER_ARCHETYPES.rusher!, 5, 5);
    expect(monster.hp).toBe(MONSTER_ARCHETYPES.rusher!.hp);
    expect(monster.state).toBe('idle');
  });
});

import { describe, it, expect } from 'vitest';
import { decideMonsterAction } from '../src/ai.js';
import { Monster, Player } from '../src/entities.js';
import { MONSTER_ARCHETYPES, STARTING_CLASSES } from '../src/data.js';
import { TILE } from '../src/dungeon.js';

function openFloor(width: number, height: number) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}
const alwaysSee = () => true;
const neverSee = () => false;

describe('decideMonsterAction', () => {
  it('idle monster stays idle when it cannot see the player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.rusher!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 8; player.y = 8;
    decideMonsterAction(monster, player, floor, neverSee);
    expect(monster.state).toBe('idle');
  });

  it('idle monster becomes aggro and chases when it sees the player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.rusher!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 5; player.y = 8;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(monster.state).toBe('chase');
    expect(action.type).toBe('move');
  });

  it('monster attacks when adjacent to the player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.rusher!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 6; player.y = 5;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(action.type).toBe('attack');
    expect(action.target).toBe(player);
  });

  it('a monster with a flee threshold flees below that hp fraction', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.caster!, 5, 5);
    monster.hp = monster.maxHp * 0.1;
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 6; player.y = 5;
    decideMonsterAction(monster, player, floor, alwaysSee);
    expect(monster.state).toBe('flee');
  });

  it('a stationary archetype never moves — it places a trap toward a distant player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.trapper!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 5; player.y = 8;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(action.type).toBe('placeTrap');
    expect(monster.x).toBe(5);
    expect(monster.y).toBe(5);
    expect(action.at).toEqual({ x: 5, y: 6 });
  });

  it('a stationary archetype attacks instead of placing a trap when the player is adjacent', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.trapper!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 6; player.y = 5;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(action.type).toBe('attack');
  });
});

import { aStar } from './pathfinding.js';
import type { TileGrid, MonsterAction } from './types.js';
import type { Monster, Player } from './entities.js';

function chebyshev(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function stepAwayFrom(monster: Monster, player: Player): { x: number; y: number } {
  const dx = Math.sign(monster.x - player.x) || (Math.random() < 0.5 ? 1 : -1);
  const dy = Math.sign(monster.y - player.y) || (Math.random() < 0.5 ? 1 : -1);
  return { x: monster.x + dx, y: monster.y + dy };
}

function findHealTarget(monster: Monster, allies: Monster[]): Monster | null {
  const HEAL_RANGE = 5;
  let best: Monster | null = null;
  let bestDist = Infinity;
  for (const ally of allies) {
    if (ally.hp >= ally.maxHp) continue;
    const dist = chebyshev(monster.x, monster.y, ally.x, ally.y);
    if (dist > HEAL_RANGE) continue;
    if (dist < bestDist) { bestDist = dist; best = ally; }
  }
  return best;
}

export type CanSeeFn = (mx: number, my: number, px: number, py: number) => boolean;

export function decideMonsterAction(
  monster: Monster, player: Player, floor: TileGrid, canSee: CanSeeFn, allies: Monster[],
): MonsterAction {
  if (monster.archetype.turnsPerAction && monster.archetype.turnsPerAction > 1) {
    monster.turnCounter += 1;
    if (monster.turnCounter % monster.archetype.turnsPerAction !== 0) {
      return { type: 'wait' };
    }
  }

  const dist = chebyshev(monster.x, monster.y, player.x, player.y);
  const sees = canSee(monster.x, monster.y, player.x, player.y);

  if (monster.archetype.fleeHpFraction > 0 && monster.hp / monster.maxHp <= monster.archetype.fleeHpFraction) {
    monster.state = 'flee';
  } else if (monster.state === 'idle') {
    if (sees && dist <= monster.archetype.sightRange) {
      monster.state = 'aggro';
    }
  }

  if (monster.archetype.stationary) {
    if (monster.state === 'idle') return { type: 'wait' };
    if (dist <= 1) {
      monster.state = 'attack';
      return { type: 'attack', target: player };
    }
    monster.state = 'aggro';
    if (dist <= (monster.archetype.trapRange ?? 0)) {
      const path = aStar({ x: monster.x, y: monster.y }, { x: player.x, y: player.y }, floor);
      if (path && path.length > 1) {
        return { type: 'placeTrap', at: path[1] };
      }
    }
    return { type: 'wait' };
  }

  if (monster.archetype.support && monster.state !== 'idle') {
    const healTarget = findHealTarget(monster, allies);
    if (healTarget) {
      return { type: 'heal', healTarget };
    }
  }

  if (monster.state === 'aggro' || monster.state === 'chase' || monster.state === 'attack') {
    if (sees) monster.lastKnownPlayerPos = { x: player.x, y: player.y };

    if (dist <= 1) {
      monster.state = 'attack';
      return { type: 'attack', target: player };
    }

    monster.state = 'chase';
    if (monster.archetype.ranged && sees && dist <= monster.archetype.range) {
      return { type: 'rangedAttack', target: player };
    }
    if (monster.lastKnownPlayerPos) {
      const path = aStar({ x: monster.x, y: monster.y }, monster.lastKnownPlayerPos, floor);
      if (path && path.length > 1) {
        return { type: 'move', to: path[1] };
      }
    }
    return { type: 'wait' };
  }

  if (monster.state === 'flee') {
    return { type: 'move', to: stepAwayFrom(monster, player) };
  }

  return { type: 'wait' };
}

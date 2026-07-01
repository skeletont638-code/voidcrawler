# Voidcrawler V2 Phase B: Content Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Voidcrawler from 3 monster archetypes/1 boss/1 class to 7 archetypes/3 bosses/3 classes across a 3-biome floor structure, add a perk-choice leveling system, and add an accessory equipment slot — all on top of the TypeScript codebase from Phase A.

**Architecture:** Extend `types.ts`/`data.ts` with the new content tables first (pure data, no behavior), then extend `ai.ts` with the new archetype behaviors (turn-skipping, invisibility, ally-support), then restructure `main.ts`'s floor/spawn logic around biomes, then add the perk-choice and accessory systems as their own self-contained pieces.

**Tech Stack:** Same as Phase A (TypeScript strict, Vite, Vitest) — no new tooling.

## Global Constraints

- Zero regression in existing v1 systems (combat, itemization, traps, save/death/victory) — only additive changes plus the documented biome/boss restructuring.
- `npx tsc --noEmit` must stay at zero errors after every task; `npx vitest run` must stay green.
- No new runtime dependencies — everything here is game logic, no new npm packages.
- Class/perk *selection UI* (title screen, in-run choice overlay) is explicitly Phase C's job — this phase implements the underlying data/logic (`purchaseClass`, `offerPerks`, `applyPerk`) that Phase C's UI will call, verified here via unit tests and a temporary keyboard-driven stand-in (documented per-task) rather than final UI.

---

### Task 1: New content data — archetypes, biomes, classes, perks, accessory items

**Files:**
- Modify: `src/types.ts`
- Modify: `src/data.ts`

**Interfaces:**
- Produces (`src/types.ts` additions): `MonsterArchetype` gains `turnsPerAction?: number`, `invisible?: boolean`, `support?: boolean`, `packSize?: number`; new `Biome { id: string; name: string; floors: [number, number, number]; wallColor: string; floorColor: string; stairsColor: string; archetypeWeights: Record<string, number>; bossArchetypeId: string }`; new `Perk { id: string; label: string; apply: (player: import('./entities.js').Player) => void }`.
- Produces (`src/data.ts` additions): `MONSTER_ARCHETYPES` gains `brute`, `swarmling`, `shaman`, `stalker`; `BIOMES: Biome[]` (3 entries); `STARTING_CLASSES` gains `berserker`, `rogue` (each with an `unlockCost: number` field — add `unlockCost` to `StartingClass` too, `0` for `adventurer`); `PERK_POOL: Perk[]`; `ACCESSORY_BASE_ITEMS: BaseItem[]` (2 rings/amulets). Consumed by Tasks 2–6.

- [ ] **Step 1: Extend `MonsterArchetype`, add `Biome`/`Perk`, extend `StartingClass` in `src/types.ts`**

```typescript
// in src/types.ts, replace the existing MonsterArchetype interface with:
export interface MonsterArchetype {
  id: string;
  name: string;
  hp: number;
  damage: number;
  critChance: number;
  dodgeChance: number;
  sightRange: number;
  ranged: boolean;
  range: number;
  fleeHpFraction: number;
  color: string;
  stationary?: boolean;
  trapRange?: number;
  trapDamage?: number;
  turnsPerAction?: number;
  invisible?: boolean;
  support?: boolean;
  packSize?: number;
}

// replace the existing StartingClass interface with:
export interface StartingClass {
  id: string;
  name: string;
  baseHp: number;
  str: number;
  dex: number;
  vit: number;
  unlockCost: number;
}

// append to src/types.ts:
export interface Biome {
  id: string;
  name: string;
  floors: [number, number, number];
  wallColor: string;
  floorColor: string;
  stairsColor: string;
  archetypeWeights: Record<string, number>;
  bossArchetypeId: string;
}

export interface Perk {
  id: string;
  label: string;
  apply: (player: import('./entities.js').Player) => void;
}
```

- [ ] **Step 2: Add the 4 new archetypes, 3 biomes, 2 new classes, perk pool, and accessory items to `src/data.ts`**

```typescript
// in src/data.ts, add unlockCost: 0 to the existing adventurer entry:
export const STARTING_CLASSES: Record<string, StartingClass> = {
  adventurer: { id: 'adventurer', name: 'Adventurer', baseHp: 30, str: 5, dex: 5, vit: 5, unlockCost: 0 },
  berserker: { id: 'berserker', name: 'Berserker', baseHp: 26, str: 8, dex: 3, vit: 5, unlockCost: 100 },
  rogue: { id: 'rogue', name: 'Rogue', baseHp: 22, str: 4, dex: 9, vit: 4, unlockCost: 150 },
};

// in src/data.ts, add to MONSTER_ARCHETYPES (alongside rusher/caster/trapper/boss):
brute: {
  id: 'brute', name: 'Brute', hp: 20, damage: 8, critChance: 0.02, dodgeChance: 0,
  sightRange: 5, ranged: false, range: 1, fleeHpFraction: 0, color: '#732',
  turnsPerAction: 2,
},
swarmling: {
  id: 'swarmling', name: 'Swarmling', hp: 4, damage: 2, critChance: 0.05, dodgeChance: 0.1,
  sightRange: 8, ranged: false, range: 1, fleeHpFraction: 0, color: '#dd6',
  packSize: 3,
},
shaman: {
  id: 'shaman', name: 'Shaman', hp: 9, damage: 3, critChance: 0.05, dodgeChance: 0.1,
  sightRange: 6, ranged: false, range: 1, fleeHpFraction: 0.5, color: '#6dd',
  support: true,
},
stalker: {
  id: 'stalker', name: 'Stalker', hp: 11, damage: 7, critChance: 0.2, dodgeChance: 0.08,
  sightRange: 6, ranged: false, range: 1, fleeHpFraction: 0, color: '#616',
  invisible: true,
},

// append to src/data.ts:
export const BIOMES: Biome[] = [
  {
    id: 'catacombs', name: 'Catacombs', floors: [1, 2, 3],
    wallColor: '#241c1c', floorColor: '#3a2e2e', stairsColor: '#4a3a20',
    archetypeWeights: { rusher: 4, caster: 3, trapper: 2, swarmling: 2 },
    bossArchetypeId: 'boss',
  },
  {
    id: 'caverns', name: 'Fungal Caverns', floors: [4, 5, 6],
    wallColor: '#1c2418', floorColor: '#2e3a2a', stairsColor: '#3a4a20',
    archetypeWeights: { rusher: 2, caster: 2, brute: 3, swarmling: 4, shaman: 2 },
    bossArchetypeId: 'caverns-boss',
  },
  {
    id: 'depths', name: 'Void Depths', floors: [7, 8, 9],
    wallColor: '#1c1c26', floorColor: '#26263a', stairsColor: '#3a2e4a',
    archetypeWeights: { brute: 2, shaman: 2, stalker: 4, trapper: 2 },
    bossArchetypeId: 'depths-boss',
  },
];

// append 2 more bosses (one per non-catacombs biome — 'boss'/Void Warden from v1 remains the catacombs boss):
MONSTER_ARCHETYPES['caverns-boss'] = {
  id: 'caverns-boss', name: 'Spore Matriarch', hp: 70, damage: 7, critChance: 0.1, dodgeChance: 0.05,
  sightRange: 9, ranged: false, range: 1, fleeHpFraction: 0, color: '#6a2',
  support: true,
};
MONSTER_ARCHETYPES['depths-boss'] = {
  id: 'depths-boss', name: 'The Unseen', hp: 90, damage: 11, critChance: 0.2, dodgeChance: 0.1,
  sightRange: 12, ranged: false, range: 1, fleeHpFraction: 0, color: '#818',
  invisible: true,
};

// append to src/data.ts:
export const PERK_POOL: Perk[] = [
  { id: 'vitality', label: '+15% max HP', apply: (p) => { const bonus = Math.round(p.maxHp * 0.15); p.maxHp += bonus; p.hp += bonus; } },
  { id: 'precision', label: '+8% crit chance', apply: (p) => { p.dex += 8; } },
  { id: 'evasion', label: '+10% dodge chance', apply: (p) => { p.dex += 6; p.vit += 2; } },
  { id: 'lifesteal', label: 'Heal 20% of crit damage dealt', apply: (p) => { p.perks.push('lifesteal'); } },
  { id: 'resilience', label: '+2 trap/status damage resistance', apply: (p) => { p.perks.push('resilience'); } },
];

// append to src/data.ts:
export const ACCESSORY_BASE_ITEMS: BaseItem[] = [
  { id: 'iron-ring', type: 'accessory', name: 'Iron Ring' },
  { id: 'jade-amulet', type: 'accessory', name: 'Jade Amulet' },
];
```

Note: `Perk.apply` pushes onto a new `player.perks: string[]` array for perks that need to affect *other* systems (lifesteal — read wherever combat resolves player-dealt crit damage, a follow-up beyond this plan's scope; resilience — read where trap/status damage is applied, likewise a follow-up) rather than a direct stat change. This field is added to `Player` in Step 2c below, in this same task. `BaseItem.type` needs `'accessory'` added to its union — done in Step 2b below, also in this task, since `ACCESSORY_BASE_ITEMS` needs it to typecheck immediately (the accessory *equipment slot* itself still lands in Task 5 — this task only needs the item-type union widened).

- [ ] **Step 2b: Add `'accessory'` to `BaseItem.type` now to keep this task self-contained**

Rather than leave a dangling forward-reference for two tasks, extend the union immediately:

```typescript
// in src/types.ts, BaseItem interface — change:
  type: 'weapon' | 'armor' | 'potion' | 'scroll';
// to:
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'accessory';
```

(The `equipment.accessory` slot and the equip-handling code that uses this new item type still land in Task 5 — this step only widens the type so `ACCESSORY_BASE_ITEMS` typechecks now.)

- [ ] **Step 2c: Add the `perks` field to `Player` now, since `PERK_POOL`'s `lifesteal`/`resilience` entries reference it**

```typescript
// in src/entities.ts, add to the Player class body (alongside the other fields):
  perks: string[] = [];
```

This is the only place `perks` is declared — Task 4 (perk-choice leveling) and Task 5 (accessory affixes reading `resilience`) both read/push to this existing field; neither task re-declares it.

- [ ] **Step 3: Typecheck and run tests**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors. All 32 existing tests still pass (no behavior touched yet — this task only adds data).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/data.ts src/entities.ts
git commit -m "Add V2 content data: archetypes, biomes, classes, perks, accessory items"
```

---

### Task 2: New archetype behaviors — brute turn-skipping, stalker invisibility, shaman support

**Files:**
- Modify: `src/entities.ts`
- Modify: `src/ai.ts`
- Modify: `src/types.ts`
- Modify: `src/main.ts`
- Test: `tests/ai.test.ts`

**Interfaces:**
- Consumes: `brute`/`shaman`/`stalker` archetypes from Task 1.
- Produces: `Monster` gains `turnCounter: number` (starts at 0); `MonsterActionType` gains `'heal'`; `MonsterAction` gains an optional `healTarget?: Monster`; `decideMonsterAction`'s signature becomes `decideMonsterAction(monster, player, floor, canSee, allies: Monster[])` — `allies` is every other living monster on the floor, used by `support` archetypes to find a damaged ally to heal. Consumed by `main.ts`'s `monsterTurn` (updated call site + new `'heal'` action handling) and the render loop (skip drawing `invisible` monsters unless adjacent to the player).

- [ ] **Step 1: Add `turnCounter` to `Monster` in `src/entities.ts`**

```typescript
// in src/entities.ts, add to the Monster class body (alongside the existing fields):
  turnCounter = 0;
```

- [ ] **Step 2: Extend `MonsterActionType`/`MonsterAction` in `src/types.ts`**

```typescript
// in src/types.ts, change:
export type MonsterActionType = 'move' | 'attack' | 'rangedAttack' | 'placeTrap' | 'wait';
// to:
export type MonsterActionType = 'move' | 'attack' | 'rangedAttack' | 'placeTrap' | 'heal' | 'wait';

// and change MonsterAction to:
export interface MonsterAction {
  type: MonsterActionType;
  to?: { x: number; y: number };
  target?: Player;
  at?: { x: number; y: number };
  healTarget?: import('./entities.js').Monster;
}
```

- [ ] **Step 3: Write the failing tests for the three new behaviors**

```typescript
// append to tests/ai.test.ts
import { Monster as MonsterClass } from '../src/entities.js'; // already imported as Monster; this line documents intent, no separate import needed — see note below

describe('brute turn-skipping', () => {
  it('a brute only acts on every turnsPerAction-th call — otherwise it waits without moving', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.brute!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 5; player.y = 8;
    const first = decideMonsterAction(monster, player, floor, alwaysSee, []);
    expect(first.type).toBe('wait');
    const second = decideMonsterAction(monster, player, floor, alwaysSee, []);
    expect(second.type).toBe('move');
  });
});

describe('stalker invisibility flag', () => {
  it('the archetype carries invisible: true for renderers to check — AI behavior itself is unaffected', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.stalker!, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 5; player.y = 8;
    expect(monster.archetype.invisible).toBe(true);
    const action = decideMonsterAction(monster, player, floor, alwaysSee, []);
    expect(action.type).toBe('move');
  });
});

describe('shaman support behavior', () => {
  it('heals the nearest damaged ally instead of moving toward the player when one is in range', () => {
    const floor = openFloor(10, 10);
    const shaman = new Monster(MONSTER_ARCHETYPES.shaman!, 5, 5);
    const ally = new Monster(MONSTER_ARCHETYPES.rusher!, 6, 5);
    ally.hp = 1;
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 5; player.y = 9;
    const action = decideMonsterAction(shaman, player, floor, alwaysSee, [ally]);
    expect(action.type).toBe('heal');
    expect(action.healTarget).toBe(ally);
  });

  it('chases the player normally when no ally needs healing', () => {
    const floor = openFloor(10, 10);
    const shaman = new Monster(MONSTER_ARCHETYPES.shaman!, 5, 5);
    const healthyAlly = new Monster(MONSTER_ARCHETYPES.rusher!, 6, 5);
    const player = new Player(STARTING_CLASSES.adventurer!);
    player.x = 5; player.y = 8;
    const action = decideMonsterAction(shaman, player, floor, alwaysSee, [healthyAlly]);
    expect(action.type).toBe('move');
  });
});
```

Remove the stray `import { Monster as MonsterClass } ...` line shown above — it was illustrative only; `Monster` is already imported at the top of `tests/ai.test.ts` and every existing call to `decideMonsterAction` in that file needs a 5th argument now too. Update every existing call site in `tests/ai.test.ts` from `decideMonsterAction(monster, player, floor, alwaysSee)` / `decideMonsterAction(monster, player, floor, neverSee)` to append `, []` as the 5th argument (empty allies array — none of the pre-existing tests involve a `support` archetype, so an empty list is correct and behavior-preserving for them).

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd ~/voidcrawler && npx vitest run tests/ai.test.ts`
Expected: FAIL — `decideMonsterAction` doesn't yet accept a 5th `allies` parameter, and doesn't implement turn-skipping/heal behavior.

- [ ] **Step 5: Implement the behaviors in `src/ai.ts`**

```typescript
// src/ai.ts — full replacement
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run tests/ai.test.ts`
Expected: zero type errors; all ai.test.ts tests (existing 6 + 4 new) pass.

- [ ] **Step 7: Update `src/main.ts`'s call site and add `'heal'` handling**

```typescript
// in src/main.ts, monsterTurn(): change the decideMonsterAction call from
//   const action = decideMonsterAction(monster, player, floor, canSeeBetween);
// to (allies = every other living monster):
const action = decideMonsterAction(monster, player, floor, canSeeBetween, monsters.filter(m => m !== monster));

// add a new branch alongside the existing action.type checks (after the 'placeTrap' branch):
} else if (action.type === 'heal') {
  const target = action.healTarget!;
  const healAmount = Math.round(target.maxHp * 0.25);
  target.hp = Math.min(target.maxHp, target.hp + healAmount);
  log(`The ${monster.archetype.name} heals the ${target.archetype.name} for ${healAmount}.`);
  fxState.floatingTexts.push(createFloatingText(target.x * TILE_SIZE, target.y * TILE_SIZE, `+${healAmount}`, '#6adf6a'));
}
```

- [ ] **Step 8: Add invisible-monster rendering skip in `src/main.ts`'s `render()`**

```typescript
// in src/main.ts, render(), inside the `for (const m of monsters)` loop, change:
//   const key = `${m.x},${m.y}`;
//   if (!visible.has(key)) continue;
// to:
const key = `${m.x},${m.y}`;
if (!visible.has(key)) continue;
if (m.archetype.invisible && chebyshevDistance(m.x, m.y, player.x, player.y) > 1) continue;
```

Add a small local helper near the top of `src/main.ts` (module scope, alongside other helper functions) since `main.ts` doesn't currently have a Chebyshev-distance helper of its own:

```typescript
function chebyshevDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
```

- [ ] **Step 9: Typecheck and run full suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, all tests pass (32 existing + 4 new AI tests = 36).

- [ ] **Step 10: Commit**

```bash
git add src/entities.ts src/ai.ts src/types.ts src/main.ts tests/ai.test.ts
git commit -m "Add brute turn-skipping, stalker invisibility, shaman support behaviors"
```

---

### Task 3: Biome-restructured floor generation, swarmling packs, per-biome bosses

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `BIOMES` from `src/data.ts` (Task 1).
- Produces: `startFloor(depth)` now looks up the current biome from `BIOMES` by depth, spawns monsters weighted per that biome's `archetypeWeights` (with `swarmling` spawning `packSize` instances clustered in one room instead of 1), and spawns that biome's specific boss archetype on the biome's 3rd floor (`floors[2]`) instead of only ever on floor 9. Tile rendering colors switch per-biome. Consumed by nothing further — this is the top of the spawn/render pipeline.

- [ ] **Step 1: Add a biome lookup helper and rewrite `startFloor` in `src/main.ts`**

```typescript
// add near the top of src/main.ts, after the existing imports:
import { BIOMES } from './data.js';
import type { Biome } from './types.js';

function biomeForDepth(depth: number): Biome {
  return BIOMES.find(b => b.floors.includes(depth)) ?? BIOMES[BIOMES.length - 1]!;
}

function weightedArchetypePick(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [id, weight] of entries) {
    if (roll < weight) return id;
    roll -= weight;
  }
  return entries[entries.length - 1]![0];
}
```

- [ ] **Step 2: Replace `startFloor`'s monster-spawning block**

```typescript
// in src/main.ts, replace the existing startFloor function body's monster-spawn section
// (everything from `if (depth === 9) {` through the closing `}` of that if/else) with:

const biome = biomeForDepth(depth);
const isBossFloor = depth === biome.floors[2];

if (isBossFloor) {
  const bossRoom = floor.rooms[floor.rooms.length - 1]!;
  const c = bossRoom.center();
  monsters = [new Monster(MONSTER_ARCHETYPES[biome.bossArchetypeId]!, c.x, c.y)];
} else {
  monsters = [];
  for (const room of floor.rooms.slice(1)) {
    const c = room.center();
    const archetypeId = weightedArchetypePick(biome.archetypeWeights);
    const archetype = MONSTER_ARCHETYPES[archetypeId]!;
    if (archetype.packSize) {
      for (let i = 0; i < archetype.packSize; i++) {
        const offsetX = c.x + (i % 2 === 0 ? Math.floor(i / 2) : -Math.floor((i + 1) / 2));
        const offsetY = c.y;
        const spawnX = isWalkableForSpawn(floor, offsetX, offsetY) ? offsetX : c.x;
        const spawnY = isWalkableForSpawn(floor, offsetX, offsetY) ? offsetY : c.y;
        monsters.push(new Monster(archetype, spawnX, spawnY));
      }
    } else {
      monsters.push(new Monster(archetype, c.x, c.y));
    }
  }
}
```

Delete the old hardcoded `const archetypeIds = ['rusher', 'caster', 'trapper']; monsters = floor.rooms.slice(1).map(...)` block entirely — this replaces it.

- [ ] **Step 3: Add the `isWalkableForSpawn` helper used above**

```typescript
// add near isWalkable() in src/main.ts:
function isWalkableForSpawn(f: Floor, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= f.width || y >= f.height) return false;
  return f.grid[idx(x, y, f.width)] !== TILE.WALL;
}
```

(This duplicates `isWalkable`'s logic but takes an explicit `Floor` parameter rather than closing over the module-level `floor` variable, since it's called from inside `startFloor` *while* `floor` is being assigned — using the module-level `isWalkable` there would read the *not-yet-fully-initialized* `floor` in a way that's technically fine since `floor = generateFloor(...)` already ran by that point, but the explicit-parameter version is clearer about what it depends on and avoids any doubt.)

- [ ] **Step 4: Update `startFloor`'s multi-floor stairs guard and boss-victory check for the new structure**

```typescript
// in src/main.ts, tryMovePlayer(): change
//   if (tile === TILE.STAIRS_DOWN && gameState === 'playing' && floor.depth < 9) {
// to:
if (tile === TILE.STAIRS_DOWN && gameState === 'playing' && floor.depth < 9) {
  log(`You descend to floor ${floor.depth + 1}.`);
  startFloor(floor.depth + 1);
}
```

(Unchanged — floors still run 1 through 9 linearly; only *which monsters spawn and which floor holds the boss* changed, not the depth-descent mechanic itself. This step is a no-op confirmation, not an edit — skip if the code already reads exactly this.)

```typescript
// in src/main.ts, playerAttack(): change
//   if (target.archetype.id === 'boss') {
//     endRun('victory');
//   }
// to:
if (target.archetype.id === biomeForDepth(floor.depth).bossArchetypeId && floor.depth === 9) {
  endRun('victory');
}
```

(Victory still requires defeating floor 9's boss specifically — `depths-boss`/"The Unseen" — defeating the catacombs or caverns biome bosses on floors 3/6 ends *that biome*, not the run; the check now looks up the current floor's expected boss id rather than hardcoding `'boss'`.)

- [ ] **Step 5: Apply per-biome tile colors in `render()`**

```typescript
// in src/main.ts, replace the module-level TILE_COLORS constant and its usage.
// Delete:
//   const TILE_COLORS: Record<number, string> = {
//     [TILE.WALL]: '#1c1c26',
//     [TILE.FLOOR]: '#2e2e3a',
//     [TILE.STAIRS_DOWN]: '#4a3a20',
//   };
// Replace with a function call inside render(), right before the tile-drawing loop:
const biome = biomeForDepth(floor.depth);
const tileColors: Record<number, string> = {
  [TILE.WALL]: biome.wallColor,
  [TILE.FLOOR]: biome.floorColor,
  [TILE.STAIRS_DOWN]: biome.stairsColor,
};
// then change `ctx.fillStyle = TILE_COLORS[tile]!;` to `ctx.fillStyle = tileColors[tile]!;` in the same loop.
```

- [ ] **Step 6: Typecheck and run full suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, 36/36 tests pass (this task changes only `main.ts`, which has no dedicated unit tests — its correctness is verified live in-browser next).

- [ ] **Step 7: Manually verify in browser**

Run: `cd ~/voidcrawler && npx vite --port 8766 &` (if not already running)
Open `http://localhost:8766/`, refresh.
Expected: floor 1 uses the Catacombs reddish-brown palette; killing/exploring through floors 1–2 shows only catacombs-weighted monsters (rusher/caster/trapper/swarmling, the last spawning in a visible cluster of 3 near one room); floor 3 spawns a single "Void Warden" boss; (optionally, to save time, temporarily edit the bottom of `main.ts`'s `startFloor(1)` call to `startFloor(4)`, refresh, confirm the caverns' greenish palette and its "Spore Matriarch" boss appears on floor 6, then to `startFloor(7)` for the depths' purple palette and "The Unseen" boss on floor 9 — revert to `startFloor(1)` afterward).

- [ ] **Step 8: Commit**

```bash
git add src/main.ts
git commit -m "Restructure floors into 3 biomes with per-biome monster weighting and bosses"
```

---

### Task 4: Perk-choice leveling system

**Files:**
- Modify: `src/entities.ts`
- Modify: `src/main.ts`
- Test: `tests/entities.test.ts`

**Interfaces:**
- Consumes: `PERK_POOL` from `src/data.ts` (Task 1).
- Produces: `Player.perks: string[]` (already stubbed in Task 1 if needed); `Player.gainXp()` unchanged in signature but its level-up loop now triggers a perk offer every 2 levels instead of incrementing `statPoints`; new module state in `main.ts`: `pendingPerkChoice: Perk[] | null` and a `choosePerk(index: number)` function, plus keyboard handling (`1`/`2`/`3` while a choice is pending) as the temporary stand-in UI Phase C will replace.

- [ ] **Step 1: Write the failing test for perk-offer triggering**

```typescript
// append to tests/entities.test.ts
import { PERK_POOL } from '../src/data.js';

describe('perk offers', () => {
  it('gainXp returns a list of 3 perk choices every 2 levels, empty otherwise', () => {
    const player = new Player(STARTING_CLASSES.adventurer!);
    const { perkChoices: firstLevelChoices } = player.gainXp(xpForNextLevel(1));
    expect(player.level).toBe(2);
    expect(firstLevelChoices.length).toBe(3);
    const uniqueIds = new Set(firstLevelChoices.map(p => p.id));
    expect(uniqueIds.size).toBe(3);

    const { perkChoices: secondLevelChoices } = player.gainXp(xpForNextLevel(2));
    expect(player.level).toBe(3);
    expect(secondLevelChoices.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/voidcrawler && npx vitest run tests/entities.test.ts`
Expected: FAIL — `gainXp` currently returns `boolean`, not `{ leveled: boolean; perkChoices: Perk[] }`.

- [ ] **Step 3: Update `Player` in `src/entities.ts`**

```typescript
// in src/entities.ts, add the import:
import { PERK_POOL } from './data.js';
import type { StartingClass, MonsterArchetype, StatusEffect, Item, AttackStats, Perk } from './types.js';

// add to the Player class body:
  perks: string[] = [];

// replace the existing gainXp method with:
  gainXp(amount: number): { leveled: boolean; perkChoices: Perk[] } {
    this.xp += amount;
    let leveled = false;
    let perkChoices: Perk[] = [];
    while (this.xp >= xpForNextLevel(this.level)) {
      this.xp -= xpForNextLevel(this.level);
      this.level += 1;
      this.maxHp += 5;
      this.hp = this.maxHp;
      leveled = true;
      if (this.level % 2 === 0) {
        perkChoices = pickThreePerks();
      }
    }
    return { leveled, perkChoices };
  }
```

Remove the `statPoints` field and the old `statPoints += 1` line entirely — the perk system replaces flat stat points, per the V2 spec. Also add this module-level helper above the `Player` class:

```typescript
function pickThreePerks(): Perk[] {
  const pool = [...PERK_POOL];
  const picks: Perk[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const index = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(index, 1)[0]!);
  }
  return picks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run tests/entities.test.ts`
Expected: zero type errors; new test passes. (`Math.random()` in `pickThreePerks` makes the "3 unique ids" assertion probabilistic in principle, but with only 5 perks in the pool and always removing the picked one from a local copy before the next pick, duplicates are structurally impossible — the test is deterministic despite the randomness.)

- [ ] **Step 5: Fix the now-broken `gainXp` call sites**

```bash
grep -rn "gainXp" src/main.ts
```

In `src/main.ts`, both call sites (`player.gainXp(10)` in `playerAttack`'s and `monsterTurn`'s death branches) currently ignore the return value — update both to capture and act on `perkChoices`:

```typescript
// in playerAttack(), replace `player.gainXp(10);` with:
const { perkChoices } = player.gainXp(10);
if (perkChoices.length > 0) pendingPerkChoice = perkChoices;

// in monsterTurn(), replace `player.gainXp(10);` with the same two lines.
```

Add the module-level state and a `choosePerk` function near the other module-level state (alongside `let inventoryOpen = false;`):

```typescript
let pendingPerkChoice: import('./types.js').Perk[] | null = null;

function choosePerk(index: number): void {
  if (!pendingPerkChoice) return;
  const perk = pendingPerkChoice[index];
  if (!perk) return;
  perk.apply(player);
  log(`You gain a perk: ${perk.label}.`);
  pendingPerkChoice = null;
}
```

Remove the old `p`-key stat-point handler from the `keydown` listener (`if (e.key === 'p' && player.statPoints > 0) { ... }` no longer applies — `statPoints` was removed in Step 3) and replace it with perk-choice handling, inserted right after the `gameState !== 'playing'` early-return block:

```typescript
// in the keydown listener, after the `if (gameState !== 'playing') { ... return; }` block:
if (pendingPerkChoice) {
  if (/^[1-3]$/.test(e.key)) {
    choosePerk(Number(e.key) - 1);
  }
  return;
}
```

Update `renderHUD`'s call in `src/ui.ts` — it currently reads `player.statPoints`, which no longer exists. Change the HUD line:

```typescript
// in src/ui.ts, renderHUD(), replace:
//   player.statPoints > 0 ? `Unspent stat points: ${player.statPoints} (press 'p' to add STR)` : '',
// with:
    '',
```

(A dedicated perk-choice overlay is Phase C's job; for now the temporary stand-in is the `combatLog` message plus direct `1`/`2`/`3` key handling above — leaving this HUD line blank rather than referencing a removed field.)

- [ ] **Step 5b: Wire the `lifesteal` and `resilience` perk effects — a selectable perk must do something**

A perk that appears in the choice list but has no gameplay effect once picked (beyond the `perks` array bookkeeping from Step 3) would be a real bug, not a documentation gap — wire both effects now while `perks` is fresh in scope.

```typescript
// in src/main.ts, playerAttack(), right after `target.hp = Math.max(0, target.hp - result.damage);`:
if (result.crit && player.perks.includes('lifesteal')) {
  const healed = Math.round(result.damage * 0.2);
  player.hp = Math.min(player.maxHp + player.getMaxHpBonus(), player.hp + healed);
  log(`You steal ${healed} HP from the ${target.archetype.name}.`);
}
```

(`player.getMaxHpBonus()` doesn't exist until Task 5 — if executing this plan strictly in task order, temporarily use `player.maxHp` alone here and revisit this one line in Task 5 once the accessory bonus exists; since this plan is executed as a whole by the same session in this codebase, add `getMaxHpBonus()` from Task 5 Step 2 now if it's easier than tracking a revisit — either order produces the same final code.)

```typescript
// in src/main.ts, triggerTrapUnderPlayer(), change:
//   player.hp = Math.max(0, player.hp - trap.damage);
// to:
const trapDamage = Math.max(0, trap.damage - (player.perks.includes('resilience') ? 2 : 0));
player.hp = Math.max(0, player.hp - trapDamage);

// and update the log line right after it from `trap.damage` to `trapDamage`:
log(`You trigger a trap set by the ${trap.ownerName}! You take ${trapDamage} damage.`);
```

```typescript
// in src/main.ts, tickPlayerStatuses(), change:
//   if (totalDamage > 0) {
//     player.hp = Math.max(0, player.hp - totalDamage);
//     log(`You take ${totalDamage} damage from lingering status effects.`);
//   }
// to:
if (totalDamage > 0) {
  const reduced = Math.max(0, totalDamage - (player.perks.includes('resilience') ? 2 : 0));
  player.hp = Math.max(0, player.hp - reduced);
  log(`You take ${reduced} damage from lingering status effects.`);
}
```

- [ ] **Step 6: Typecheck and run full suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, 37/37 tests pass (36 from Task 2 + 1 new perk-offer test).

- [ ] **Step 7: Manually verify in browser**

Refresh `http://localhost:8766/`.
Expected: leveling up to level 2 logs "You gain a perk:" only after pressing `1`, `2`, or `3` — check the combat log for the three offered perk labels first (temporarily add a `console.log(pendingPerkChoice)` breakpoint-style check via the browser console if the labels aren't visible anywhere yet, since the choice-listing UI is Phase C's work: `pendingPerkChoice` is accessible by adding a one-line temporary `log(pendingPerkChoice.map(p => p.label).join(' / '))` right after it's set in both call sites, confirm the three labels appear in the combat log, then leave that logging line in permanently since it's genuinely useful feedback even before Phase C's overlay exists); pressing `1`/`2`/`3` applies the chosen perk and clears the prompt; movement/attack keys are ignored while a perk choice is pending.

- [ ] **Step 8: Commit**

```bash
git add src/entities.ts src/main.ts src/ui.ts tests/entities.test.ts
git commit -m "Replace flat stat points with a perk-choice leveling system"
```

---

### Task 5: Accessory equipment slot

**Files:**
- Modify: `src/entities.ts`
- Modify: `src/items.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `ACCESSORY_BASE_ITEMS` from `src/data.ts` (Task 1); `'accessory'` already added to `BaseItem['type']` in Task 1.
- Produces: `Player.equipment` gains an `accessory: Item | null` slot; `items.ts`'s affix pool gains 2 accessory-specific affixes (`maxHp`, `xpGain`) that only roll on `type === 'accessory'` items; `main.ts`'s `equipOrUseItem` and loot-drop logic handle the new item type.

- [ ] **Step 1: Add the accessory slot to `Player.equipment` in `src/entities.ts`**

```typescript
// in src/entities.ts, change:
//   equipment: { weapon: Item | null; armor: Item | null } = { weapon: null, armor: null };
// to:
  equipment: { weapon: Item | null; armor: Item | null; accessory: Item | null } = { weapon: null, armor: null, accessory: null };
```

- [ ] **Step 2: Extend `getAttackStats()` to include accessory affixes and add a `getMaxHpBonus()` helper**

```typescript
// in src/entities.ts, Player.getAttackStats() — extend critChance's reduce to also fold in the accessory's affixes:
  getAttackStats(): AttackStats {
    const weapon = this.equipment.weapon;
    const armor = this.equipment.armor;
    const accessory = this.equipment.accessory;
    const weaponDamage = weapon
      ? weapon.affixes.reduce((sum, a) => sum + (a.key === 'damage' ? a.value : 0), weapon.baseDamage ?? 3)
      : (2 + this.str);
    const critChance = 0.05 + this.dex * 0.01 + (weapon?.affixes ?? [])
      .reduce((sum, a) => sum + (a.key === 'critChance' ? a.value : 0), 0);
    const dodgeChance = 0.03 + this.dex * 0.005 + (armor?.affixes ?? [])
      .reduce((sum, a) => sum + (a.key === 'resistance' ? a.value * 0.2 : 0), 0);
    void accessory; // accessory affixes (maxHp/xpGain) are read via getMaxHpBonus()/getXpMultiplier() below, not attack stats
    return { damage: weaponDamage, critChance, dodgeChance };
  }

  getMaxHpBonus(): number {
    return this.equipment.accessory?.affixes.reduce((sum, a) => sum + (a.key === 'maxHp' ? a.value : 0), 0) ?? 0;
  }

  getXpMultiplier(): number {
    const bonus = this.equipment.accessory?.affixes.reduce((sum, a) => sum + (a.key === 'xpGain' ? a.value : 0), 0) ?? 0;
    return 1 + bonus;
  }
```

(The `void accessory;` line exists solely to satisfy `noUnusedLocals` for the local `const accessory` binding that's declared for symmetry with `weapon`/`armor` but genuinely isn't read inside `getAttackStats()` itself — its actual effects live in the two new methods below it. An alternative would be to not declare the local at all; it's kept for readability/consistency with the other two equipment slots.)

- [ ] **Step 3: Add accessory affixes to `src/items.ts`**

```typescript
// in src/items.ts, add to AFFIX_POOL:
  { key: 'maxHp', label: 'of Vitality', roll: (rng, tier) => Math.ceil((5 + rng() * 10) * tier) },
  { key: 'xpGain', label: 'of Wisdom', roll: (rng, tier) => +(0.05 + rng() * 0.1 * tier).toFixed(2) },
```

Update `generateItem`'s identifiability check to include accessories:

```typescript
// in src/items.ts, generateItem(), change:
//   const identifiable = baseItem.type === 'weapon' || baseItem.type === 'armor';
// to:
  const identifiable = baseItem.type === 'weapon' || baseItem.type === 'armor' || baseItem.type === 'accessory';
```

Note: with this change, the general `AFFIX_POOL` (5 entries: damage, critChance, resistance, maxHp, xpGain) can now roll a `damage`/`critChance`/`resistance` affix onto an accessory, or a `maxHp`/`xpGain` affix onto a weapon/armor — this is intentionally permissive (matches v1's existing behavior where all weapon/armor affixes already come from one shared pool) rather than adding per-slot affix filtering, which would be new scope beyond "add an accessory slot."

- [ ] **Step 4: Wire accessory drops and equip handling in `src/main.ts`**

```typescript
// in src/main.ts, import ACCESSORY_BASE_ITEMS alongside the existing BASE_ITEMS import:
import { BASE_ITEMS, ACCESSORY_BASE_ITEMS, getLootTableForFloor } from './data.js';

// in maybeDropLoot(), change:
//   const base = BASE_ITEMS.find(b => b.id === entry.itemId)!;
// to (loot table entries can now reference either pool by id):
const base = [...BASE_ITEMS, ...ACCESSORY_BASE_ITEMS].find(b => b.id === entry.itemId)!;

// in equipOrUseItem(), change:
//   if (item.type === 'weapon' || item.type === 'armor') {
//     const slot: 'weapon' | 'armor' = item.type === 'weapon' ? 'weapon' : 'armor';
// to:
if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
  const slot: 'weapon' | 'armor' | 'accessory' = item.type;
```

Add accessory drop chances to the loot table in `src/data.ts`'s `getLootTableForFloor`:

```typescript
// in src/data.ts, getLootTableForFloor(), add two entries to the returned array:
    { itemId: 'iron-ring', weight: 6 },
    { itemId: 'jade-amulet', weight: Math.max(1, 6 - depth) },
```

Apply the accessory's max-HP bonus where the player's `maxHp` matters — in `src/main.ts`, everywhere `player.maxHp` is used as the *cap* for healing (potion use and level-up), add the bonus:

```typescript
// in equipOrUseItem(), potion branch, change:
//   player.hp = Math.min(player.maxHp, player.hp + (item.healAmount ?? 0));
// to:
player.hp = Math.min(player.maxHp + player.getMaxHpBonus(), player.hp + (item.healAmount ?? 0));
```

Apply the XP multiplier where XP is granted — both `player.gainXp(10)` call sites in `main.ts` become:

```typescript
const { perkChoices } = player.gainXp(Math.round(10 * player.getXpMultiplier()));
if (perkChoices.length > 0) pendingPerkChoice = perkChoices;
```

- [ ] **Step 5: Typecheck and run full suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, 37/37 tests still pass (no test file covers accessories specifically — `items.ts`'s existing `rollAffixes`/`generateItem` tests already exercise the shared affix pool generically and don't need new assertions for this to be correct, since the pool-sharing behavior is intentionally uniform across item types as noted in Step 3).

- [ ] **Step 6: Manually verify in browser**

Refresh `http://localhost:8766/`, play until an accessory drops (grey/green/blue/orange dot on the ground, same rendering as other items — no v1 rendering code change was needed here since ground-item rendering already keys off `item.rarity`, not `item.type`), pick it up with `g`, equip it with its inventory number key.
Expected: "You equip [name]." log message; if the item rolled a `maxHp` affix, subsequent potion use and level-ups reflect the higher effective cap (verify by comparing `renderHUD`'s displayed `HP x/y` before and after equipping — `y` should increase by the affix's rolled value).

- [ ] **Step 7: Commit**

```bash
git add src/entities.ts src/items.ts src/main.ts src/data.ts
git commit -m "Add accessory equipment slot with maxHp/xpGain affixes"
```

---

### Task 6: Class unlock/purchase system

**Files:**
- Modify: `src/save.ts`
- Modify: `src/types.ts`
- Test: `tests/save.test.ts`

**Interfaces:**
- Consumes: `STARTING_CLASSES` from `src/data.ts` (Task 1, now includes `unlockCost`).
- Produces: `purchaseClass(meta: MetaProgression, classId: string): { updated: MetaProgression; success: boolean; reason?: string }` — validates the class exists, isn't already unlocked, and the player has enough currency; on success, deducts currency and adds the class id to `unlockedClasses`. This is the data-layer piece Phase C's title-screen UI will call directly; no `main.ts` wiring happens in this task since there's no title screen yet for the player to trigger a purchase from.

- [ ] **Step 1: Write the failing test**

```typescript
// append to tests/save.test.ts
import { purchaseClass } from '../src/save.js';

describe('purchaseClass', () => {
  it('succeeds and deducts currency when the class exists, is locked, and is affordable', () => {
    const meta = { currency: 150, unlockedClasses: ['adventurer'], unlockedPerks: [] };
    const result = purchaseClass(meta, 'berserker');
    expect(result.success).toBe(true);
    expect(result.updated.currency).toBe(50);
    expect(result.updated.unlockedClasses).toContain('berserker');
  });

  it('fails without spending currency when the class is already unlocked', () => {
    const meta = { currency: 150, unlockedClasses: ['adventurer', 'berserker'], unlockedPerks: [] };
    const result = purchaseClass(meta, 'berserker');
    expect(result.success).toBe(false);
    expect(result.updated.currency).toBe(150);
  });

  it('fails without spending currency when unaffordable', () => {
    const meta = { currency: 10, unlockedClasses: ['adventurer'], unlockedPerks: [] };
    const result = purchaseClass(meta, 'berserker');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient currency');
    expect(result.updated.currency).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/voidcrawler && npx vitest run tests/save.test.ts`
Expected: FAIL — `purchaseClass` doesn't exist yet.

- [ ] **Step 3: Implement `purchaseClass` in `src/save.ts`**

```typescript
// in src/save.ts, add the import:
import { STARTING_CLASSES } from './data.js';

// append to src/save.ts:
export function purchaseClass(
  meta: MetaProgression, classId: string,
): { updated: MetaProgression; success: boolean; reason?: string } {
  const startingClass = STARTING_CLASSES[classId];
  if (!startingClass) {
    return { updated: meta, success: false, reason: 'unknown class' };
  }
  if (meta.unlockedClasses.includes(classId)) {
    return { updated: meta, success: false, reason: 'already unlocked' };
  }
  if (meta.currency < startingClass.unlockCost) {
    return { updated: meta, success: false, reason: 'insufficient currency' };
  }
  return {
    updated: {
      ...meta,
      currency: meta.currency - startingClass.unlockCost,
      unlockedClasses: [...meta.unlockedClasses, classId],
    },
    success: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run tests/save.test.ts`
Expected: zero type errors; all 3 new tests pass.

- [ ] **Step 5: Run the full suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, 40/40 tests pass (37 from Task 5 + 3 new).

- [ ] **Step 6: Commit**

```bash
git add src/save.ts tests/save.test.ts
git commit -m "Add class unlock/purchase logic"
```

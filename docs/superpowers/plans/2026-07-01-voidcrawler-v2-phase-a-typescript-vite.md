# Voidcrawler V2 Phase A: TypeScript + Vite Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the working v1 Voidcrawler codebase (vanilla JS, zero build step) to TypeScript strict mode with a Vite dev/build pipeline and a Vitest test suite, with zero gameplay behavior change — this is a tooling migration, not a feature change.

**Architecture:** Rename every `src/*.js` to `src/*.ts` and add type annotations using a new shared `src/types.ts` module for cross-file interfaces (Floor, MonsterArchetype, Item, MonsterAction, etc.). Port `tests/*.test.js` to Vitest syntax first (against the *existing* JS, to prove the port itself is correct), then convert source files bottom-up (leaf modules first, `main.ts` last, since it depends on everything).

**Tech Stack:** TypeScript 6.0 (strict mode), Vite 8.1, Vitest 4.1. Import specifiers keep the `.js` extension even in `.ts` files (e.g. `import { TILE } from './dungeon.js'`) — this is the standard TS-with-native-ESM convention: it matches what the compiled output resolves at runtime and is what `moduleResolution: "bundler"` expects.

## Global Constraints

- Zero gameplay/behavior change in this phase — every existing test must still pass with identical assertions, and the game must play identically in the browser before and after.
- No external image or audio assets (unchanged from v1 — still applies through Phase C).
- `strict: true` in `tsconfig.json` — no `any` except where genuinely unavoidable (none expected in this codebase).
- Keep the existing module boundaries from v1 (`dungeon.ts`, `fov.ts`, `entities.ts`, `pathfinding.ts`, `ai.ts`, `combat.ts`, `items.ts`, `save.ts`, `fx.ts`, `ui.ts`, `data.ts`, `main.ts`) — this phase adds types, it does not restructure files.

---

### Task 1: Project tooling — package.json, tsconfig.json, vite.config.ts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: `npm run dev` (Vite dev server), `npm run build` (typecheck + Vite production build to `dist/`), `npm run test` (Vitest run), `npm run typecheck` (`tsc --noEmit`) — all later tasks assume these four scripts exist and work.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "voidcrawler",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "vite": "^8.1.2",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd ~/voidcrawler && npm install`
Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
dist/
*.local
```

- [ ] **Step 7: Verify tooling boots**

Run: `cd ~/voidcrawler && npx vite --version && npx tsc --version && npx vitest --version`
Expected: three version strings printed, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts .gitignore
git commit -m "Add TypeScript + Vite + Vitest tooling"
```

---

### Task 2: Port test suite to Vitest (against existing JS source)

**Files:**
- Create: `tests/rng.test.ts`, `tests/dungeon.test.ts`, `tests/fov.test.ts`, `tests/entities.test.ts`, `tests/combat.test.ts`, `tests/pathfinding.test.ts`, `tests/ai.test.ts`, `tests/items.test.ts`, `tests/save.test.ts`
- Delete: the 9 corresponding `tests/*.test.js` files

**Interfaces:**
- Consumes: the existing (still-`.js`) `src/*.js` modules, unchanged — this task proves the *test port* is correct in isolation, decoupled from the source migration in Tasks 3–7.
- Produces: nothing new — same assertions as v1, translated from `node:test`/`node:assert/strict` to `vitest`'s `describe`/`it`/`expect`.

- [ ] **Step 1: Port `tests/rng.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/rng.js';

describe('createRng', () => {
  it('same seed produces same sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toEqual(b());
  });

  it('values stay within [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Port `tests/dungeon.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/rng.js';
import { generateFloor, isFullyConnected, TILE } from '../src/dungeon.js';

describe('generateFloor', () => {
  it('every generated floor is fully connected', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const floor = generateFloor(1, createRng(seed), 60, 34);
      expect(isFullyConnected(floor)).toBe(true);
    }
  });

  it('generated floor has at least 2 rooms and a stairs-down tile', () => {
    const floor = generateFloor(3, createRng(99), 60, 34);
    expect(floor.rooms.length).toBeGreaterThanOrEqual(2);
    expect(floor.grid[floor.stairsDown.y * floor.width + floor.stairsDown.x]).toBe(TILE.STAIRS_DOWN);
  });

  it('deeper floors are still connected at larger difficulty', () => {
    const floor = generateFloor(8, createRng(5), 60, 34);
    expect(isFullyConnected(floor)).toBe(true);
  });
});
```

- [ ] **Step 3: Port `tests/fov.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { computeFOV } from '../src/fov.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width: number, height: number) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

describe('computeFOV', () => {
  it('open room: origin and nearby tile are visible, far tile beyond radius is not', () => {
    const floor = openFloor(20, 20);
    const visible = computeFOV(floor, 10, 10, 5);
    expect(visible.has('10,10')).toBe(true);
    expect(visible.has('10,13')).toBe(true);
    expect(visible.has('10,16')).toBe(false);
  });

  it('a wall blocks visibility of tiles behind it', () => {
    const floor = openFloor(20, 20);
    floor.grid[idx(12, 10, 20)] = TILE.WALL;
    const visible = computeFOV(floor, 10, 10, 8);
    expect(visible.has('11,10')).toBe(true);
    expect(visible.has('14,10')).toBe(false);
    expect(visible.has('8,10')).toBe(true);
  });
});
```

- [ ] **Step 4: Port `tests/entities.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Player, Monster, xpForNextLevel } from '../src/entities.js';
import { STARTING_CLASSES, MONSTER_ARCHETYPES } from '../src/data.js';

describe('Player.gainXp', () => {
  it('gaining enough xp levels up exactly once and grants a stat point', () => {
    const player = new Player(STARTING_CLASSES.adventurer);
    const needed = xpForNextLevel(1);
    expect(player.gainXp(needed)).toBe(true);
    expect(player.level).toBe(2);
    expect(player.statPoints).toBe(1);
    expect(player.hp).toBe(player.maxHp);
  });

  it('gaining a huge amount of xp can level up multiple times in one call', () => {
    const player = new Player(STARTING_CLASSES.adventurer);
    player.gainXp(xpForNextLevel(1) + xpForNextLevel(2) + 5);
    expect(player.level).toBe(3);
    expect(player.statPoints).toBe(2);
  });

  it('gaining too little xp does not level up', () => {
    const player = new Player(STARTING_CLASSES.adventurer);
    expect(player.gainXp(1)).toBe(false);
    expect(player.level).toBe(1);
  });
});

describe('Monster', () => {
  it('starts at full hp from its archetype', () => {
    const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
    expect(monster.hp).toBe(MONSTER_ARCHETYPES.rusher.hp);
    expect(monster.state).toBe('idle');
  });
});
```

- [ ] **Step 5: Port `tests/combat.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveAttack, tickStatuses } from '../src/combat.js';

function stubRng(values: number[]) {
  const queue = [...values];
  return () => (queue.length ? queue.shift()! : 0.5);
}

describe('resolveAttack', () => {
  it('attack is dodged when the dodge roll succeeds', () => {
    const result = resolveAttack({ damage: 10, critChance: 0, dodgeChance: 0.5 }, stubRng([0.1]));
    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
  });

  it('attack hits and is not a crit when both rolls fail', () => {
    const result = resolveAttack({ damage: 10, critChance: 0.2, dodgeChance: 0.1 }, stubRng([0.9, 0.9, 0.5]));
    expect(result.hit).toBe(true);
    expect(result.crit).toBe(false);
    expect(result.damage).toBeGreaterThanOrEqual(8);
    expect(result.damage).toBeLessThanOrEqual(12);
  });

  it('a crit hit deals roughly 1.5x damage', () => {
    const result = resolveAttack({ damage: 10, critChance: 1, dodgeChance: 0 }, stubRng([0.9, 0.0, 0.5]));
    expect(result.crit).toBe(true);
    expect(result.damage).toBe(Math.round(10 * 1.0 * 1.5));
  });
});

describe('tickStatuses', () => {
  it('sums damage and expires statuses at zero turns remaining', () => {
    const statuses = [
      { damagePerTick: 2, turnsRemaining: 1 },
      { damagePerTick: 3, turnsRemaining: 2 },
    ];
    const { totalDamage, remaining } = tickStatuses(statuses);
    expect(totalDamage).toBe(5);
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.turnsRemaining).toBe(1);
  });
});
```

- [ ] **Step 6: Port `tests/pathfinding.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { aStar } from '../src/pathfinding.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width: number, height: number) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

describe('aStar', () => {
  it('finds a straight path in an open floor', () => {
    const floor = openFloor(10, 10);
    const path = aStar({ x: 0, y: 0 }, { x: 3, y: 0 }, floor);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4);
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it('routes around an obstacle', () => {
    const floor = openFloor(10, 10);
    for (let y = 0; y < 8; y++) floor.grid[idx(3, y, 10)] = TILE.WALL;
    const path = aStar({ x: 0, y: 0 }, { x: 6, y: 0 }, floor);
    expect(path).not.toBeNull();
    expect(path!.every(p => floor.grid[idx(p.x, p.y, 10)] !== TILE.WALL)).toBe(true);
  });

  it('returns null when the goal is fully enclosed', () => {
    const floor = openFloor(10, 10);
    for (let x = 3; x <= 5; x++) {
      floor.grid[idx(x, 3, 10)] = TILE.WALL;
      floor.grid[idx(x, 5, 10)] = TILE.WALL;
    }
    for (let y = 3; y <= 5; y++) {
      floor.grid[idx(3, y, 10)] = TILE.WALL;
      floor.grid[idx(5, y, 10)] = TILE.WALL;
    }
    expect(aStar({ x: 0, y: 0 }, { x: 4, y: 4 }, floor)).toBeNull();
  });
});
```

- [ ] **Step 7: Port `tests/ai.test.ts`**

```typescript
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
    const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer);
    player.x = 8; player.y = 8;
    decideMonsterAction(monster, player, floor, neverSee);
    expect(monster.state).toBe('idle');
  });

  it('idle monster becomes aggro and chases when it sees the player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer);
    player.x = 5; player.y = 8;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(monster.state).toBe('chase');
    expect(action.type).toBe('move');
  });

  it('monster attacks when adjacent to the player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.rusher, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer);
    player.x = 6; player.y = 5;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(action.type).toBe('attack');
    expect(action.target).toBe(player);
  });

  it('a monster with a flee threshold flees below that hp fraction', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.caster, 5, 5);
    monster.hp = monster.maxHp * 0.1;
    const player = new Player(STARTING_CLASSES.adventurer);
    player.x = 6; player.y = 5;
    decideMonsterAction(monster, player, floor, alwaysSee);
    expect(monster.state).toBe('flee');
  });

  it('a stationary archetype never moves — it places a trap toward a distant player', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.trapper, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer);
    player.x = 5; player.y = 8;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(action.type).toBe('placeTrap');
    expect(monster.x).toBe(5);
    expect(monster.y).toBe(5);
    expect(action.at).toEqual({ x: 5, y: 6 });
  });

  it('a stationary archetype attacks instead of placing a trap when the player is adjacent', () => {
    const floor = openFloor(10, 10);
    const monster = new Monster(MONSTER_ARCHETYPES.trapper, 5, 5);
    const player = new Player(STARTING_CLASSES.adventurer);
    player.x = 6; player.y = 5;
    const action = decideMonsterAction(monster, player, floor, alwaysSee);
    expect(action.type).toBe('attack');
  });
});
```

- [ ] **Step 8: Port `tests/items.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { rollAffixes, generateItem, rollLootTable, RARITY_AFFIX_COUNT } from '../src/items.js';

function stubRng(values: number[]) {
  const queue = [...values];
  return () => (queue.length ? queue.shift()! : 0.999);
}

describe('rollAffixes', () => {
  it('returns exactly the expected count per rarity, no duplicate keys', () => {
    for (const rarity of Object.keys(RARITY_AFFIX_COUNT) as Array<keyof typeof RARITY_AFFIX_COUNT>) {
      const rng = stubRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const affixes = rollAffixes(rarity, rng, 1);
      expect(affixes.length).toBe(RARITY_AFFIX_COUNT[rarity]);
      const keys = affixes.map(a => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('generateItem', () => {
  it('marks weapons and armor as identified, potions/scrolls as not', () => {
    const rng = stubRng([0.1, 0.2, 0.3]);
    const weapon = generateItem({ id: 'sword', type: 'weapon', name: 'Sword', baseDamage: 5 }, 'common', rng, 1);
    const potion = generateItem({ id: 'potion', type: 'potion', name: 'Potion' }, 'common', rng, 1);
    expect(weapon.identified).toBe(true);
    expect(potion.identified).toBe(false);
  });
});

describe('rollLootTable', () => {
  it('respects weighted boundaries', () => {
    const table = [
      { itemId: 'a', weight: 1 },
      { itemId: 'b', weight: 9 },
    ];
    expect(rollLootTable(table, stubRng([0.05])).itemId).toBe('a');
    expect(rollLootTable(table, stubRng([0.5])).itemId).toBe('b');
  });
});
```

- [ ] **Step 9: Port `tests/save.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { loadMeta, saveMeta, applyRunResult } from '../src/save.js';

function fakeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
  };
}

describe('loadMeta', () => {
  it('returns defaults when storage is empty', () => {
    const meta = loadMeta(fakeStorage());
    expect(meta.currency).toBe(0);
    expect(meta.unlockedClasses).toEqual(['adventurer']);
  });

  it('falls back to defaults on corrupted JSON', () => {
    const storage = fakeStorage({ 'voidcrawler-meta-v1': 'not json{{' });
    expect(loadMeta(storage).currency).toBe(0);
  });
});

describe('saveMeta', () => {
  it('then loadMeta round-trips', () => {
    const storage = fakeStorage();
    saveMeta({ currency: 42, unlockedClasses: ['adventurer'], unlockedPerks: ['tough'] }, storage);
    const meta = loadMeta(storage);
    expect(meta.currency).toBe(42);
    expect(meta.unlockedPerks).toEqual(['tough']);
  });
});

describe('applyRunResult', () => {
  it('adds currency proportional to floor and kills', () => {
    const meta = { currency: 10, unlockedClasses: ['adventurer'], unlockedPerks: [] };
    const { updated, earned } = applyRunResult(meta, { floorReached: 3, kills: 5 });
    expect(earned).toBe(3 * 10 + 5 * 2);
    expect(updated.currency).toBe(10 + earned);
  });
});
```

- [ ] **Step 10: Delete the old `.js` test files and run the ported suite**

```bash
rm tests/rng.test.js tests/dungeon.test.js tests/fov.test.js tests/entities.test.js tests/combat.test.js tests/pathfinding.test.js tests/ai.test.js tests/items.test.js tests/save.test.js
```

Run: `cd ~/voidcrawler && npx vitest run`
Expected: 32 tests pass (same count as the v1 `node --test` run), importing from the still-unconverted `src/*.js` files — this proves the Vitest port itself is correct, isolated from the TS source migration.

- [ ] **Step 11: Commit**

```bash
git add tests/
git commit -m "Port test suite from node:test to Vitest"
```

---

### Task 3: Shared types + convert `data`, `rng`, `dungeon`, `fov` to TypeScript

**Files:**
- Create: `src/types.ts`
- Create: `src/data.ts`, `src/rng.ts`, `src/dungeon.ts`, `src/fov.ts`
- Delete: `src/data.js`, `src/rng.js`, `src/dungeon.js`, `src/fov.js`

**Interfaces:**
- Produces (`src/types.ts`): `export type RngFn = () => number;` `export interface MonsterArchetype { id: string; name: string; hp: number; damage: number; critChance: number; dodgeChance: number; sightRange: number; ranged: boolean; range: number; fleeHpFraction: number; color: string; stationary?: boolean; trapRange?: number; trapDamage?: number; }` `export interface StartingClass { id: string; name: string; baseHp: number; str: number; dex: number; vit: number; }` `export interface Floor { grid: Uint8Array; width: number; height: number; rooms: import('./dungeon.js').Room[]; depth: number; stairsDown: { x: number; y: number }; }` `export interface StatusEffect { damagePerTick: number; turnsRemaining: number; }` `export interface Affix { key: string; label: string; value: number; }` `export interface BaseItem { id: string; type: 'weapon' | 'armor' | 'potion' | 'scroll'; name: string; baseDamage?: number; baseArmor?: number; healAmount?: number; statusEffect?: string; }` `export interface Item extends BaseItem { rarity: string; affixes: Affix[]; identified: boolean; }` `export interface LootTableEntry { itemId: string | null; weight: number; }` `export type MonsterActionType = 'move' | 'attack' | 'rangedAttack' | 'placeTrap' | 'wait';` `export interface MonsterAction { type: MonsterActionType; to?: { x: number; y: number }; target?: import('./entities.js').Player; at?: { x: number; y: number }; }` — consumed by every other module.

- [ ] **Step 1: Write `src/types.ts`**

```typescript
import type { Room } from './dungeon.js';
import type { Player } from './entities.js';

export type RngFn = () => number;

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
}

export interface StartingClass {
  id: string;
  name: string;
  baseHp: number;
  str: number;
  dex: number;
  vit: number;
}

export interface Floor {
  grid: Uint8Array;
  width: number;
  height: number;
  rooms: Room[];
  depth: number;
  stairsDown: { x: number; y: number };
}

export interface StatusEffect {
  damagePerTick: number;
  turnsRemaining: number;
}

export interface Affix {
  key: string;
  label: string;
  value: number;
}

export interface BaseItem {
  id: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll';
  name: string;
  baseDamage?: number;
  baseArmor?: number;
  healAmount?: number;
  statusEffect?: string;
}

export interface Item extends BaseItem {
  rarity: string;
  affixes: Affix[];
  identified: boolean;
}

export interface LootTableEntry {
  itemId: string | null;
  weight: number;
}

export type MonsterActionType = 'move' | 'attack' | 'rangedAttack' | 'placeTrap' | 'wait';

export interface MonsterAction {
  type: MonsterActionType;
  to?: { x: number; y: number };
  target?: Player;
  at?: { x: number; y: number };
}

export interface AttackStats {
  damage: number;
  critChance: number;
  dodgeChance: number;
}
```

- [ ] **Step 2: Convert `src/rng.ts`**

```typescript
import type { RngFn } from './types.js';

export function createRng(seed: number): RngFn {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function rng() {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}
```

- [ ] **Step 3: Convert `src/dungeon.ts`**

```typescript
import type { Floor, RngFn } from './types.js';

export const TILE = { WALL: 0, FLOOR: 1, STAIRS_DOWN: 2 } as const;

export function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

export class Room {
  constructor(public x: number, public y: number, public w: number, public h: number) {}
  center(): { x: number; y: number } {
    return { x: Math.floor(this.x + this.w / 2), y: Math.floor(this.y + this.h / 2) };
  }
}

interface Leaf { x: number; y: number; w: number; h: number; }

function splitBSP(x: number, y: number, w: number, h: number, rng: RngFn, minSize: number, depth: number): Leaf[] {
  if (depth <= 0 || w < minSize * 2 || h < minSize * 2) {
    return [{ x, y, w, h }];
  }
  const splitHorizontal = w > h ? false : (h > w ? true : rng() < 0.5);
  if (splitHorizontal) {
    const splitAt = Math.floor(minSize + rng() * (h - minSize * 2));
    return [
      ...splitBSP(x, y, w, splitAt, rng, minSize, depth - 1),
      ...splitBSP(x, y + splitAt, w, h - splitAt, rng, minSize, depth - 1),
    ];
  }
  const splitAt = Math.floor(minSize + rng() * (w - minSize * 2));
  return [
    ...splitBSP(x, y, splitAt, h, rng, minSize, depth - 1),
    ...splitBSP(x + splitAt, y, w - splitAt, h, rng, minSize, depth - 1),
  ];
}

function carveRoom(grid: Uint8Array, width: number, room: Room): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[idx(x, y, width)] = TILE.FLOOR;
    }
  }
}

function carveCorridor(grid: Uint8Array, width: number, from: { x: number; y: number }, to: { x: number; y: number }): void {
  let { x, y } = from;
  while (x !== to.x) {
    grid[idx(x, y, width)] = TILE.FLOOR;
    x += x < to.x ? 1 : -1;
  }
  while (y !== to.y) {
    grid[idx(x, y, width)] = TILE.FLOOR;
    y += y < to.y ? 1 : -1;
  }
  grid[idx(x, y, width)] = TILE.FLOOR;
}

export function generateFloor(depth: number, rng: RngFn, width: number, height: number): Floor {
  const grid = new Uint8Array(width * height).fill(TILE.WALL);
  const leaves = splitBSP(1, 1, width - 2, height - 2, rng, 6, 5);

  const rooms = leaves.map(leaf => {
    const roomW = Math.max(3, Math.floor(leaf.w * (0.5 + rng() * 0.4)));
    const roomH = Math.max(3, Math.floor(leaf.h * (0.5 + rng() * 0.4)));
    const roomX = leaf.x + Math.floor(rng() * (leaf.w - roomW));
    const roomY = leaf.y + Math.floor(rng() * (leaf.h - roomH));
    return new Room(roomX, roomY, roomW, roomH);
  });

  rooms.forEach(room => carveRoom(grid, width, room));
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(grid, width, rooms[i - 1]!.center(), rooms[i]!.center());
  }

  const stairsRoom = rooms[rooms.length - 1]!;
  const stairsDown = stairsRoom.center();
  grid[idx(stairsDown.x, stairsDown.y, width)] = TILE.STAIRS_DOWN;

  return { grid, width, height, rooms, depth, stairsDown };
}

export function isFullyConnected(floor: Floor): boolean {
  const { grid, width, height, rooms } = floor;
  if (rooms.length === 0) return true;
  const start = rooms[0]!.center();
  const seen = new Set<number>([idx(start.x, start.y, width)]);
  const stack: Array<{ x: number; y: number }> = [start];
  const deltas: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const { x, y } = stack.pop()!;
    for (const [dx, dy] of deltas) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (grid[idx(nx, ny, width)] === TILE.WALL) continue;
      const key = idx(nx, ny, width);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push({ x: nx, y: ny });
    }
  }
  return rooms.every(r => {
    const c = r.center();
    return seen.has(idx(c.x, c.y, width));
  });
}
```

- [ ] **Step 4: Convert `src/fov.ts`**

```typescript
import { TILE, idx } from './dungeon.js';
import type { Floor } from './types.js';

const OCTANTS: Array<[number, number, number, number]> = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
];

function castLight(
  floor: Floor, cx: number, cy: number, radius: number, visible: Set<string>,
  row: number, start: number, end: number, xx: number, xy: number, yx: number, yy: number,
): void {
  if (start < end) return;
  let newStart = 0;
  for (let i = row; i <= radius; i++) {
    let dx = -i - 1;
    const dy = -i;
    let blocked = false;
    while (dx <= 0) {
      dx += 1;
      const mapX = cx + dx * xx + dy * xy;
      const mapY = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (mapX >= 0 && mapX < floor.width && mapY >= 0 && mapY < floor.height) {
        if (dx * dx + dy * dy <= radius * radius) {
          visible.add(`${mapX},${mapY}`);
        }
        const isWall = floor.grid[idx(mapX, mapY, floor.width)] === TILE.WALL;
        if (blocked) {
          if (isWall) { newStart = rSlope; continue; }
          blocked = false; start = newStart;
        } else if (isWall && i < radius) {
          blocked = true;
          castLight(floor, cx, cy, radius, visible, i + 1, start, lSlope, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
    }
    if (blocked) break;
  }
}

export function computeFOV(floor: Floor, originX: number, originY: number, radius: number): Set<string> {
  const visible = new Set<string>([`${originX},${originY}`]);
  for (const [xx, xy, yx, yy] of OCTANTS) {
    castLight(floor, originX, originY, radius, visible, 1, 1.0, 0.0, xx, xy, yx, yy);
  }
  return visible;
}
```

- [ ] **Step 5: Convert `src/data.ts`** (same content as v1 `src/data.js`, typed against `MonsterArchetype`/`StartingClass`)

```typescript
import type { MonsterArchetype, StartingClass, BaseItem, LootTableEntry } from './types.js';

export const TILE_SIZE = 24;
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 34;

export const XP_TABLE: number[] = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320];

export const STARTING_CLASSES: Record<string, StartingClass> = {
  adventurer: { id: 'adventurer', name: 'Adventurer', baseHp: 30, str: 5, dex: 5, vit: 5 },
};

export const MONSTER_ARCHETYPES: Record<string, MonsterArchetype> = {
  rusher: {
    id: 'rusher', name: 'Rusher', hp: 12, damage: 4, critChance: 0.05, dodgeChance: 0.05,
    sightRange: 6, ranged: false, range: 1, fleeHpFraction: 0, color: '#b33',
  },
  caster: {
    id: 'caster', name: 'Caster', hp: 8, damage: 5, critChance: 0.1, dodgeChance: 0.1,
    sightRange: 7, ranged: true, range: 5, fleeHpFraction: 0.3, color: '#33b',
  },
  trapper: {
    id: 'trapper', name: 'Trapper', hp: 10, damage: 6, critChance: 0.02, dodgeChance: 0.02,
    sightRange: 4, ranged: false, range: 1, fleeHpFraction: 0, color: '#3b3',
    stationary: true, trapRange: 4, trapDamage: 6,
  },
  boss: {
    id: 'boss', name: 'Void Warden', hp: 60, damage: 9, critChance: 0.15, dodgeChance: 0.05,
    sightRange: 10, ranged: false, range: 1, fleeHpFraction: 0, color: '#a0a',
  },
};

export const BASE_ITEMS: BaseItem[] = [
  { id: 'short-sword', type: 'weapon', name: 'Short Sword', baseDamage: 4 },
  { id: 'long-sword', type: 'weapon', name: 'Long Sword', baseDamage: 6 },
  { id: 'leather-armor', type: 'armor', name: 'Leather Armor', baseArmor: 2 },
  { id: 'chain-armor', type: 'armor', name: 'Chain Armor', baseArmor: 4 },
  { id: 'health-potion', type: 'potion', name: 'Unidentified Potion', healAmount: 15 },
  { id: 'scroll-of-fire', type: 'scroll', name: 'Unidentified Scroll', statusEffect: 'burn' },
];

export function getLootTableForFloor(depth: number): LootTableEntry[] {
  return [
    { itemId: null, weight: 50 },
    { itemId: 'short-sword', weight: 10 },
    { itemId: 'long-sword', weight: Math.max(2, 10 - depth) },
    { itemId: 'leather-armor', weight: 10 },
    { itemId: 'chain-armor', weight: Math.max(2, 10 - depth) },
    { itemId: 'health-potion', weight: 15 },
    { itemId: 'scroll-of-fire', weight: 8 },
  ];
}
```

- [ ] **Step 6: Delete the old `.js` versions of these four files and update test imports**

```bash
rm src/rng.js src/dungeon.js src/fov.js src/data.js
```

Vitest/Vite resolve `import ... from './rng.js'` to `src/rng.ts` automatically (this is the standard TS+bundler resolution behavior) — no test import paths need to change.

- [ ] **Step 7: Typecheck and run tests**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: typecheck passes with zero errors; all 32 tests still pass (now `rng`/`dungeon`/`fov`/`data` are typed, the rest still plain `.js`, which is fine — `tsconfig.json` doesn't set `allowJs: false` in a way that blocks mixed JS/TS during this transitional phase, since `include` covers both and TS treats untyped `.js` imports as implicitly `any` by default without `checkJs`).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/rng.ts src/dungeon.ts src/fov.ts src/data.ts
git rm src/rng.js src/dungeon.js src/fov.js src/data.js
git commit -m "Convert types, rng, dungeon, fov, data to TypeScript"
```

---

### Task 4: Convert `entities`, `pathfinding`, `combat`, `ai` to TypeScript

**Files:**
- Create: `src/entities.ts`, `src/pathfinding.ts`, `src/combat.ts`, `src/ai.ts`
- Delete: `src/entities.js`, `src/pathfinding.js`, `src/combat.js`, `src/ai.js`

**Interfaces:**
- Consumes: `Floor`, `RngFn`, `MonsterArchetype`, `StartingClass`, `StatusEffect`, `MonsterAction`, `AttackStats`, `Item` from `src/types.ts`; `TILE`/`idx` from `src/dungeon.ts`; `XP_TABLE` from `src/data.ts`.
- Produces: same runtime shapes as v1 (`Player`, `Monster` classes, `xpForNextLevel`, `resolveAttack`, `tickStatuses`, `aStar`, `decideMonsterAction`), now fully typed. Consumed by `main.ts` (Task 7).

- [ ] **Step 1: Convert `src/entities.ts`**

```typescript
import { XP_TABLE } from './data.js';
import type { StartingClass, MonsterArchetype, StatusEffect, Item, AttackStats } from './types.js';

export function xpForNextLevel(level: number): number {
  if (level < XP_TABLE.length) return XP_TABLE[level]!;
  return XP_TABLE[XP_TABLE.length - 1]! + (level - XP_TABLE.length + 1) * 100;
}

export class Player {
  maxHp: number;
  hp: number;
  level = 1;
  xp = 0;
  statPoints = 0;
  str: number;
  dex: number;
  vit: number;
  inventory: Item[] = [];
  equipment: { weapon: Item | null; armor: Item | null } = { weapon: null, armor: null };
  x = 0;
  y = 0;
  statuses: StatusEffect[] = [];

  constructor(startingClass: StartingClass) {
    this.maxHp = startingClass.baseHp;
    this.hp = this.maxHp;
    this.str = startingClass.str;
    this.dex = startingClass.dex;
    this.vit = startingClass.vit;
  }

  gainXp(amount: number): boolean {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= xpForNextLevel(this.level)) {
      this.xp -= xpForNextLevel(this.level);
      this.level += 1;
      this.statPoints += 1;
      this.maxHp += 5;
      this.hp = this.maxHp;
      leveled = true;
    }
    return leveled;
  }

  getAttackStats(): AttackStats {
    const weaponDamage = this.equipment.weapon?.affixes?.reduce(
      (sum, a) => sum + (a.key === 'damage' ? a.value : 0), this.equipment.weapon.baseDamage ?? 3,
    ) ?? (2 + this.str);
    const critChance = 0.05 + this.dex * 0.01 + (this.equipment.weapon?.affixes ?? [])
      .reduce((sum, a) => sum + (a.key === 'critChance' ? a.value : 0), 0);
    const dodgeChance = 0.03 + this.dex * 0.005 + (this.equipment.armor?.affixes ?? [])
      .reduce((sum, a) => sum + (a.key === 'resistance' ? a.value * 0.2 : 0), 0);
    return { damage: weaponDamage, critChance, dodgeChance };
  }
}

export class Monster {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  state: 'idle' | 'aggro' | 'chase' | 'attack' | 'flee' = 'idle';
  statuses: StatusEffect[] = [];
  lastKnownPlayerPos: { x: number; y: number } | null = null;

  constructor(public archetype: MonsterArchetype, x: number, y: number) {
    this.hp = archetype.hp;
    this.maxHp = archetype.hp;
    this.x = x;
    this.y = y;
  }

  getAttackStats(): AttackStats {
    return {
      damage: this.archetype.damage,
      critChance: this.archetype.critChance,
      dodgeChance: this.archetype.dodgeChance,
    };
  }
}
```

- [ ] **Step 2: Convert `src/pathfinding.ts`**

```typescript
import { TILE, idx } from './dungeon.js';
import type { Floor } from './types.js';

interface Point { x: number; y: number; }

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function aStar(start: Point, goal: Point, floor: Floor): Point[] | null {
  const key = (p: Point) => `${p.x},${p.y}`;
  const open = new Map<string, Point>([[key(start), start]]);
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const fScore = new Map<string, number>([[key(start), heuristic(start, goal)]]);

  while (open.size > 0) {
    let currentKey: string | null = null;
    let current: Point | null = null;
    let best = Infinity;
    for (const [k, node] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < best) { best = f; currentKey = k; current = node; }
    }
    if (!current || !currentKey) break;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [current];
      let k: string = currentKey;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k)!;
        path.unshift(prev);
        k = key(prev);
      }
      return path;
    }

    open.delete(currentKey);
    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 },
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= floor.width || n.y >= floor.height) continue;
      if (floor.grid[idx(n.x, n.y, floor.width)] === TILE.WALL) continue;
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      const nKey = key(n);
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(n, goal));
        open.set(nKey, n);
      }
    }
  }
  return null;
}
```

- [ ] **Step 3: Convert `src/combat.ts`**

```typescript
import type { RngFn, StatusEffect, AttackStats } from './types.js';

export interface AttackResult {
  hit: boolean;
  damage: number;
  crit: boolean;
}

export function resolveAttack({ damage, critChance = 0, dodgeChance = 0 }: Partial<AttackStats> & { damage: number }, rng: RngFn): AttackResult {
  if (rng() < dodgeChance) {
    return { hit: false, damage: 0, crit: false };
  }
  const isCrit = rng() < critChance;
  const variance = 0.85 + rng() * 0.3;
  const finalDamage = Math.round(damage * variance * (isCrit ? 1.5 : 1));
  return { hit: true, damage: finalDamage, crit: isCrit };
}

export function tickStatuses(statuses: StatusEffect[]): { totalDamage: number; remaining: StatusEffect[] } {
  let totalDamage = 0;
  const remaining: StatusEffect[] = [];
  for (const status of statuses) {
    totalDamage += status.damagePerTick;
    const turnsRemaining = status.turnsRemaining - 1;
    if (turnsRemaining > 0) remaining.push({ ...status, turnsRemaining });
  }
  return { totalDamage, remaining };
}
```

- [ ] **Step 4: Convert `src/ai.ts`**

```typescript
import { aStar } from './pathfinding.js';
import type { Floor, MonsterAction } from './types.js';
import type { Monster, Player } from './entities.js';

function chebyshev(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function stepAwayFrom(monster: Monster, player: Player): { x: number; y: number } {
  const dx = Math.sign(monster.x - player.x) || (Math.random() < 0.5 ? 1 : -1);
  const dy = Math.sign(monster.y - player.y) || (Math.random() < 0.5 ? 1 : -1);
  return { x: monster.x + dx, y: monster.y + dy };
}

export type CanSeeFn = (mx: number, my: number, px: number, py: number) => boolean;

export function decideMonsterAction(monster: Monster, player: Player, floor: Floor, canSee: CanSeeFn): MonsterAction {
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

- [ ] **Step 5: Delete old `.js` versions, typecheck, and run tests**

```bash
rm src/entities.js src/pathfinding.js src/combat.js src/ai.js
```

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: typecheck passes; all 32 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/entities.ts src/pathfinding.ts src/combat.ts src/ai.ts
git rm src/entities.js src/pathfinding.js src/combat.js src/ai.js
git commit -m "Convert entities, pathfinding, combat, ai to TypeScript"
```

---

### Task 5: Convert `items`, `save` to TypeScript

**Files:**
- Create: `src/items.ts`, `src/save.ts`
- Delete: `src/items.js`, `src/save.js`

**Interfaces:**
- Consumes: `RngFn`, `Affix`, `BaseItem`, `Item`, `LootTableEntry` from `src/types.ts`.
- Produces: same runtime shapes as v1, typed. `MetaProgression` interface added to `src/types.ts` in this task since `save.ts` is where it's first needed.

- [ ] **Step 1: Add `MetaProgression` to `src/types.ts`**

```typescript
// append to src/types.ts
export interface MetaProgression {
  currency: number;
  unlockedClasses: string[];
  unlockedPerks: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
```

- [ ] **Step 2: Convert `src/items.ts`**

```typescript
import type { RngFn, Affix, BaseItem, Item, LootTableEntry } from './types.js';

export const RARITY = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type Rarity = typeof RARITY[number];

export const RARITY_AFFIX_COUNT: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

interface AffixDef {
  key: string;
  label: string;
  roll: (rng: RngFn, tier: number) => number;
}

const AFFIX_POOL: AffixDef[] = [
  { key: 'damage', label: 'of Force', roll: (rng, tier) => Math.ceil((1 + rng() * 3) * tier) },
  { key: 'critChance', label: 'of Precision', roll: (rng, tier) => +(0.02 + rng() * 0.03 * tier).toFixed(2) },
  { key: 'resistance', label: 'of Warding', roll: (rng, tier) => +(0.05 + rng() * 0.1 * tier).toFixed(2) },
];

export function rollAffixes(rarity: Rarity, rng: RngFn, tierMultiplier = 1): Affix[] {
  const count = RARITY_AFFIX_COUNT[rarity];
  const pool = [...AFFIX_POOL];
  const affixes: Affix[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const pickIndex = Math.floor(rng() * pool.length);
    const def = pool.splice(pickIndex, 1)[0]!;
    affixes.push({ key: def.key, label: def.label, value: def.roll(rng, tierMultiplier) });
  }
  return affixes;
}

export function generateItem(baseItem: BaseItem, rarity: Rarity, rng: RngFn, floorDepth: number): Item {
  const tierMultiplier = 1 + floorDepth * 0.15;
  const identifiable = baseItem.type === 'weapon' || baseItem.type === 'armor';
  return {
    ...baseItem,
    rarity,
    affixes: identifiable ? rollAffixes(rarity, rng, tierMultiplier) : [],
    identified: identifiable,
  };
}

export function rollLootTable(table: LootTableEntry[], rng: RngFn): LootTableEntry {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of table) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return table[table.length - 1]!;
}
```

- [ ] **Step 3: Convert `src/save.ts`**

```typescript
import type { MetaProgression, StorageLike } from './types.js';

const SAVE_KEY = 'voidcrawler-meta-v1';

const DEFAULT_META: MetaProgression = {
  currency: 0,
  unlockedClasses: ['adventurer'],
  unlockedPerks: [],
};

export function loadMeta(storage: StorageLike = globalThis.localStorage): MetaProgression {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta: MetaProgression, storage: StorageLike = globalThis.localStorage): void {
  storage.setItem(SAVE_KEY, JSON.stringify(meta));
}

export function applyRunResult(
  meta: MetaProgression, { floorReached, kills }: { floorReached: number; kills: number },
): { updated: MetaProgression; earned: number } {
  const earned = floorReached * 10 + kills * 2;
  return { updated: { ...meta, currency: meta.currency + earned }, earned };
}
```

- [ ] **Step 4: Delete old `.js` versions, typecheck, and run tests**

```bash
rm src/items.js src/save.js
```

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: typecheck passes; all 32 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/items.ts src/save.ts
git rm src/items.js src/save.js
git commit -m "Convert items, save to TypeScript"
```

---

### Task 6: Convert `fx`, `ui` to TypeScript

**Files:**
- Create: `src/fx.ts`, `src/ui.ts`
- Delete: `src/fx.js`, `src/ui.js`

**Interfaces:**
- Consumes: `Floor` from `src/types.ts`; `Player` from `src/entities.ts` (type-only).
- Produces: same runtime shapes as v1, typed, including the `FxState` interface `main.ts` (Task 7) will use for its module-level `fxState` object.

- [ ] **Step 1: Add `FxState` to `src/types.ts`**

```typescript
// append to src/types.ts
export interface ShakeState { intensity: number; duration: number; elapsed: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; }
export interface FloatingText { x: number; y: number; text: string; color: string; life: number; vy: number; }
export interface TweenState<T = { x: number; y: number }> { from: T; to: T; duration: number; elapsed: number; }
export interface FxState {
  shake: ShakeState | null;
  particles: Particle[];
  floatingTexts: FloatingText[];
}
```

- [ ] **Step 2: Convert `src/fx.ts`**

```typescript
import type { RngFn, ShakeState, Particle, FloatingText, TweenState, FxState } from './types.js';

export function createShake(intensity: number, duration: number): ShakeState {
  return { intensity, duration, elapsed: 0 };
}

export function updateShake(shake: ShakeState | null, dt: number): ShakeState | null {
  if (!shake) return null;
  shake.elapsed += dt;
  return shake.elapsed >= shake.duration ? null : shake;
}

export function getShakeOffset(shake: ShakeState | null): { x: number; y: number } {
  if (!shake) return { x: 0, y: 0 };
  const progress = 1 - shake.elapsed / shake.duration;
  const magnitude = shake.intensity * progress;
  return { x: (Math.random() * 2 - 1) * magnitude, y: (Math.random() * 2 - 1) * magnitude };
}

export function createParticleBurst(x: number, y: number, count: number, rng: RngFn): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 20 + rng() * 40;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 });
  }
  return particles;
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  return particles
    .map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt }))
    .filter(p => p.life > 0);
}

export function createFloatingText(x: number, y: number, text: string, color: string): FloatingText {
  return { x, y, text, color, life: 0.8, vy: -30 };
}

export function updateFloatingTexts(texts: FloatingText[], dt: number): FloatingText[] {
  return texts
    .map(t => ({ ...t, y: t.y + t.vy * dt, life: t.life - dt }))
    .filter(t => t.life > 0);
}

export function createTween(from: { x: number; y: number }, to: { x: number; y: number }, duration: number): TweenState {
  return { from, to, duration, elapsed: 0 };
}

export function updateTween(tween: TweenState | null, dt: number): TweenState | null {
  if (!tween) return null;
  tween.elapsed += dt;
  return tween.elapsed >= tween.duration ? null : tween;
}

export function getTweenPosition(tween: TweenState | null): { x: number; y: number } | null {
  if (!tween) return null;
  const t = Math.min(1, tween.elapsed / tween.duration);
  return {
    x: tween.from.x + (tween.to.x - tween.from.x) * t,
    y: tween.from.y + (tween.to.y - tween.from.y) * t,
  };
}

export function drawFx(ctx: CanvasRenderingContext2D, fxState: FxState): void {
  for (const p of fxState.particles) {
    ctx.fillStyle = '#e06030';
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  for (const t of fxState.floatingTexts) {
    ctx.globalAlpha = Math.max(0, t.life / 0.8);
    ctx.fillStyle = t.color;
    ctx.font = '12px monospace';
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1.0;
  }
}
```

Note: `drawFx`'s v1 signature took an unused third `tileSize` parameter — dropped here since TypeScript's `noUnusedParameters` would otherwise fail the build; the caller in `main.ts` (Task 7) calls `drawFx(ctx, fxState)`.

- [ ] **Step 3: Convert `src/ui.ts`**

```typescript
import type { Floor } from './types.js';
import type { Player } from './entities.js';

export function renderHUD(player: Player, floor: Floor): void {
  const hud = document.getElementById('hud')!;
  const weapon = player.equipment.weapon ? player.equipment.weapon.name : 'Fists';
  const armor = player.equipment.armor ? player.equipment.armor.name : 'None';
  hud.innerHTML = [
    `HP ${player.hp}/${player.maxHp}  Lv ${player.level}`,
    `Floor ${floor.depth}`,
    `Weapon: ${weapon}  Armor: ${armor}`,
    player.statPoints > 0 ? `Unspent stat points: ${player.statPoints} (press 'p' to add STR)` : '',
  ].join('<br>');
}

export function renderInventory(player: Player, isOpen: boolean): void {
  const panel = document.getElementById('inventory-panel')!;
  panel.classList.toggle('hidden', !isOpen);
  if (!isOpen) return;
  const rows = player.inventory.map((item, i) => {
    const label = item.identified ? `${item.name} (${item.rarity})` : item.name;
    return `${i + 1}. ${label}`;
  });
  panel.innerHTML = `<b>Inventory (i to close, 1-9 to use/equip)</b><br>${rows.join('<br>') || '(empty)'}`;
}

export function renderCombatLog(combatLog: string[]): void {
  document.getElementById('combat-log')!.textContent = combatLog.join('\n');
}

const MINIMAP_TILE_SIZE = 4;

export function renderMinimap(ctx: CanvasRenderingContext2D, floor: Floor, player: Player, explored: Set<string>): void {
  const originX = ctx.canvas.width - MINIMAP_TILE_SIZE * floor.width - 8;
  const originY = 8;
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(
    originX - 4, originY - 4,
    MINIMAP_TILE_SIZE * floor.width + 8, MINIMAP_TILE_SIZE * floor.height + 8,
  );
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!explored.has(`${x},${y}`)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = tile === 0 ? '#222' : '#666';
      ctx.fillRect(originX + x * MINIMAP_TILE_SIZE, originY + y * MINIMAP_TILE_SIZE, MINIMAP_TILE_SIZE - 1, MINIMAP_TILE_SIZE - 1);
    }
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(originX + player.x * MINIMAP_TILE_SIZE, originY + player.y * MINIMAP_TILE_SIZE, MINIMAP_TILE_SIZE - 1, MINIMAP_TILE_SIZE - 1);
}
```

- [ ] **Step 4: Delete old `.js` versions and typecheck**

```bash
rm src/fx.js src/ui.js
```

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: typecheck passes; all 32 tests pass (fx/ui have no dedicated test files in v1 — this just confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/fx.ts src/ui.ts
git rm src/fx.js src/ui.js
git commit -m "Convert fx, ui to TypeScript"
```

---

### Task 7: Convert `main.ts`, update `index.html` for Vite, verify dev + build

**Files:**
- Create: `src/main.ts`
- Delete: `src/main.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: every module converted in Tasks 3–6.
- Produces: nothing further consumed elsewhere — this is the entry point.

- [ ] **Step 1: Convert `src/main.ts`**

Take the full v1 `src/main.js` (as it stood at the end of the v1 implementation plan, including combat/AI/items/UI/fx/save/multi-floor/boss wiring) and apply these mechanical changes for TypeScript:
- `const canvas = document.getElementById('game-canvas');` → `const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;`
- `const ctx = canvas.getContext('2d');` → `const ctx = canvas.getContext('2d')!;`
- `let floor, monsters, explored, visible;` → `let floor: Floor; let monsters: Monster[]; let explored: Set<string>; let visible: Set<string>;` (add `import type { Floor } from './types.js';`)
- `const traps = new Map();` → `const traps = new Map<string, { damage: number; ownerName: string }>();`
- `const groundItems = new Map();` → `const groundItems = new Map<string, Item>();` (add `import type { Item } from './types.js';`)
- `const combatLog = [];` → `const combatLog: string[] = [];`
- `function log(message) {` → `function log(message: string): void {`
- `function isWalkable(x, y) {` → `function isWalkable(x: number, y: number): boolean {`
- `function monsterAt(x, y) {` → `function monsterAt(x: number, y: number): Monster | undefined {`
- `function canSeeBetween(x1, y1, x2, y2) {` → `function canSeeBetween(x1: number, y1: number, x2: number, y2: number): boolean {`
- `function maybeDropLoot(x, y) {` → `function maybeDropLoot(x: number, y: number): void {`
- `function pickUpItemUnderPlayer() {` → `function pickUpItemUnderPlayer(): void {`
- `function equipOrUseItem(index) {` → `function equipOrUseItem(index: number): void {`
- `function playerAttack(target) {` → `function playerAttack(target: Monster): void {`
- `function monsterTurn(monster) {` → `function monsterTurn(monster: Monster): void {`
- `function endRun(state) {` → `function endRun(state: 'dead' | 'victory'): void {` and change `let gameState = 'playing';` to `let gameState: 'playing' | 'dead' | 'victory' = 'playing';`
- `function triggerTrapUnderPlayer() {` → `function triggerTrapUnderPlayer(): void {`
- `function tickPlayerStatuses() {` → `function tickPlayerStatuses(): void {`
- `function checkPlayerDeath() {` → `function checkPlayerDeath(): boolean {`
- `function takeTurn(playerAction) {` → `function takeTurn(playerAction: () => void): void {`
- `function tryMovePlayer(dx, dy) {` → `function tryMovePlayer(dx: number, dy: number): void {`
- `function startFloor(depth) {` → `function startFloor(depth: number): void {`
- `window.addEventListener('keydown', (e) => {` → `window.addEventListener('keydown', (e: KeyboardEvent) => {`
- `function render() {` / `function loop() {` → `function render(): void {` / `function loop(): void {`
- `drawFx(ctx, fxState, TILE_SIZE);` → `drawFx(ctx, fxState);` (matches Task 6's simplified `drawFx` signature — the `TILE_SIZE` argument was unused in v1 and dropped)
- Add `import type { Monster } from './entities.js';` alongside the existing `import { Player, Monster } from './entities.js';` — **do not duplicate the import**; `Monster` is already imported as a value (it's a class, used both as a type and a constructor), so no separate type-only import is needed for it. Only add type-only imports for `Floor` and `Item`, which are pure type declarations with no runtime export.

Everything else — the actual game logic (turn scheduling, combat resolution, AI wiring, itemization, UI calls, fx triggers, save/death/victory flow, multi-floor/boss descent) — is copied verbatim from the finished v1 `src/main.js`. This task adds type annotations; it does not change behavior.

- [ ] **Step 2: Delete old `src/main.js`**

```bash
rm src/main.js
```

- [ ] **Step 3: Update `index.html` for Vite's module entry convention**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Voidcrawler</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="game-root">
    <canvas id="game-canvas"></canvas>
    <div id="hud"></div>
    <div id="inventory-panel" class="hidden"></div>
    <div id="combat-log"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

(Only two lines changed from v1: the stylesheet and script `src` gain a leading `/` since Vite serves from the project root, and the script now points at `main.ts` directly — Vite transpiles TS on the fly in dev and via `tsc -b` + esbuild in the production build.)

- [ ] **Step 4: Typecheck**

Run: `cd ~/voidcrawler && npx tsc --noEmit`
Expected: zero errors across the whole `src/` tree.

- [ ] **Step 5: Run the full test suite**

Run: `cd ~/voidcrawler && npx vitest run`
Expected: 32/32 tests pass.

- [ ] **Step 6: Verify the dev server serves a working game**

Run: `cd ~/voidcrawler && npx vite --port 8766 &` (background)
Open `http://localhost:8766/` in a browser.
Expected: identical behavior to the v1 game — dungeon renders, arrow keys move the player, combat/items/UI/fx/floor-descent all work exactly as they did at the end of the v1 implementation plan. No console errors.

- [ ] **Step 7: Verify the production build works**

Run: `cd ~/voidcrawler && npm run build && npx vite preview --port 8767 &` (background)
Open `http://localhost:8767/` in a browser.
Expected: same as Step 6, now served from the built `dist/` output instead of the dev server — confirms the build pipeline itself produces a working artifact (this is what GitHub Pages will serve in Phase E).

- [ ] **Step 8: Commit**

```bash
git add src/main.ts index.html
git rm src/main.js
git commit -m "Convert main.ts, wire up Vite entry point"
```

- [ ] **Step 9: Update the v1 static test-serving instructions that are now obsolete**

The `python3 -m http.server` workflow from the v1 plan no longer applies — `npm run dev` (Vite) is now the way to run the game locally. No file changes needed for this step; it's a note for whoever runs Phase B onward: use `npm run dev`, not `python3 -m http.server`.

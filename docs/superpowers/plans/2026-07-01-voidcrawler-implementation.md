# Voidcrawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Voidcrawler, a browser-based procedural roguelike dungeon crawler with real FOV, tactical turn-based combat, enemy AI, itemization, and permadeath meta-progression — zero frameworks, zero build step.

**Architecture:** Vanilla ES modules + Canvas 2D, split by responsibility (dungeon generation, FOV, entities, pathfinding, AI, combat, items, save, fx, ui), orchestrated by a single `Game` object in `main.js` that owns all run state and drives a `requestAnimationFrame` loop. Deterministic logic (dungeon connectivity, combat math) gets real unit tests via Node's built-in `node:test`; rendering/input/UI is verified by playing the game in a browser.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5 Canvas 2D, `localStorage`, Node.js built-in `node:test` + `node:assert/strict` for unit tests (no external test framework/dependency).

## Global Constraints

- No frameworks, no bundler, no backend — plain ES modules loaded directly by the browser.
- Runs via a static file server (e.g. `python3 -m http.server`) to satisfy ES module CORS rules — never `file://`.
- Keyboard-only input; no touch/mobile controls in v1.
- Permadeath only — no mid-run save/resume. Only meta-progression (currency, unlocked classes/perks) persists, via `localStorage`.
- No sound/music in v1.
- Exactly 3 monster archetypes, at most 4 item rarity tiers, 8 regular floors + 1 boss floor — do not add more without a spec update.
- Grid dimensions: `GRID_WIDTH = 60`, `GRID_HEIGHT = 34`, `TILE_SIZE = 24` (pixels) — defined once in `src/data.js` and imported everywhere else that needs them.

---

### Task 1: Project scaffold + render loop

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `src/data.js`
- Create: `src/main.js`

**Interfaces:**
- Produces (`src/data.js`): `TILE_SIZE = 24`, `GRID_WIDTH = 60`, `GRID_HEIGHT = 34` (exported numeric constants, consumed by every later task that touches the grid or canvas).
- Produces (`src/main.js`): a running `requestAnimationFrame` loop that clears and redraws the canvas every frame. No other module imports `main.js` — it is the entry point.

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Voidcrawler</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-root">
    <canvas id="game-canvas"></canvas>
    <div id="hud"></div>
    <div id="inventory-panel" class="hidden"></div>
    <div id="combat-log"></div>
  </div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `style.css`**

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #0a0a0f;
  color: #d8d8e0;
  font-family: 'Courier New', monospace;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
#game-root { position: relative; }
#game-canvas { background: #000; display: block; image-rendering: pixelated; }
#hud {
  position: absolute; top: 8px; left: 8px;
  font-size: 14px; line-height: 1.4;
  text-shadow: 1px 1px 2px #000;
}
#combat-log {
  position: absolute; bottom: 8px; left: 8px;
  font-size: 12px; max-width: 340px; max-height: 90px;
  overflow: hidden; opacity: 0.85;
}
#inventory-panel {
  position: absolute; top: 8px; right: 8px;
  background: rgba(10, 10, 20, 0.92);
  border: 1px solid #444; padding: 8px; font-size: 12px;
  min-width: 200px;
}
.hidden { display: none; }
```

- [ ] **Step 3: Create `src/data.js`**

```javascript
export const TILE_SIZE = 24;
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 34;
```

- [ ] **Step 4: Create `src/main.js` with a minimal render loop**

```javascript
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from './data.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3a3a4a';
  ctx.font = '16px monospace';
  ctx.fillText('Voidcrawler booting...', 20, 30);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 5: Manually verify in browser**

Run: `cd ~/voidcrawler && python3 -m http.server 8765`
Open `http://localhost:8765/` in a browser.
Expected: a black canvas (1440x816) with the text "Voidcrawler booting..." in the top-left, no console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css src/data.js src/main.js
git commit -m "Add project scaffold and render loop"
```

---

### Task 2: Seeded RNG utility

**Files:**
- Create: `src/rng.js`
- Test: `tests/rng.test.js`

**Interfaces:**
- Produces: `createRng(seed: number): () => number` — returns a function producing floats in `[0, 1)`. Same seed always produces the same sequence. Consumed by `dungeon.js`, `items.js`, `combat.js` (in the running game, not tests — tests use their own stub rngs), and `main.js`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/rng.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';

test('same seed produces same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds produce different sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a(), b());
});

test('values stay within [0, 1)', () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/rng.test.js`
Expected: FAIL — `src/rng.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```javascript
// src/rng.js
export function createRng(seed) {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/rng.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/rng.js tests/rng.test.js
git commit -m "Add seeded RNG utility"
```

---

### Task 3: BSP dungeon generation

**Files:**
- Create: `src/dungeon.js`
- Test: `tests/dungeon.test.js`

**Interfaces:**
- Consumes: `GRID_WIDTH`, `GRID_HEIGHT` from `src/data.js`; a `rng()` function from `src/rng.js` (in real usage — tests pass their own `createRng`).
- Produces: `TILE = { WALL: 0, FLOOR: 1, STAIRS_DOWN: 2 }`; `class Room { constructor(x, y, w, h); center(): {x, y} }`; `idx(x, y, width): number`; `generateFloor(depth, rng, width = GRID_WIDTH, height = GRID_HEIGHT): { grid: Uint8Array, width, height, rooms: Room[], depth, stairsDown: {x, y} }`; `isFullyConnected(floor): boolean`. Consumed by `fov.js`, `pathfinding.js`, `entities.js` spawn logic, and `main.js`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/dungeon.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dungeon.test.js`
Expected: FAIL — `src/dungeon.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```javascript
// src/dungeon.js
export const TILE = { WALL: 0, FLOOR: 1, STAIRS_DOWN: 2 };

export function idx(x, y, width) {
  return y * width + x;
}

export class Room {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  center() {
    return { x: Math.floor(this.x + this.w / 2), y: Math.floor(this.y + this.h / 2) };
  }
}

function splitBSP(x, y, w, h, rng, minSize, depth) {
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

function carveRoom(grid, width, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[idx(x, y, width)] = TILE.FLOOR;
    }
  }
}

function carveCorridor(grid, width, from, to) {
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

export function generateFloor(depth, rng, width, height) {
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
    carveCorridor(grid, width, rooms[i - 1].center(), rooms[i].center());
  }

  const stairsRoom = rooms[rooms.length - 1];
  const stairsDown = stairsRoom.center();
  grid[idx(stairsDown.x, stairsDown.y, width)] = TILE.STAIRS_DOWN;

  return { grid, width, height, rooms, depth, stairsDown };
}

export function isFullyConnected(floor) {
  const { grid, width, height, rooms } = floor;
  if (rooms.length === 0) return true;
  const start = rooms[0].center();
  const seen = new Set([idx(start.x, start.y, width)]);
  const stack = [start];
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const { x, y } = stack.pop();
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

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dungeon.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/dungeon.js tests/dungeon.test.js
git commit -m "Add BSP dungeon generation with connectivity guarantee"
```

---

### Task 4: Recursive shadowcasting FOV

**Files:**
- Create: `src/fov.js`
- Test: `tests/fov.test.js`

**Interfaces:**
- Consumes: a `floor` object shaped like `generateFloor()`'s return value (`{ grid, width, height }`) and `TILE.WALL` from `src/dungeon.js`.
- Produces: `computeFOV(floor, originX, originY, radius): Set<string>` where each entry is the string `` `${x},${y}` `` for a visible tile. Consumed by `main.js` (player vision) and `ai.js` (monster line-of-sight).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/fov.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fov.test.js`
Expected: FAIL — `src/fov.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```javascript
// src/fov.js
import { TILE, idx } from './dungeon.js';

const OCTANTS = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
];

function castLight(floor, cx, cy, radius, visible, row, start, end, xx, xy, yx, yy) {
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

export function computeFOV(floor, originX, originY, radius) {
  const visible = new Set([`${originX},${originY}`]);
  for (const [xx, xy, yx, yy] of OCTANTS) {
    castLight(floor, originX, originY, radius, visible, 1, 1.0, 0.0, xx, xy, yx, yy);
  }
  return visible;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/fov.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fov.js tests/fov.test.js
git commit -m "Add recursive shadowcasting field-of-view"
```

---

### Task 5: Render dungeon + fog to canvas

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `generateFloor`, `TILE` from `src/dungeon.js`; `computeFOV` from `src/fov.js`; `createRng` from `src/rng.js`; `TILE_SIZE` from `src/data.js`.
- Produces: `main.js` now holds a module-level `game` state object with `{ floor, explored: Set<string>, visible: Set<string> }`, drawn every frame. No exported interface (entry point).

- [ ] **Step 1: Replace the placeholder render loop in `src/main.js`**

```javascript
// src/main.js
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from './data.js';
import { generateFloor, TILE } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

const rng = createRng(Date.now() ^ 0x2f2f2f2f);
const floor = generateFloor(1, rng, GRID_WIDTH, GRID_HEIGHT);
const playerStart = floor.rooms[0].center();
const explored = new Set();
let visible = computeFOV(floor, playerStart.x, playerStart.y, 8);
for (const key of visible) explored.add(key);

const TILE_COLORS = {
  [TILE.WALL]: '#1c1c26',
  [TILE.FLOOR]: '#2e2e3a',
  [TILE.STAIRS_DOWN]: '#4a4a2e',
};

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = `${x},${y}`;
      if (!explored.has(key)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = TILE_COLORS[tile];
      ctx.globalAlpha = visible.has(key) ? 1.0 : 0.4;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(playerStart.x * TILE_SIZE + 4, playerStart.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 2: Manually verify in browser**

Run: `cd ~/voidcrawler && python3 -m http.server 8765` (if not already running)
Open `http://localhost:8765/`.
Expected: a procedurally generated dungeon layout is visible — rooms connected by corridors, a dim halo of explored-but-not-visible tiles around the fully-lit visible area, a yellow square marking the player's starting room, and a dark-yellow stairs-down tile somewhere on the map. Refreshing the page produces a different layout each time (uses `Date.now()` as seed).

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "Render dungeon and fog-of-war to canvas"
```

---

### Task 6: Entities — Player/Monster stats and leveling

**Files:**
- Create: `src/entities.js`
- Modify: `src/data.js`
- Test: `tests/entities.test.js`

**Interfaces:**
- Consumes: nothing external.
- Produces (`src/data.js` additions): `XP_TABLE: number[]`, `STARTING_CLASSES: { [id]: { id, name, baseHp, str, dex, vit } }`, `MONSTER_ARCHETYPES: { [id]: { id, name, hp, damage, critChance, dodgeChance, sightRange, ranged, range, fleeHpFraction, color, stationary?, trapRange?, trapDamage? } }` — `stationary`/`trapRange`/`trapDamage` are only set on the `trapper` archetype (Task 9's AI reads them to special-case its behavior).
- Produces (`src/entities.js`): `xpForNextLevel(level): number`; `class Player { x, y, hp, maxHp, level, xp, statPoints, str, dex, vit, inventory: [], equipment: { weapon, armor }, statuses: []; gainXp(amount): boolean; getAttackStats(): { damage, critChance, dodgeChance } }`; `class Monster { archetype, hp, maxHp, x, y, state, statuses: [], lastKnownPlayerPos; getAttackStats(): { damage, critChance, dodgeChance } }`. Consumed by `main.js`, `ai.js`, `combat.js` (via `getAttackStats()`).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/entities.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/entities.test.js`
Expected: FAIL — `src/entities.js` does not exist yet.

- [ ] **Step 3: Add stat tables to `src/data.js`**

```javascript
// append to src/data.js

export const XP_TABLE = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320];

export const STARTING_CLASSES = {
  adventurer: { id: 'adventurer', name: 'Adventurer', baseHp: 30, str: 5, dex: 5, vit: 5 },
};

export const MONSTER_ARCHETYPES = {
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
};
```

- [ ] **Step 4: Write `src/entities.js`**

```javascript
// src/entities.js
import { XP_TABLE } from './data.js';

export function xpForNextLevel(level) {
  if (level < XP_TABLE.length) return XP_TABLE[level];
  return XP_TABLE[XP_TABLE.length - 1] + (level - XP_TABLE.length + 1) * 100;
}

export class Player {
  constructor(startingClass) {
    this.maxHp = startingClass.baseHp;
    this.hp = this.maxHp;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.str = startingClass.str;
    this.dex = startingClass.dex;
    this.vit = startingClass.vit;
    this.inventory = [];
    this.equipment = { weapon: null, armor: null };
    this.x = 0;
    this.y = 0;
    this.statuses = [];
  }

  gainXp(amount) {
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

  getAttackStats() {
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
  constructor(archetype, x, y) {
    this.archetype = archetype;
    this.hp = archetype.hp;
    this.maxHp = archetype.hp;
    this.x = x;
    this.y = y;
    this.state = 'idle';
    this.statuses = [];
    this.lastKnownPlayerPos = null;
  }

  getAttackStats() {
    return {
      damage: this.archetype.damage,
      critChance: this.archetype.critChance,
      dodgeChance: this.archetype.dodgeChance,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/entities.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/entities.js src/data.js tests/entities.test.js
git commit -m "Add Player/Monster entities with leveling"
```

---

### Task 7: Player movement, input, and monster spawning

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `Player`, `Monster` from `src/entities.js`; `STARTING_CLASSES`, `MONSTER_ARCHETYPES` from `src/data.js`.
- Produces: `main.js` game state gains `player: Player`, `monsters: Monster[]`; keyboard arrow keys move the player one tile per keypress (bump into a wall = no-op), and FOV/explored recompute after every successful move.

- [ ] **Step 1: Update `src/main.js` to spawn the player and monsters, and wire input**

```javascript
// src/main.js
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, MONSTER_ARCHETYPES, STARTING_CLASSES } from './data.js';
import { generateFloor, TILE, idx } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';
import { Player, Monster } from './entities.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

const rng = createRng(Date.now() ^ 0x2f2f2f2f);
const floor = generateFloor(1, rng, GRID_WIDTH, GRID_HEIGHT);

const player = new Player(STARTING_CLASSES.adventurer);
const start = floor.rooms[0].center();
player.x = start.x;
player.y = start.y;

const archetypeIds = Object.keys(MONSTER_ARCHETYPES);
const monsters = floor.rooms.slice(1).map((room, i) => {
  const c = room.center();
  const archetype = MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]];
  return new Monster(archetype, c.x, c.y);
});

const explored = new Set();
let visible = computeFOV(floor, player.x, player.y, 8);
for (const key of visible) explored.add(key);

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return floor.grid[idx(x, y, floor.width)] !== TILE.WALL;
}

function tryMovePlayer(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!isWalkable(nx, ny)) return;
  player.x = nx;
  player.y = ny;
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
}

const KEY_MOVES = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

window.addEventListener('keydown', (e) => {
  const move = KEY_MOVES[e.key];
  if (move) {
    e.preventDefault();
    tryMovePlayer(move[0], move[1]);
  }
});

const TILE_COLORS = {
  [TILE.WALL]: '#1c1c26',
  [TILE.FLOOR]: '#2e2e3a',
  [TILE.STAIRS_DOWN]: '#4a4a2e',
};

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = `${x},${y}`;
      if (!explored.has(key)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = TILE_COLORS[tile];
      ctx.globalAlpha = visible.has(key) ? 1.0 : 0.4;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
  ctx.globalAlpha = 1.0;
  for (const m of monsters) {
    const key = `${m.x},${m.y}`;
    if (!visible.has(key)) continue;
    ctx.fillStyle = m.archetype.color;
    ctx.fillRect(m.x * TILE_SIZE + 4, m.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(player.x * TILE_SIZE + 4, player.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 2: Manually verify in browser**

Run: `cd ~/voidcrawler && python3 -m http.server 8765` (if not already running)
Open `http://localhost:8765/`, refresh to load the update.
Expected: arrow keys move the yellow player square one tile at a time; walking into a wall does nothing (no error, no movement); colored monster squares (red/blue/green) appear once they're within the visible FOV area; fog updates as you move.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "Add player movement, input handling, and monster spawning"
```

---

### Task 8: Combat resolution

**Files:**
- Create: `src/combat.js`
- Test: `tests/combat.test.js`

**Interfaces:**
- Consumes: nothing external — pure functions operating on plain data.
- Produces: `resolveAttack(stats: { damage: number, critChance?: number, dodgeChance?: number }, rng: () => number): { hit: boolean, damage: number, crit: boolean }`; `tickStatuses(statuses: Array<{ damagePerTick, turnsRemaining }>): { totalDamage: number, remaining: Array }`. Consumed by `main.js`'s turn scheduler (Task 10).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/combat.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttack, tickStatuses } from '../src/combat.js';

function stubRng(values) {
  const queue = [...values];
  return () => (queue.length ? queue.shift() : 0.5);
}

test('attack is dodged when the dodge roll succeeds', () => {
  const result = resolveAttack({ damage: 10, critChance: 0, dodgeChance: 0.5 }, stubRng([0.1]));
  assert.equal(result.hit, false);
  assert.equal(result.damage, 0);
});

test('attack hits and is not a crit when both rolls fail', () => {
  const result = resolveAttack({ damage: 10, critChance: 0.2, dodgeChance: 0.1 }, stubRng([0.9, 0.9, 0.5]));
  assert.equal(result.hit, true);
  assert.equal(result.crit, false);
  assert.ok(result.damage >= 8 && result.damage <= 12, `damage ${result.damage} out of expected variance range`);
});

test('a crit hit deals roughly 1.5x damage', () => {
  const noCrit = resolveAttack({ damage: 10, critChance: 1, dodgeChance: 0 }, stubRng([0.9, 0.0, 0.5]));
  assert.equal(noCrit.crit, true);
  assert.equal(noCrit.damage, Math.round(10 * 1.0 * 1.5));
});

test('tickStatuses sums damage and expires statuses at zero turns remaining', () => {
  const statuses = [
    { damagePerTick: 2, turnsRemaining: 1 },
    { damagePerTick: 3, turnsRemaining: 2 },
  ];
  const { totalDamage, remaining } = tickStatuses(statuses);
  assert.equal(totalDamage, 5);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].turnsRemaining, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/combat.test.js`
Expected: FAIL — `src/combat.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```javascript
// src/combat.js
export function resolveAttack({ damage, critChance = 0, dodgeChance = 0 }, rng) {
  if (rng() < dodgeChance) {
    return { hit: false, damage: 0, crit: false };
  }
  const isCrit = rng() < critChance;
  const variance = 0.85 + rng() * 0.3;
  const finalDamage = Math.round(damage * variance * (isCrit ? 1.5 : 1));
  return { hit: true, damage: finalDamage, crit: isCrit };
}

export function tickStatuses(statuses) {
  let totalDamage = 0;
  const remaining = [];
  for (const status of statuses) {
    totalDamage += status.damagePerTick;
    const turnsRemaining = status.turnsRemaining - 1;
    if (turnsRemaining > 0) remaining.push({ ...status, turnsRemaining });
  }
  return { totalDamage, remaining };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/combat.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "Add combat resolution math with crit/dodge/status effects"
```

---

### Task 9: A* pathfinding and enemy AI FSM

**Files:**
- Create: `src/pathfinding.js`
- Create: `src/ai.js`
- Test: `tests/pathfinding.test.js`
- Test: `tests/ai.test.js`

**Interfaces:**
- Consumes (`pathfinding.js`): a `floor`-shaped object (`{ grid, width, height }`) and `TILE.WALL` from `src/dungeon.js`.
- Produces (`pathfinding.js`): `aStar(start: {x,y}, goal: {x,y}, floor): Array<{x,y}> | null` — path includes both `start` and `goal`; `null` if unreachable.
- Consumes (`ai.js`): `aStar` from `src/pathfinding.js`.
- Produces (`ai.js`): `decideMonsterAction(monster, player, floor, canSee: (mx,my,px,py) => boolean): { type: 'move'|'attack'|'rangedAttack'|'placeTrap'|'wait', to?: {x,y}, target?: player, at?: {x,y} }`. Mutates `monster.state` and `monster.lastKnownPlayerPos` as a side effect (this is intentional — the FSM state lives on the monster). An archetype with `stationary: true` (the `trapper`) never returns `move` — it returns `placeTrap` (with `at` set to the tile one step from itself toward the player) when the player is within `trapRange` but not adjacent, `attack` when adjacent, and `wait` otherwise. Consumed by `main.js`'s turn scheduler (Task 10), which handles the `placeTrap` action type alongside `move`/`attack`/`rangedAttack`.

- [ ] **Step 1: Write the failing pathfinding test**

```javascript
// tests/pathfinding.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aStar } from '../src/pathfinding.js';
import { TILE, idx } from '../src/dungeon.js';

function openFloor(width, height) {
  return { grid: new Uint8Array(width * height).fill(TILE.FLOOR), width, height };
}

test('finds a straight path in an open floor', () => {
  const floor = openFloor(10, 10);
  const path = aStar({ x: 0, y: 0 }, { x: 3, y: 0 }, floor);
  assert.ok(path);
  assert.equal(path.length, 4);
  assert.deepEqual(path[0], { x: 0, y: 0 });
  assert.deepEqual(path[path.length - 1], { x: 3, y: 0 });
});

test('routes around an obstacle', () => {
  const floor = openFloor(10, 10);
  for (let y = 0; y < 8; y++) floor.grid[idx(3, y, 10)] = TILE.WALL;
  const path = aStar({ x: 0, y: 0 }, { x: 6, y: 0 }, floor);
  assert.ok(path);
  assert.ok(path.every(p => floor.grid[idx(p.x, p.y, 10)] !== TILE.WALL));
});

test('returns null when the goal is fully enclosed', () => {
  const floor = openFloor(10, 10);
  for (let x = 3; x <= 5; x++) {
    floor.grid[idx(x, 3, 10)] = TILE.WALL;
    floor.grid[idx(x, 5, 10)] = TILE.WALL;
  }
  for (let y = 3; y <= 5; y++) {
    floor.grid[idx(3, y, 10)] = TILE.WALL;
    floor.grid[idx(5, y, 10)] = TILE.WALL;
  }
  const path = aStar({ x: 0, y: 0 }, { x: 4, y: 4 }, floor);
  assert.equal(path, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pathfinding.test.js`
Expected: FAIL — `src/pathfinding.js` does not exist yet.

- [ ] **Step 3: Write `src/pathfinding.js`**

```javascript
// src/pathfinding.js
import { TILE, idx } from './dungeon.js';

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function aStar(start, goal, floor) {
  const key = (p) => `${p.x},${p.y}`;
  const open = new Map([[key(start), start]]);
  const cameFrom = new Map();
  const gScore = new Map([[key(start), 0]]);
  const fScore = new Map([[key(start), heuristic(start, goal)]]);

  while (open.size > 0) {
    let currentKey = null;
    let current = null;
    let best = Infinity;
    for (const [k, node] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < best) { best = f; currentKey = k; current = node; }
    }

    if (current.x === goal.x && current.y === goal.y) {
      const path = [current];
      let k = currentKey;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k);
        path.unshift(prev);
        k = key(prev);
      }
      return path;
    }

    open.delete(currentKey);
    const neighbors = [
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

- [ ] **Step 4: Run pathfinding test to verify it passes**

Run: `node --test tests/pathfinding.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit pathfinding**

```bash
git add src/pathfinding.js tests/pathfinding.test.js
git commit -m "Add A* pathfinding"
```

- [ ] **Step 6: Write the failing AI test**

```javascript
// tests/ai.test.js
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
```

- [ ] **Step 7: Run test to verify it fails**

Run: `node --test tests/ai.test.js`
Expected: FAIL — `src/ai.js` does not exist yet.

- [ ] **Step 8: Write `src/ai.js`**

```javascript
// src/ai.js
import { aStar } from './pathfinding.js';

function chebyshev(x1, y1, x2, y2) {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function stepAwayFrom(monster, player, floor) {
  const dx = Math.sign(monster.x - player.x) || (Math.random() < 0.5 ? 1 : -1);
  const dy = Math.sign(monster.y - player.y) || (Math.random() < 0.5 ? 1 : -1);
  return { x: monster.x + dx, y: monster.y + dy };
}

export function decideMonsterAction(monster, player, floor, canSee) {
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
    if (dist <= monster.archetype.trapRange) {
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
    return { type: 'move', to: stepAwayFrom(monster, player, floor) };
  }

  return { type: 'wait' };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `node --test tests/ai.test.js`
Expected: PASS (6 tests)

- [ ] **Step 10: Commit AI**

```bash
git add src/ai.js tests/ai.test.js
git commit -m "Add enemy AI finite state machine"
```

---

### Task 10: Wire combat and AI into the turn scheduler

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `resolveAttack`, `tickStatuses` from `src/combat.js`; `decideMonsterAction` from `src/ai.js`; `computeFOV` from `src/fov.js`.
- Produces: pressing an arrow key into an occupied tile attacks instead of moving; after the player's action, every monster takes one action; dead monsters are removed and grant XP and increment a module-level `kills: number` counter (consumed by `applyRunResult` in Task 14); a text combat log accumulates in a module-level array `combatLog: string[]`; a module-level `traps: Map<string, {damage, ownerName}>` holds trap tiles placed by stationary monsters (the `trapper` archetype's `placeTrap` action), and the player takes `damage` and the trap is removed when they step onto a trapped tile; the player's own `statuses` array (from `entities.js`) ticks once per turn via `tickPlayerStatuses()`.

- [ ] **Step 1: Update `src/main.js` to resolve a full turn (player action + all monster actions)**

```javascript
// src/main.js — replace the input handler and add a turn scheduler
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, MONSTER_ARCHETYPES, STARTING_CLASSES } from './data.js';
import { generateFloor, TILE, idx } from './dungeon.js';
import { computeFOV } from './fov.js';
import { createRng } from './rng.js';
import { Player, Monster } from './entities.js';
import { resolveAttack, tickStatuses } from './combat.js';
import { decideMonsterAction } from './ai.js';

const canvas = document.getElementById('game-canvas');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;
const ctx = canvas.getContext('2d');

const rng = createRng(Date.now() ^ 0x2f2f2f2f);
const floor = generateFloor(1, rng, GRID_WIDTH, GRID_HEIGHT);

const player = new Player(STARTING_CLASSES.adventurer);
const start = floor.rooms[0].center();
player.x = start.x;
player.y = start.y;

const archetypeIds = Object.keys(MONSTER_ARCHETYPES);
let monsters = floor.rooms.slice(1).map((room, i) => {
  const c = room.center();
  const archetype = MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]];
  return new Monster(archetype, c.x, c.y);
});

const explored = new Set();
let visible = computeFOV(floor, player.x, player.y, 8);
for (const key of visible) explored.add(key);

const combatLog = [];
function log(message) {
  combatLog.push(message);
  if (combatLog.length > 6) combatLog.shift();
}

let kills = 0;
const traps = new Map(); // key "x,y" -> { damage, ownerName }

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return floor.grid[idx(x, y, floor.width)] !== TILE.WALL;
}

function monsterAt(x, y) {
  return monsters.find(m => m.x === x && m.y === y);
}

function canSeeBetween(x1, y1, x2, y2) {
  return computeFOV(floor, x1, y1, 8).has(`${x2},${y2}`);
}

function playerAttack(target) {
  const result = resolveAttack(player.getAttackStats(), rng);
  if (!result.hit) {
    log(`You miss the ${target.archetype.name}.`);
    return;
  }
  target.hp = Math.max(0, target.hp - result.damage);
  log(`You hit the ${target.archetype.name} for ${result.damage}${result.crit ? ' (crit!)' : ''}.`);
  if (target.hp === 0) {
    log(`The ${target.archetype.name} dies.`);
    monsters = monsters.filter(m => m !== target);
    kills += 1;
    player.gainXp(10);
  }
}

function monsterTurn(monster) {
  const { totalDamage, remaining } = tickStatuses(monster.statuses);
  monster.statuses = remaining;
  monster.hp = Math.max(0, monster.hp - totalDamage);
  if (monster.hp === 0) {
    monsters = monsters.filter(m => m !== monster);
    return;
  }

  const action = decideMonsterAction(monster, player, floor, canSeeBetween);
  if (action.type === 'attack' || action.type === 'rangedAttack') {
    const result = resolveAttack(monster.getAttackStats(), rng);
    if (!result.hit) {
      log(`The ${monster.archetype.name} misses you.`);
    } else {
      player.hp = Math.max(0, player.hp - result.damage);
      log(`The ${monster.archetype.name} hits you for ${result.damage}${result.crit ? ' (crit!)' : ''}.`);
    }
  } else if (action.type === 'move') {
    if (isWalkable(action.to.x, action.to.y) && !monsterAt(action.to.x, action.to.y)
        && !(action.to.x === player.x && action.to.y === player.y)) {
      monster.x = action.to.x;
      monster.y = action.to.y;
    }
  } else if (action.type === 'placeTrap') {
    const key = `${action.at.x},${action.at.y}`;
    if (isWalkable(action.at.x, action.at.y) && !monsterAt(action.at.x, action.at.y) && !traps.has(key)) {
      traps.set(key, { damage: monster.archetype.trapDamage, ownerName: monster.archetype.name });
    }
  }
}

function triggerTrapUnderPlayer() {
  const key = `${player.x},${player.y}`;
  const trap = traps.get(key);
  if (!trap) return;
  traps.delete(key);
  player.hp = Math.max(0, player.hp - trap.damage);
  log(`You trigger a trap set by the ${trap.ownerName}! You take ${trap.damage} damage.`);
}

function tickPlayerStatuses() {
  const { totalDamage, remaining } = tickStatuses(player.statuses);
  player.statuses = remaining;
  if (totalDamage > 0) {
    player.hp = Math.max(0, player.hp - totalDamage);
    log(`You take ${totalDamage} damage from lingering status effects.`);
  }
}

function takeTurn(playerAction) {
  tickPlayerStatuses();
  playerAction();
  triggerTrapUnderPlayer();
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
  for (const monster of [...monsters]) {
    monsterTurn(monster);
  }
}

function tryMovePlayer(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const occupant = monsterAt(nx, ny);
  if (occupant) {
    takeTurn(() => playerAttack(occupant));
    return;
  }
  if (!isWalkable(nx, ny)) return;
  takeTurn(() => { player.x = nx; player.y = ny; });
}

const KEY_MOVES = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

window.addEventListener('keydown', (e) => {
  const move = KEY_MOVES[e.key];
  if (move) {
    e.preventDefault();
    tryMovePlayer(move[0], move[1]);
  }
});

const TILE_COLORS = {
  [TILE.WALL]: '#1c1c26',
  [TILE.FLOOR]: '#2e2e3a',
  [TILE.STAIRS_DOWN]: '#4a4a2e',
};

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = `${x},${y}`;
      if (!explored.has(key)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = TILE_COLORS[tile];
      ctx.globalAlpha = visible.has(key) ? 1.0 : 0.4;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
  ctx.globalAlpha = 1.0;
  for (const [key, trap] of traps) {
    if (!visible.has(key)) continue;
    const [tx, ty] = key.split(',').map(Number);
    ctx.strokeStyle = '#d04040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx * TILE_SIZE + 5, ty * TILE_SIZE + 5);
    ctx.lineTo(tx * TILE_SIZE + TILE_SIZE - 5, ty * TILE_SIZE + TILE_SIZE - 5);
    ctx.moveTo(tx * TILE_SIZE + TILE_SIZE - 5, ty * TILE_SIZE + 5);
    ctx.lineTo(tx * TILE_SIZE + 5, ty * TILE_SIZE + TILE_SIZE - 5);
    ctx.stroke();
  }
  for (const m of monsters) {
    const key = `${m.x},${m.y}`;
    if (!visible.has(key)) continue;
    ctx.fillStyle = m.archetype.color;
    ctx.fillRect(m.x * TILE_SIZE + 4, m.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(player.x * TILE_SIZE + 4, player.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);

  const hud = document.getElementById('hud');
  hud.textContent = `HP ${player.hp}/${player.maxHp}  Lv ${player.level}  Floor ${floor.depth}`;
  document.getElementById('combat-log').textContent = combatLog.join('\n');
}

function loop() {
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 2: Manually verify in browser**

Run: `cd ~/voidcrawler && python3 -m http.server 8765` (if not already running)
Open `http://localhost:8765/`, refresh.
Expected: walking into a monster attacks it instead of moving onto its tile; the combat log at the bottom-left shows hit/miss/crit/death messages; once a monster is within its sight range it starts chasing the player each turn; the green trapper monster never moves from its spawn tile — once you're within its trap range but not adjacent, a red X trap mark appears on a nearby tile, and stepping on it damages you and removes it; killing a monster removes it and the HUD's level/HP updates on level-up; the HUD in the top-left shows `HP x/y  Lv n  Floor 1`.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "Wire combat resolution and enemy AI into the turn scheduler"
```

---

### Task 11: Itemization

**Files:**
- Create: `src/items.js`
- Modify: `src/data.js`
- Modify: `src/main.js`
- Test: `tests/items.test.js`

**Interfaces:**
- Consumes: nothing external — pure functions over plain data and an injected `rng`.
- Produces (`src/data.js` additions): `BASE_ITEMS: Array<{ id, type: 'weapon'|'armor'|'potion'|'scroll', name, baseDamage?, baseArmor? }>`; `getLootTableForFloor(depth): Array<{ itemId: string|null, weight: number }>` (an entry with `itemId: null` means "no drop").
- Produces (`src/items.js`): `RARITY: string[]`; `RARITY_AFFIX_COUNT: { [rarity]: number }`; `rollAffixes(rarity, rng, tierMultiplier): Array<{ key, label, value }>`; `generateItem(baseItem, rarity, rng, floorDepth): { ...baseItem, rarity, affixes, identified }`; `rollLootTable(table, rng): { itemId, weight }`. Consumed by `main.js` (monster death drops, floor item spawns) and `entities.js`'s `getAttackStats()` (already reads `item.affixes`, added in Task 6).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/items.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollAffixes, generateItem, rollLootTable, RARITY_AFFIX_COUNT } from '../src/items.js';

function stubRng(values) {
  const queue = [...values];
  return () => (queue.length ? queue.shift() : 0.999);
}

test('rollAffixes returns exactly the expected count per rarity, no duplicate keys', () => {
  for (const rarity of Object.keys(RARITY_AFFIX_COUNT)) {
    const rng = stubRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const affixes = rollAffixes(rarity, rng, 1);
    assert.equal(affixes.length, RARITY_AFFIX_COUNT[rarity]);
    const keys = affixes.map(a => a.key);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('generateItem marks weapons and armor as identified, potions/scrolls as not', () => {
  const rng = stubRng([0.1, 0.2, 0.3]);
  const weapon = generateItem({ id: 'sword', type: 'weapon', name: 'Sword', baseDamage: 5 }, 'common', rng, 1);
  const potion = generateItem({ id: 'potion', type: 'potion', name: 'Potion' }, 'common', rng, 1);
  assert.equal(weapon.identified, true);
  assert.equal(potion.identified, false);
});

test('rollLootTable respects weighted boundaries', () => {
  const table = [
    { itemId: 'a', weight: 1 },
    { itemId: 'b', weight: 9 },
  ];
  const pickLow = rollLootTable(table, stubRng([0.05]));
  const pickHigh = rollLootTable(table, stubRng([0.5]));
  assert.equal(pickLow.itemId, 'a');
  assert.equal(pickHigh.itemId, 'b');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/items.test.js`
Expected: FAIL — `src/items.js` does not exist yet.

- [ ] **Step 3: Add item content to `src/data.js`**

```javascript
// append to src/data.js

export const BASE_ITEMS = [
  { id: 'short-sword', type: 'weapon', name: 'Short Sword', baseDamage: 4 },
  { id: 'long-sword', type: 'weapon', name: 'Long Sword', baseDamage: 6 },
  { id: 'leather-armor', type: 'armor', name: 'Leather Armor', baseArmor: 2 },
  { id: 'chain-armor', type: 'armor', name: 'Chain Armor', baseArmor: 4 },
  { id: 'health-potion', type: 'potion', name: 'Unidentified Potion', healAmount: 15 },
  { id: 'scroll-of-fire', type: 'scroll', name: 'Unidentified Scroll', statusEffect: 'burn' },
];

export function getLootTableForFloor(depth) {
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

- [ ] **Step 4: Write `src/items.js`**

```javascript
// src/items.js
export const RARITY = ['common', 'uncommon', 'rare', 'legendary'];
export const RARITY_AFFIX_COUNT = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

const AFFIX_POOL = [
  { key: 'damage', label: 'of Force', roll: (rng, tier) => Math.ceil((1 + rng() * 3) * tier) },
  { key: 'critChance', label: 'of Precision', roll: (rng, tier) => +(0.02 + rng() * 0.03 * tier).toFixed(2) },
  { key: 'resistance', label: 'of Warding', roll: (rng, tier) => +(0.05 + rng() * 0.1 * tier).toFixed(2) },
];

export function rollAffixes(rarity, rng, tierMultiplier = 1) {
  const count = RARITY_AFFIX_COUNT[rarity];
  const pool = [...AFFIX_POOL];
  const affixes = [];
  for (let i = 0; i < count && pool.length; i++) {
    const pickIndex = Math.floor(rng() * pool.length);
    const def = pool.splice(pickIndex, 1)[0];
    affixes.push({ key: def.key, label: def.label, value: def.roll(rng, tierMultiplier) });
  }
  return affixes;
}

export function generateItem(baseItem, rarity, rng, floorDepth) {
  const tierMultiplier = 1 + floorDepth * 0.15;
  const identifiable = baseItem.type === 'weapon' || baseItem.type === 'armor';
  return {
    ...baseItem,
    rarity,
    affixes: identifiable ? rollAffixes(rarity, rng, tierMultiplier) : [],
    identified: identifiable,
  };
}

export function rollLootTable(table, rng) {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of table) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return table[table.length - 1];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/items.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Wire item drops and pickup/equip/use into `src/main.js`**

```javascript
// add to src/main.js, near the top imports
import { generateItem, rollLootTable, RARITY } from './items.js';
import { BASE_ITEMS, getLootTableForFloor } from './data.js';

// add after `const combatLog = []` block

const groundItems = new Map(); // key "x,y" -> item instance

function maybeDropLoot(x, y) {
  // computed fresh each call (not hoisted to a module-level const) for two reasons:
  // `floor` doesn't exist yet at module load time (Task 15 only assigns it inside
  // startFloor()), and the loot table must scale with the *current* floor's depth,
  // which changes every time the player descends.
  const lootTable = getLootTableForFloor(floor.depth);
  const entry = rollLootTable(lootTable, rng);
  if (!entry.itemId) return;
  const base = BASE_ITEMS.find(b => b.id === entry.itemId);
  const rarity = RARITY[Math.min(RARITY.length - 1, Math.floor(rng() * rng() * RARITY.length))];
  groundItems.set(`${x},${y}`, generateItem(base, rarity, rng, floor.depth));
}

// inside playerAttack(), after "The ${target.archetype.name} dies." log line:
//   maybeDropLoot(target.x, target.y);

// update the existing status-tick block at the top of monsterTurn() so a monster
// that dies from a damage-over-time status (e.g. the fire scroll, wired later in this
// task) grants the same rewards as one killed by a direct attack:
//
//   const { totalDamage, remaining } = tickStatuses(monster.statuses);
//   monster.statuses = remaining;
//   monster.hp = Math.max(0, monster.hp - totalDamage);
//   if (monster.hp === 0) {
//     log(`The ${monster.archetype.name} burns to death.`);
//     monsters = monsters.filter(m => m !== monster);
//     kills += 1;
//     player.gainXp(10);
//     maybeDropLoot(monster.x, monster.y);
//     return;
//   }
//
// (this replaces the plain `monsters = monsters.filter(...); return;` from Task 10;
// `kills` is the module-level counter declared alongside `combatLog` in Task 10)

function pickUpItemUnderPlayer() {
  const key = `${player.x},${player.y}`;
  const item = groundItems.get(key);
  if (!item) return;
  groundItems.delete(key);
  player.inventory.push(item);
  log(`You pick up ${item.name} (${item.rarity}).`);
}

function equipOrUseItem(index) {
  const item = player.inventory[index];
  if (!item) return;
  if (item.type === 'weapon' || item.type === 'armor') {
    const slot = item.type === 'weapon' ? 'weapon' : 'armor';
    player.equipment[slot] = item;
    player.inventory.splice(index, 1);
    log(`You equip ${item.name}.`);
  } else if (item.type === 'potion') {
    item.identified = true;
    player.hp = Math.min(player.maxHp, player.hp + item.healAmount);
    player.inventory.splice(index, 1);
    log(`You drink the potion and recover ${item.healAmount} HP.`);
  } else if (item.type === 'scroll') {
    item.identified = true;
    player.inventory.splice(index, 1);
    const target = monsters.find(m => visible.has(`${m.x},${m.y}`));
    if (target) {
      target.statuses.push({ damagePerTick: 3, turnsRemaining: 3 });
      log(`You read the scroll — the nearest visible ${target.archetype.name} catches fire!`);
    } else {
      log('You read the scroll, but no target is in sight. It fizzles.');
    }
  }
}

// in the keydown listener, alongside the arrow-key handling:
//   if (e.key === 'g') pickUpItemUnderPlayer();
//   if (/^[1-9]$/.test(e.key)) equipOrUseItem(Number(e.key) - 1);
```

Apply these additions directly into the existing `src/main.js` (the drop call inside `playerAttack`, the new functions, and the two new `if` branches inside the existing `keydown` listener).

- [ ] **Step 7: Manually verify in browser**

Refresh `http://localhost:8765/`.
Expected: killing a monster sometimes leaves an item on its tile (not guaranteed every kill — that's the loot table's "no drop" weight); pressing `g` while standing on an item tile picks it up and logs it; pressing a number key equips/uses the corresponding inventory slot and logs the result; drinking a potion increases HP (capped at max).

- [ ] **Step 8: Commit**

```bash
git add src/items.js src/data.js src/main.js tests/items.test.js
git commit -m "Add itemization: affixes, rarity, loot tables, pickup/equip/use"
```

---

### Task 12: UI panels — HUD, inventory, character sheet, minimap

**Files:**
- Create: `src/ui.js`
- Modify: `src/main.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: DOM elements `#hud`, `#inventory-panel`, `#combat-log` (already present from Task 1); reads `player`, `monsters`, `floor`, `explored`, `combatLog` passed in from `main.js`.
- Produces: `renderHUD(player, floor): void`; `renderInventory(player, isOpen): void`; `renderMinimap(ctx, floor, player, explored): void` (draws onto a small offscreen-positioned region of the main canvas, top-right corner); `renderCombatLog(combatLog): void`. Consumed by `main.js`'s render loop.

- [ ] **Step 1: Add a minimap canvas region and inventory toggle key to `index.html`/`style.css`**

```css
/* append to style.css */
#minimap-label {
  position: absolute; top: 8px; right: 216px;
  font-size: 10px; opacity: 0.7;
}
```

- [ ] **Step 2: Create `src/ui.js`**

```javascript
// src/ui.js
export function renderHUD(player, floor) {
  const hud = document.getElementById('hud');
  const weapon = player.equipment.weapon ? player.equipment.weapon.name : 'Fists';
  const armor = player.equipment.armor ? player.equipment.armor.name : 'None';
  hud.innerHTML = [
    `HP ${player.hp}/${player.maxHp}  Lv ${player.level} (${player.xp}/${'?'})`,
    `Floor ${floor.depth}`,
    `Weapon: ${weapon}  Armor: ${armor}`,
    player.statPoints > 0 ? `Unspent stat points: ${player.statPoints} (press 'p' to add STR)` : '',
  ].join('<br>');
}

export function renderInventory(player, isOpen) {
  const panel = document.getElementById('inventory-panel');
  panel.classList.toggle('hidden', !isOpen);
  if (!isOpen) return;
  const rows = player.inventory.map((item, i) => {
    const label = item.identified ? `${item.name} (${item.rarity})` : item.name;
    return `${i + 1}. ${label}`;
  });
  panel.innerHTML = `<b>Inventory (i to close, 1-9 to use/equip)</b><br>${rows.join('<br>') || '(empty)'}`;
}

export function renderCombatLog(combatLog) {
  document.getElementById('combat-log').textContent = combatLog.join('\n');
}

export function renderMinimap(ctx, floor, player, explored) {
  const originX = ctx.canvas.width - 12 * floor.width - 8;
  const originY = 8;
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(originX - 4, originY - 4, 12 * floor.width + 8, 12 * floor.height + 8);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!explored.has(`${x},${y}`)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = tile === 0 ? '#222' : '#666';
      ctx.fillRect(originX + x * 12, originY + y * 12, 10, 10);
    }
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(originX + player.x * 12, originY + player.y * 12, 10, 10);
}
```

Note: the minimap uses a `12`-unit-per-tile scale independent of `TILE_SIZE`, and only claims a small corner of the canvas — at `GRID_WIDTH = 60` this is `60*12 = 720px` wide, which fits within the `1440px`-wide canvas from Task 1 alongside the main view. If `GRID_WIDTH`/`GRID_HEIGHT` change later, revisit this scale.

- [ ] **Step 3: Wire UI rendering and the inventory toggle into `src/main.js`**

```javascript
// add to src/main.js imports
import { renderHUD, renderInventory, renderCombatLog, renderMinimap } from './ui.js';

// add module-level state
let inventoryOpen = false;

// add to the keydown listener
//   if (e.key === 'i') { inventoryOpen = !inventoryOpen; }
//   if (e.key === 'p' && player.statPoints > 0) { player.str += 1; player.statPoints -= 1; }

// replace the manual HUD/combat-log lines at the end of render() with:
renderHUD(player, floor);
renderInventory(player, inventoryOpen);
renderCombatLog(combatLog);
renderMinimap(ctx, floor, player, explored);
```

- [ ] **Step 4: Manually verify in browser**

Refresh `http://localhost:8765/`.
Expected: top-left HUD shows HP/level/floor/equipped weapon+armor and, when you have unspent stat points, a hint to press `p`; pressing `i` toggles a visible inventory panel top-right listing picked-up items with numbers; a small minimap appears showing explored tiles and the player's position; pressing `p` with stat points available increases STR and decrements the counter.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/main.js style.css
git commit -m "Add HUD, inventory panel, and minimap UI"
```

---

### Task 13: Juice — screen shake, particles, floating damage numbers, tile tweening

**Files:**
- Create: `src/fx.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: nothing external — pure state-transition functions plus one canvas-drawing function.
- Produces: `createShake(intensity, duration): ShakeState`; `updateShake(shake, dt): ShakeState | null`; `getShakeOffset(shake): {x, y}`; `createParticleBurst(x, y, count, rng): Particle[]`; `updateParticles(particles, dt): Particle[]`; `createFloatingText(x, y, text, color): FloatingText`; `updateFloatingTexts(texts, dt): FloatingText[]`; `createTween(from: {x,y}, to: {x,y}, duration): TweenState`; `updateTween(tween, dt): TweenState | null`; `getTweenPosition(tween): {x, y} | null` (positions are in tile-grid units, not pixels — callers multiply by `TILE_SIZE`); `drawFx(ctx, fxState, tileSize): void`. Consumed by `main.js`'s combat resolution and movement code (to trigger effects/tweens) and render loop (to draw/interpolate and age them).

- [ ] **Step 1: Write `src/fx.js`**

```javascript
// src/fx.js
export function createShake(intensity, duration) {
  return { intensity, duration, elapsed: 0 };
}

export function updateShake(shake, dt) {
  if (!shake) return null;
  shake.elapsed += dt;
  return shake.elapsed >= shake.duration ? null : shake;
}

export function getShakeOffset(shake) {
  if (!shake) return { x: 0, y: 0 };
  const progress = 1 - shake.elapsed / shake.duration;
  const magnitude = shake.intensity * progress;
  return { x: (Math.random() * 2 - 1) * magnitude, y: (Math.random() * 2 - 1) * magnitude };
}

export function createParticleBurst(x, y, count, rng) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 20 + rng() * 40;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 });
  }
  return particles;
}

export function updateParticles(particles, dt) {
  return particles
    .map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt }))
    .filter(p => p.life > 0);
}

export function createFloatingText(x, y, text, color) {
  return { x, y, text, color, life: 0.8, vy: -30 };
}

export function updateFloatingTexts(texts, dt) {
  return texts
    .map(t => ({ ...t, y: t.y + t.vy * dt, life: t.life - dt }))
    .filter(t => t.life > 0);
}

export function createTween(from, to, duration) {
  return { from, to, duration, elapsed: 0 };
}

export function updateTween(tween, dt) {
  if (!tween) return null;
  tween.elapsed += dt;
  return tween.elapsed >= tween.duration ? null : tween;
}

export function getTweenPosition(tween) {
  if (!tween) return null;
  const t = Math.min(1, tween.elapsed / tween.duration);
  return {
    x: tween.from.x + (tween.to.x - tween.from.x) * t,
    y: tween.from.y + (tween.to.y - tween.from.y) * t,
  };
}

export function drawFx(ctx, fxState, tileSize) {
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

- [ ] **Step 2: Wire fx state and triggers into `src/main.js`**

```javascript
// add to src/main.js imports
import {
  createShake, updateShake, getShakeOffset,
  createParticleBurst, updateParticles,
  createFloatingText, updateFloatingTexts,
  createTween, updateTween, getTweenPosition, drawFx,
} from './fx.js';

// add module-level fx state
const fxState = { shake: null, particles: [], floatingTexts: [] };
let lastFrameTime = performance.now();
let playerTween = null;
const monsterTweens = new WeakMap(); // Monster instance -> TweenState

// inside playerAttack(), after computing `result`:
fxState.floatingTexts.push(createFloatingText(
  target.x * TILE_SIZE, target.y * TILE_SIZE, result.hit ? String(result.damage) : 'miss',
  result.crit ? '#ffcc33' : '#ffffff',
));
if (result.crit) fxState.shake = createShake(4, 0.15);

// inside monsterTurn(), after applying damage to the player:
if (result.hit) {
  fxState.floatingTexts.push(createFloatingText(player.x * TILE_SIZE, player.y * TILE_SIZE, String(result.damage), '#ff6666'));
  fxState.shake = createShake(3, 0.15);
}

// on monster death (inside playerAttack, where monsters are filtered out):
fxState.particles.push(...createParticleBurst(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, 12, rng));

// inside tryMovePlayer(), in the successful-move branch, capture the origin tile
// before the position changes and start a tween from it:
//   if (!isWalkable(nx, ny)) return;
//   const moveFrom = { x: player.x, y: player.y };
//   takeTurn(() => { player.x = nx; player.y = ny; });
//   playerTween = createTween(moveFrom, { x: player.x, y: player.y }, 0.12);
// (this replaces the existing `if (!isWalkable(nx, ny)) return; takeTurn(() => { player.x = nx; player.y = ny; });` lines from Task 10)

// inside monsterTurn(), in the `action.type === 'move'` branch, start a tween the same way:
//   } else if (action.type === 'move') {
//     if (isWalkable(action.to.x, action.to.y) && !monsterAt(action.to.x, action.to.y)
//         && !(action.to.x === player.x && action.to.y === player.y)) {
//       const moveFrom = { x: monster.x, y: monster.y };
//       monster.x = action.to.x;
//       monster.y = action.to.y;
//       monsterTweens.set(monster, createTween(moveFrom, { x: monster.x, y: monster.y }, 0.12));
//     }
//   }
// (this replaces the existing `else if (action.type === 'move') { ... }` branch from Task 10)

// in loop(), before render():
const now = performance.now();
const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
lastFrameTime = now;
fxState.shake = updateShake(fxState.shake, dt);
fxState.particles = updateParticles(fxState.particles, dt);
fxState.floatingTexts = updateFloatingTexts(fxState.floatingTexts, dt);
playerTween = updateTween(playerTween, dt);
for (const m of monsters) {
  const tween = monsterTweens.get(m);
  if (!tween) continue;
  const updated = updateTween(tween, dt);
  if (updated) monsterTweens.set(m, updated);
  else monsterTweens.delete(m);
}

// at the start of render(), wrap the existing drawing in a shake-offset translate,
// and use the interpolated tween position (falling back to the grid position when
// no tween is active) for the player and monster fillRect calls:
const shakeOffset = getShakeOffset(fxState.shake);
ctx.save();
ctx.translate(shakeOffset.x, shakeOffset.y);
// ...existing tile-grid drawing loop and trap-drawing loop go here, unchanged...
for (const m of monsters) {
  const key = `${m.x},${m.y}`;
  if (!visible.has(key)) continue;
  const tween = monsterTweens.get(m);
  const pixelPos = tween ? getTweenPosition(tween) : { x: m.x, y: m.y };
  ctx.fillStyle = m.archetype.color;
  ctx.fillRect(pixelPos.x * TILE_SIZE + 4, pixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
}
const playerPixelPos = playerTween ? getTweenPosition(playerTween) : { x: player.x, y: player.y };
ctx.fillStyle = '#e0d060';
ctx.fillRect(playerPixelPos.x * TILE_SIZE + 4, playerPixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
drawFx(ctx, fxState, TILE_SIZE);
ctx.restore();
```

Apply these additions directly into the existing `src/main.js`: the fx/tween state near the top, the tween-start replacements inside `tryMovePlayer`/`monsterTurn`'s move handling, the per-frame update inside `loop()`, and replace the existing monster-loop and player `fillRect` calls inside `render()` with the tween-aware versions shown above, wrapped in the `ctx.save()`/`translate`/`ctx.restore()` (the HUD/inventory/minimap DOM and canvas overlay calls stay outside the translated block since they're UI chrome, not world-space).

- [ ] **Step 3: Manually verify in browser**

Refresh `http://localhost:8765/`.
Expected: attacking shows a floating damage number (or "miss") above the target; crits flash yellow and briefly shake the screen; killing a monster produces a small particle burst at its position; taking damage shows a red floating number over the player and a small shake; moving (player or a chasing/fleeing monster) glides smoothly between tiles over a couple of frames instead of snapping instantly.

- [ ] **Step 4: Commit**

```bash
git add src/fx.js src/main.js
git commit -m "Add juice: screen shake, particles, floating damage numbers, and tile tweening"
```

---

### Task 14: Meta-progression, save system, death/victory flow

**Files:**
- Create: `src/save.js`
- Modify: `src/main.js`
- Test: `tests/save.test.js`

**Interfaces:**
- Consumes: nothing external (storage is injected, not read from `globalThis` directly, for testability).
- Produces: `loadMeta(storage): { currency, unlockedClasses, unlockedPerks }`; `saveMeta(meta, storage): void`; `applyRunResult(meta, { floorReached, kills }): { updated, earned }`. Consumed by `main.js`'s run-start (load) and run-end (apply + save) flow.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/save.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMeta, saveMeta, applyRunResult } from '../src/save.js';

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
}

test('loadMeta returns defaults when storage is empty', () => {
  const meta = loadMeta(fakeStorage());
  assert.equal(meta.currency, 0);
  assert.deepEqual(meta.unlockedClasses, ['adventurer']);
});

test('loadMeta falls back to defaults on corrupted JSON', () => {
  const storage = fakeStorage({ 'voidcrawler-meta-v1': 'not json{{' });
  const meta = loadMeta(storage);
  assert.equal(meta.currency, 0);
});

test('saveMeta then loadMeta round-trips', () => {
  const storage = fakeStorage();
  saveMeta({ currency: 42, unlockedClasses: ['adventurer'], unlockedPerks: ['tough'] }, storage);
  const meta = loadMeta(storage);
  assert.equal(meta.currency, 42);
  assert.deepEqual(meta.unlockedPerks, ['tough']);
});

test('applyRunResult adds currency proportional to floor and kills', () => {
  const meta = { currency: 10, unlockedClasses: ['adventurer'], unlockedPerks: [] };
  const { updated, earned } = applyRunResult(meta, { floorReached: 3, kills: 5 });
  assert.equal(earned, 3 * 10 + 5 * 2);
  assert.equal(updated.currency, 10 + earned);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/save.test.js`
Expected: FAIL — `src/save.js` does not exist yet.

- [ ] **Step 3: Write `src/save.js`**

```javascript
// src/save.js
const SAVE_KEY = 'voidcrawler-meta-v1';

const DEFAULT_META = {
  currency: 0,
  unlockedClasses: ['adventurer'],
  unlockedPerks: [],
};

export function loadMeta(storage = globalThis.localStorage) {
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

export function saveMeta(meta, storage = globalThis.localStorage) {
  storage.setItem(SAVE_KEY, JSON.stringify(meta));
}

export function applyRunResult(meta, { floorReached, kills }) {
  const earned = floorReached * 10 + kills * 2;
  return { updated: { ...meta, currency: meta.currency + earned }, earned };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/save.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit save system**

```bash
git add src/save.js tests/save.test.js
git commit -m "Add meta-progression save system"
```

- [ ] **Step 6: Wire death/victory flow and meta-progression into `src/main.js`**

```javascript
// add to src/main.js imports
import { loadMeta, saveMeta, applyRunResult } from './save.js';

// add near the top, after canvas/ctx setup, before floor generation
const meta = loadMeta();
let gameState = 'playing'; // 'playing' | 'dead' | 'victory'
// (the `kills` counter itself was already declared and is already incremented
// on every monster death — see Task 10 — this task just reads it in endRun() below)

// add a function to end the run
function endRun(state) {
  gameState = state;
  const { updated, earned } = applyRunResult(meta, { floorReached: floor.depth, kills });
  saveMeta(updated);
  log(state === 'dead'
    ? `You died on floor ${floor.depth}. Earned ${earned} currency (total ${updated.currency}).`
    : `You escaped the depths! Earned ${earned} currency (total ${updated.currency}).`);
}

// inside monsterTurn(), right after `player.hp = Math.max(0, player.hp - result.damage);`:
//   if (player.hp === 0 && gameState === 'playing') endRun('dead');

// guard input so a dead/victorious run stops accepting movement/combat keys:
// wrap the existing keydown handler body in:
//   if (gameState !== 'playing') {
//     if (e.key === 'Enter') location.reload();
//     return;
//   }
// (insert this check as the first lines inside the `window.addEventListener('keydown', ...)` callback)
```

- [ ] **Step 7: Manually verify in browser**

Refresh `http://localhost:8765/`, deliberately fight monsters until the player's HP reaches 0.
Expected: on death, the combat log shows "You died on floor N. Earned X currency (total Y)." and further arrow-key/attack input has no effect; pressing Enter reloads the page for a fresh run; after reload, opening the browser console and running `localStorage.getItem('voidcrawler-meta-v1')` shows the accumulated currency persisted from the previous run.

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "Add death/victory flow and meta-progression wiring"
```

---

### Task 15: Multi-floor descent, boss floor, and full integration playtest

**Files:**
- Modify: `src/main.js`
- Modify: `src/data.js`

**Interfaces:**
- Consumes: everything wired in Tasks 1–14.
- Produces: stepping onto a `TILE.STAIRS_DOWN` tile on floors 1–8 regenerates a new floor at `depth + 1`, respawns monsters scaled to the new depth, and resets `explored`/`visible`; floor 9 spawns a single boss-tier monster instead of the normal per-room spawn, and defeating it triggers `endRun('victory')`.

- [ ] **Step 1: Add a boss archetype to `src/data.js`**

```javascript
// append to MONSTER_ARCHETYPES in src/data.js
boss: {
  id: 'boss', name: 'Void Warden', hp: 60, damage: 9, critChance: 0.15, dodgeChance: 0.05,
  sightRange: 10, ranged: false, range: 1, fleeHpFraction: 0, color: '#a0a',
},
```

Victory condition for this v1: defeating the boss on floor 9 ends the run as a victory (simpler and more satisfying than "reach the stairs past the boss," and avoids needing a floor-10 generation edge case).

- [ ] **Step 2: Replace the single-floor setup in `src/main.js` with a `startFloor(depth)` function**

```javascript
// src/main.js — restructure floor/player/monster setup into a function so descending can call it again

let floor, monsters, explored, visible;

function startFloor(depth) {
  floor = generateFloor(depth, rng, GRID_WIDTH, GRID_HEIGHT);
  const spawnRoom = floor.rooms[0];
  const spawn = spawnRoom.center();
  player.x = spawn.x;
  player.y = spawn.y;

  // traps and dropped items are tile-keyed ("x,y") on the *previous* floor's grid —
  // clear them on every descent so stale entries don't reappear at the same
  // coordinates on the new floor's unrelated layout
  traps.clear();
  groundItems.clear();
  // a mid-tween player move would otherwise interpolate toward stale pixel
  // coordinates from the floor that was just left behind
  playerTween = null;

  if (depth === 9) {
    const bossRoom = floor.rooms[floor.rooms.length - 1];
    const c = bossRoom.center();
    monsters = [new Monster(MONSTER_ARCHETYPES.boss, c.x, c.y)];
  } else {
    const archetypeIds = ['rusher', 'caster', 'trapper'];
    monsters = floor.rooms.slice(1).map((room, i) => {
      const c = room.center();
      return new Monster(MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]], c.x, c.y);
    });
  }

  explored = new Set();
  visible = computeFOV(floor, player.x, player.y, 8);
  for (const key of visible) explored.add(key);
}
```

In `src/main.js`, find this exact block (introduced in Task 10, positioned right after `const player = new Player(STARTING_CLASSES.adventurer);`):

```javascript
const floor = generateFloor(1, rng, GRID_WIDTH, GRID_HEIGHT);

const player = new Player(STARTING_CLASSES.adventurer);
const start = floor.rooms[0].center();
player.x = start.x;
player.y = start.y;

const archetypeIds = Object.keys(MONSTER_ARCHETYPES);
let monsters = floor.rooms.slice(1).map((room, i) => {
  const c = room.center();
  const archetype = MONSTER_ARCHETYPES[archetypeIds[i % archetypeIds.length]];
  return new Monster(archetype, c.x, c.y);
});

const explored = new Set();
let visible = computeFOV(floor, player.x, player.y, 8);
for (const key of visible) explored.add(key);
```

Delete it entirely and replace it with:

```javascript
const player = new Player(STARTING_CLASSES.adventurer);
let floor, monsters, explored, visible;
```

(the `function startFloor(depth) { ... }` declaration shown above goes anywhere below this point and above its call site — function declarations are hoisted, so exact placement doesn't matter, but keeping it near the other turn-scheduler functions like `tryMovePlayer` is the natural spot). Do **not** call `startFloor(1)` at this location. `startFloor` reads `traps` and `groundItems`, both declared later in the file with `const` (Tasks 10 and 11) — calling `startFloor` before those `const` lines have executed throws a temporal-dead-zone `ReferenceError`. The function *declaration* is safe to place early (declarations are hoisted), but the *call* must happen after every `const`/`let` it touches has already run.

Instead, add the `startFloor(1);` call at the very bottom of `src/main.js`, immediately before the `requestAnimationFrame(loop);` line that starts the render loop (i.e., after every other top-level `const`/`function` declaration in the file has executed):

```javascript
// at the very end of src/main.js, replacing the old bare `requestAnimationFrame(loop);`
startFloor(1);
requestAnimationFrame(loop);
```

Every other function (`isWalkable`, `monsterAt`, `canSeeBetween`, `playerAttack`, `monsterTurn`, `render`, etc.) already reads `floor`/`monsters`/`explored`/`visible` as closures, so switching those from `const`/module-scoped initial assignment to "assigned inside `startFloor`, called once at the bottom" requires no other code changes.

- [ ] **Step 3: Handle stepping onto stairs and boss death as run transitions**

```javascript
// inside tryMovePlayer(), after the successful move branch (after `takeTurn(() => { player.x = nx; player.y = ny; });`):
const tile = floor.grid[idx(player.x, player.y, floor.width)];
if (tile === TILE.STAIRS_DOWN && gameState === 'playing' && floor.depth < 9) {
  log(`You descend to floor ${floor.depth + 1}.`);
  startFloor(floor.depth + 1);
}

// inside playerAttack(), in the branch where a monster dies, after `kills += 1;`:
if (target.archetype.id === 'boss') {
  endRun('victory');
}
```

Note on floor 9's stairs tile: `generateFloor` always carves a `STAIRS_DOWN` tile in the last room, and the boss spawns in that same last room (see Step 2's `bossRoom = floor.rooms[floor.rooms.length - 1]`), standing on top of it. Since `monsterAt()` makes `tryMovePlayer` resolve a move onto an occupied tile as an attack instead of a move, the player can never actually step onto the stairs tile while the boss is alive — so the `floor.depth < 9` guard above is what prevents any further stairs handling on floor 9, and defeating the boss (not reaching the stairs) is the sole victory trigger, exactly as decided in Step 1.

- [ ] **Step 4: Manually verify a full playtest end-to-end**

Run: `cd ~/voidcrawler && python3 -m http.server 8765` (if not already running)
Open `http://localhost:8765/`, refresh.
Play through the following checklist:
- Move around, fight and kill at least 2 monsters, confirm XP/leveling, item drops, and pickup/equip all work together.
- Walk onto the stairs-down tile on floor 1 and confirm floor 2 generates with a fresh layout, fresh monsters, and reset fog-of-war.
- (Optional, to save time) Temporarily edit `startFloor(1)` to `startFloor(9)` at the bottom of `src/main.js`, refresh, and confirm the boss spawns alone and defeating it triggers the victory log message and locks input. Revert this temporary edit back to `startFloor(1)` afterward.
- Let the player die once (or edit `player.hp = 1` temporarily via the browser console before taking a hit) and confirm the death flow, currency persistence across reload, and Enter-to-restart all work.

- [ ] **Step 5: Run the full automated test suite one last time**

Run: `cd ~/voidcrawler && node --test`
Expected: all tests across `tests/rng.test.js`, `tests/dungeon.test.js`, `tests/fov.test.js`, `tests/entities.test.js`, `tests/combat.test.js`, `tests/pathfinding.test.js`, `tests/ai.test.js`, `tests/items.test.js`, `tests/save.test.js` PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/data.js
git commit -m "Add multi-floor descent, boss floor, and full run integration"
```

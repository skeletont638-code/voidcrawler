# Voidcrawler V2 Phase C: Visual/Audio Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace solid-color-square rendering with procedural pixel sprites, add WebAudio-synthesized sound effects, add a title screen with class selection, replace the perk-choice/death/victory log-line stand-ins with real overlay UI, and do a CSS theming pass — turning the functionally-complete V2 game from Phases A/B into something that looks and feels shipped.

**Architecture:** Two new leaf modules (`sprites.ts` for pixel-pattern bitmaps + a canvas draw function, `audio.ts` for WebAudio SFX synthesis), both with no dependencies on `main.ts` so they stay independently reasoned-about; `main.ts` wires both in at existing call sites (replacing `fillRect` calls with `drawSprite`, adding `playSound()` calls alongside existing `log()` calls) and gains a `screen: 'title' | 'playing' | 'dead' | 'victory'` state machine plus the DOM wiring for the title/perk-choice/death-victory overlays. No new game *logic* — this phase is rendering, audio, and screen-flow only.

**Tech Stack:** Same as Phases A/B (TypeScript strict, Vite, Vitest) plus the browser's native `AudioContext` (Web Audio API) — no new npm dependencies.

## Global Constraints

- No external image or audio asset files — sprites are canvas draw calls from in-source bitmap data; sound is synthesized at runtime via `OscillatorNode`/`GainNode` envelopes. This keeps "clone and run" trivial (nothing to fetch, nothing that can 404).
- Zero gameplay/logic regression — every existing test must keep passing; this phase only changes how things are drawn/heard/screen-flowed, never combat/AI/itemization/progression math.
- Audio and rendering code is browser-only (`AudioContext`, `CanvasRenderingContext2D`) and cannot run under Vitest's Node environment — verification for `sprites.ts`/`audio.ts` is live-in-browser, matching the project's existing convention (established in the v1 spec) that canvas/DOM/audio code is playtest-verified, not unit-tested.
- A single mute toggle controls all SFX and is persisted via the existing `MetaProgression`/`loadMeta`/`saveMeta` machinery from `src/save.ts` — add a `mutedAudio: boolean` field there, defaulting to `false`, following the same "old saves degrade gracefully" merge-with-defaults pattern already in place.

---

### Task 1: Procedural sprite system

**Files:**
- Create: `src/sprites.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `type SpriteId = 'player' | 'rusher' | 'caster' | 'trapper' | 'brute' | 'swarmling' | 'shaman' | 'stalker' | 'boss' | 'caverns-boss' | 'depths-boss'`; `drawSprite(ctx: CanvasRenderingContext2D, spriteId: string, x: number, y: number, size: number, color: string): void` — draws an 8x8-cell pixel pattern (falling back to a filled square for any id without a defined pattern, so it never silently draws nothing) scaled to fill a `size`x`size` box at pixel origin `(x, y)`, tinted with `color` (so the existing per-archetype `color` field from `MonsterArchetype` still drives the palette — sprites are shape, not fixed color). Consumed by `main.ts`'s `render()`, replacing the existing `ctx.fillRect(...)` calls for the player and each monster.

- [ ] **Step 1: Write `src/sprites.ts`**

```typescript
// src/sprites.ts
// Each pattern is an 8x8 grid of 0/1 flags, row-major, top-to-bottom. 1 = filled pixel.
const PATTERNS: Record<string, number[]> = {
  player: [
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    1, 1, 0, 1, 1, 0, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    0, 1, 1, 1, 1, 1, 1, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
    1, 1, 0, 0, 0, 0, 1, 1,
  ],
  rusher: [
    0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    1, 1, 0, 1, 1, 0, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    0, 1, 0, 1, 1, 0, 1, 0,
    0, 1, 0, 0, 0, 0, 1, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
  ],
  caster: [
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 1, 0, 1, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    1, 1, 1, 0, 0, 1, 1, 1,
    1, 0, 1, 1, 1, 1, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
    1, 1, 0, 0, 0, 0, 1, 1,
  ],
  trapper: [
    0, 1, 0, 0, 0, 0, 1, 0,
    1, 1, 1, 0, 0, 1, 1, 1,
    0, 1, 1, 1, 1, 1, 1, 0,
    0, 1, 0, 1, 1, 0, 1, 0,
    1, 1, 1, 1, 1, 1, 1, 1,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 1, 0, 1, 0,
    1, 0, 0, 0, 0, 0, 0, 1,
  ],
  brute: [
    1, 1, 0, 1, 1, 0, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 0, 1, 1, 1, 1, 0, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 0, 1, 1, 0, 1, 1,
    0, 1, 1, 0, 0, 1, 1, 0,
    1, 1, 0, 0, 0, 0, 1, 1,
  ],
  swarmling: [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 0, 1, 1, 0, 1, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  shaman: [
    0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 1,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
    1, 1, 0, 0, 0, 0, 1, 1,
  ],
  stalker: [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
};

const BOSS_PATTERN: number[] = [
  1, 0, 1, 1, 1, 1, 0, 1,
  1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 0, 1, 1, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,
  0, 1, 1, 1, 1, 1, 1, 0,
  0, 1, 1, 0, 0, 1, 1, 0,
  1, 1, 0, 1, 1, 0, 1, 1,
  1, 0, 1, 0, 0, 1, 0, 1,
];

const GRID_SIZE = 8;

export function drawSprite(ctx: CanvasRenderingContext2D, spriteId: string, x: number, y: number, size: number, color: string): void {
  const pattern = PATTERNS[spriteId] ?? (spriteId.endsWith('boss') ? BOSS_PATTERN : null);
  const cell = size / GRID_SIZE;
  ctx.fillStyle = color;
  if (!pattern) {
    ctx.fillRect(x, y, size, size);
    return;
  }
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (pattern[row * GRID_SIZE + col]) {
        ctx.fillRect(x + col * cell, y + row * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}
```

Note: `'boss'`, `'caverns-boss'`, and `'depths-boss'` all fall through to the shared `BOSS_PATTERN` via the `spriteId.endsWith('boss')` check rather than three duplicate pattern entries — they're already visually distinguished by their per-archetype `color`.

- [ ] **Step 2: Wire `drawSprite` into `src/main.ts`'s `render()`**

```typescript
// in src/main.ts, add the import:
import { drawSprite } from './sprites.js';

// replace the monster-drawing loop's fillRect call:
//   ctx.fillStyle = m.archetype.color;
//   ctx.fillRect(pixelPos.x * TILE_SIZE + 4, pixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
// with:
drawSprite(ctx, m.archetype.id, pixelPos.x * TILE_SIZE + 4, pixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, m.archetype.color);

// replace the player-drawing fillRect call:
//   ctx.fillStyle = '#e0d060';
//   ctx.fillRect(playerPixelPos.x * TILE_SIZE + 4, playerPixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
// with:
drawSprite(ctx, 'player', playerPixelPos.x * TILE_SIZE + 4, playerPixelPos.y * TILE_SIZE + 4, TILE_SIZE - 8, '#e0d060');
```

- [ ] **Step 3: Typecheck**

Run: `cd ~/voidcrawler && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manually verify in browser**

Run: `cd ~/voidcrawler && npx vite --port 8766 &` (if not already running)
Open `http://localhost:8766/`, refresh.
Expected: the player and every monster type render as a distinct pixel silhouette (not a plain square) in their archetype color; sprites remain readable at the 24px tile size; no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/sprites.ts src/main.ts
git commit -m "Add procedural pixel sprites, replacing solid-color entity squares"
```

---

### Task 2: WebAudio sound effects + mute toggle

**Files:**
- Create: `src/audio.ts`
- Modify: `src/types.ts`
- Modify: `src/save.ts`
- Modify: `src/main.ts`
- Test: `tests/save.test.ts`

**Interfaces:**
- Produces (`src/audio.ts`): `type SfxId = 'hit' | 'crit' | 'miss' | 'death' | 'levelUp' | 'pickup' | 'trap' | 'stairs'`; `playSound(id: SfxId): void` (no-ops safely if `muted` is true or if `AudioContext` construction throws, e.g. in an environment without audio hardware); `setMuted(value: boolean): void`; `isMuted(): boolean`.
- Produces (`src/types.ts`/`src/save.ts`): `MetaProgression` gains `mutedAudio: boolean` (default `false`); `loadMeta`'s existing default-merge already makes old saves (missing this field) degrade to `false` automatically — no special-case code needed beyond the interface/default addition.
- Consumed by `main.ts` at every point that already calls `log(...)` for a game event with an obvious matching sound (hit/crit/miss/death/level-up/pickup/trap-trigger/stairs-descend), plus a new `m` keydown handler to toggle mute.

- [ ] **Step 1: Add `mutedAudio` to `MetaProgression` and its default in `src/types.ts`/`src/save.ts`**

```typescript
// in src/types.ts, MetaProgression interface — add the field:
export interface MetaProgression {
  currency: number;
  unlockedClasses: string[];
  unlockedPerks: string[];
  mutedAudio: boolean;
}
```

```typescript
// in src/save.ts, DEFAULT_META — add the field:
const DEFAULT_META: MetaProgression = {
  currency: 0,
  unlockedClasses: ['adventurer'],
  unlockedPerks: [],
  mutedAudio: false,
};
```

- [ ] **Step 2: Write the failing test for the default**

```typescript
// append to tests/save.test.ts, inside the existing `describe('loadMeta', ...)` block:
it('defaults mutedAudio to false for saves that predate the field', () => {
  const storage = fakeStorage({ 'voidcrawler-meta-v1': JSON.stringify({ currency: 5, unlockedClasses: ['adventurer'], unlockedPerks: [] }) });
  const meta = loadMeta(storage);
  expect(meta.mutedAudio).toBe(false);
  expect(meta.currency).toBe(5);
});
```

- [ ] **Step 3: Run test to verify it passes** (the default-merge behavior already exists from Phase A — this test documents/locks in that the new field participates in it correctly)

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run tests/save.test.ts`
Expected: zero type errors; new test passes immediately (no implementation gap — `loadMeta`'s `{ ...DEFAULT_META, ...parsed }` spread already handles any missing field generically).

- [ ] **Step 4: Write `src/audio.ts`**

```typescript
// src/audio.ts
export type SfxId = 'hit' | 'crit' | 'miss' | 'death' | 'levelUp' | 'pickup' | 'trap' | 'stairs';

let muted = false;
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0): void {
  const audioCtx = getContext();
  if (!audioCtx || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startTime = audioCtx.currentTime + delay;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

const SFX: Record<SfxId, () => void> = {
  hit: () => tone(220, 0.08, 'square', 0.15),
  crit: () => { tone(320, 0.1, 'square', 0.2); tone(180, 0.12, 'square', 0.15, 0.04); },
  miss: () => tone(140, 0.06, 'triangle', 0.08),
  death: () => { tone(200, 0.2, 'sawtooth', 0.15); tone(100, 0.3, 'sawtooth', 0.12, 0.1); },
  levelUp: () => { tone(440, 0.1, 'sine', 0.15); tone(660, 0.15, 'sine', 0.15, 0.1); },
  pickup: () => tone(660, 0.08, 'sine', 0.1),
  trap: () => tone(90, 0.15, 'sawtooth', 0.18),
  stairs: () => { tone(300, 0.1, 'sine', 0.1); tone(400, 0.1, 'sine', 0.1, 0.08); },
};

export function playSound(id: SfxId): void {
  SFX[id]();
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}
```

- [ ] **Step 5: Wire `playSound` calls and the mute toggle into `src/main.ts`**

```typescript
// add to src/main.ts imports:
import { playSound, setMuted, isMuted } from './audio.js';

// right after `const meta = loadMeta();`, sync the module-level mute state from the save:
setMuted(meta.mutedAudio);
```

Add a `playSound(...)` call alongside each of these existing `log(...)` calls (same line context, not replacing the log — both fire together):

```typescript
// in playerAttack(), the floating-text push already branches on result.hit/result.crit — add sound there:
//   if (result.crit) fxState.shake = createShake(4, 0.15);
// becomes:
if (result.crit) { fxState.shake = createShake(4, 0.15); playSound('crit'); }
else if (result.hit) { playSound('hit'); }
else { playSound('miss'); }

// in playerAttack(), where a monster dies (after the `if (target.hp === 0) {` line, alongside the existing log):
playSound('death');

// in monsterTurn(), the player-hit branch — alongside its existing log line:
//   fxState.shake = createShake(3, 0.15);
// becomes:
fxState.shake = createShake(3, 0.15);
playSound(result.crit ? 'crit' : 'hit');

// in grantXp(), where perkChoices.length > 0:
if (perkChoices.length > 0) {
  pendingPerkChoice = perkChoices;
  playSound('levelUp');
  log(`Level up! Choose a perk: 1) ${perkChoices[0]!.label}  2) ${perkChoices[1]!.label}  3) ${perkChoices[2]!.label}`);
}

// in pickUpItemUnderPlayer(), alongside its existing log line:
playSound('pickup');

// in triggerTrapUnderPlayer(), alongside its existing log line:
playSound('trap');

// in tryMovePlayer(), in the stairs-descend branch, alongside its existing log line:
playSound('stairs');
```

Add the mute-toggle key handler, in the `keydown` listener, alongside the other single-key handlers (e.g. right after the `i` inventory-toggle branch):

```typescript
if (e.key === 'm') {
  const next = !isMuted();
  setMuted(next);
  const updated = { ...meta, mutedAudio: next };
  saveMeta(updated);
  log(next ? 'Sound muted.' : 'Sound unmuted.');
  return;
}
```

(This directly mutates and re-saves `meta` rather than going through `endRun`'s currency-updating path, since muting is a settings change independent of run outcome — `meta` is already a `let`-free `const` reference whose *properties* are being spread into a new object and reassigned; since `meta` itself is declared `const meta = loadMeta();`, change that declaration to `let meta = loadMeta();` so this reassignment compiles, and update every other place that currently does `saveMeta(updated)` after `applyRunResult`/`purchaseClass` calls to also reassign `meta = updated` — in `endRun()`, add `meta = updated;` right after `saveMeta(updated);` so the mute flag and currency changes both stay consistent on the same in-memory object across a run.)

- [ ] **Step 6: Typecheck and run full suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, 43/43 tests pass (42 from Phase B + 1 new `mutedAudio` default test).

- [ ] **Step 7: Manually verify in browser**

Refresh `http://localhost:8766/`. Since headless/automated browser tools can't verify audio playback directly, verify via: (a) no console errors after combat/pickup/trap/stairs/level-up events (each of which now also calls into `playSound`), (b) pressing `m` logs "Sound muted."/"Sound unmuted." and toggles correctly on repeated presses, (c) if manually listening is possible in your environment, confirm distinct blips for hits vs. crits vs. death vs. level-up.

- [ ] **Step 8: Commit**

```bash
git add src/audio.ts src/types.ts src/save.ts src/main.ts tests/save.test.ts
git commit -m "Add WebAudio sound effects with a persisted mute toggle"
```

---

### Task 3: Title screen with class selection

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `style.css`

**Interfaces:**
- Consumes: `STARTING_CLASSES` from `src/data.ts`; `purchaseClass` from `src/save.ts`.
- Produces: `main.ts` gains a `screen: 'title' | 'playing' | 'dead' | 'victory'` state (starts at `'title'`); the game loop/input only run gameplay logic once `screen === 'playing'`; a new `#title-screen` DOM panel lists each class (unlocked classes clickable/selectable via number keys, locked ones show their cost and a `b`-key "buy currently-selected locked class" action), plus "Enter to start" once a class is chosen.

- [ ] **Step 1: Add the title screen DOM to `index.html`**

```html
<!-- in index.html, add inside #game-root, as a sibling of #game-canvas, before it in document order so it overlays on top via CSS z-index (added in Task 6): -->
<div id="title-screen">
  <h1>Voidcrawler</h1>
  <p id="title-currency"></p>
  <div id="class-list"></div>
  <p class="title-hint">↑/↓ select class · b buy locked class · Enter start run · m mute</p>
</div>
```

- [ ] **Step 2: Restructure `src/main.ts`'s startup and input handling around a `screen` state**

```typescript
// add near the other module-level state, after `let gameState: 'playing' | 'dead' | 'victory' = 'playing';`:
let screen: 'title' | 'playing' | 'dead' | 'victory' = 'title';
let selectedClassIndex = 0;
const classIds = Object.keys(STARTING_CLASSES);

function renderTitleScreen(): void {
  const panel = document.getElementById('title-screen')!;
  panel.classList.toggle('hidden', screen !== 'title');
  if (screen !== 'title') return;
  document.getElementById('title-currency')!.textContent = `Currency: ${meta.currency}`;
  const list = document.getElementById('class-list')!;
  list.innerHTML = classIds.map((id, i) => {
    const cls = STARTING_CLASSES[id]!;
    const unlocked = meta.unlockedClasses.includes(id);
    const marker = i === selectedClassIndex ? '> ' : '  ';
    const status = unlocked ? '' : ` (locked — ${cls.unlockCost} currency)`;
    return `<div>${marker}${cls.name} (HP ${cls.baseHp}, STR ${cls.str}, DEX ${cls.dex}, VIT ${cls.vit})${status}</div>`;
  }).join('');
}

function startRun(classId: string): void {
  const chosenClass = STARTING_CLASSES[classId]!;
  Object.assign(player, new Player(chosenClass));
  screen = 'playing';
  gameState = 'playing';
  startFloor(1);
}
```

`Object.assign(player, new Player(chosenClass))` re-initializes every field on the existing `player` object in place (rather than reassigning `const player = ...`, which `main.ts` can't do since it's a module-level `const` referenced by closures throughout the file) — this correctly resets HP/level/XP/inventory/equipment/perks/statuses for a fresh run while every function that already closes over `player` keeps working unchanged.

- [ ] **Step 3: Gate input and the render loop on `screen`, and wire title-screen keys**

```typescript
// in the keydown listener, as the very first check (before the existing `if (gameState !== 'playing')` block):
if (screen === 'title') {
  if (e.key === 'ArrowUp') { selectedClassIndex = (selectedClassIndex - 1 + classIds.length) % classIds.length; return; }
  if (e.key === 'ArrowDown') { selectedClassIndex = (selectedClassIndex + 1) % classIds.length; return; }
  if (e.key === 'b') {
    const classId = classIds[selectedClassIndex]!;
    const result = purchaseClass(meta, classId);
    if (result.success) {
      meta = result.updated;
      saveMeta(meta);
      log(`Unlocked ${STARTING_CLASSES[classId]!.name}!`);
    } else {
      log(`Can't unlock: ${result.reason}.`);
    }
    return;
  }
  if (e.key === 'm') {
    const next = !isMuted();
    setMuted(next);
    meta = { ...meta, mutedAudio: next };
    saveMeta(meta);
    return;
  }
  if (e.key === 'Enter') {
    const classId = classIds[selectedClassIndex]!;
    if (meta.unlockedClasses.includes(classId)) {
      startRun(classId);
    }
    return;
  }
  return;
}
```

Add the `purchaseClass` import alongside the existing `save.js` import:

```typescript
// in src/main.ts, change:
//   import { loadMeta, saveMeta, applyRunResult } from './save.js';
// to:
import { loadMeta, saveMeta, applyRunResult, purchaseClass } from './save.js';
```

Change `const meta = loadMeta();` to `let meta = loadMeta();` (needed for the reassignments above and in Task 2's mute handler — if Task 2 already made this change, this step is a no-op confirmation).

At the very bottom of the file, replace the unconditional `startFloor(1);` boot call — the game no longer starts a run immediately, it waits at the title screen:

```typescript
// replace:
//   startFloor(1);
//   requestAnimationFrame(loop);
// with:
requestAnimationFrame(loop);
```

Update `loop()` to render the title screen instead of the game world while `screen === 'title'`:

```typescript
// in loop(), change the body to:
function loop(): void {
  if (screen === 'title') {
    renderTitleScreen();
    requestAnimationFrame(loop);
    return;
  }
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
  render();
  requestAnimationFrame(loop);
}
```

And ensure `render()` itself also hides the title panel once gameplay starts — add this as the first line of `render()`:

```typescript
document.getElementById('title-screen')!.classList.add('hidden');
```

- [ ] **Step 4: Typecheck**

Run: `cd ~/voidcrawler && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Add minimal title-screen CSS so it's usable before Task 6's full theming pass**

```css
/* append to style.css */
#title-screen {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #0a0a0f; z-index: 10;
}
#title-screen h1 { font-size: 32px; letter-spacing: 4px; }
#class-list { margin: 16px 0; font-size: 14px; }
.title-hint { font-size: 12px; opacity: 0.7; }
```

- [ ] **Step 6: Manually verify in browser**

Refresh `http://localhost:8766/`.
Expected: the game boots to a title screen listing "Adventurer" (unlocked), "Berserker (locked — 100 currency)", "Rogue (locked — 150 currency)"; arrow keys move the `>` selection marker; pressing Enter on the unlocked Adventurer starts a run exactly as before; dying and reloading returns to the title screen (via `location.reload()`, which re-runs the whole boot sequence including the title-screen default) — confirm this explicitly, since `screen` resetting to `'title'` on every page load is what makes the reload-based restart flow from Phases A/B correctly land back on the title screen rather than skipping straight into a new run.

- [ ] **Step 7: Commit**

```bash
git add index.html src/main.ts style.css
git commit -m "Add title screen with class selection and unlock purchasing"
```

---

### Task 4: Perk-choice overlay UI

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `style.css`

**Interfaces:**
- Consumes: `pendingPerkChoice` (already exists from Phase B).
- Produces: a `#perk-choice` DOM panel that renders whenever `pendingPerkChoice` is non-null, replacing the log-line stand-in from Phase B (the log line stays too, as a combat-log record, but the *interactive* surface is now the panel, not just remembering what was printed).

- [ ] **Step 1: Add the perk-choice DOM to `index.html`**

```html
<!-- in index.html, add inside #game-root, alongside the other overlay panels: -->
<div id="perk-choice" class="hidden">
  <h2>Level Up! Choose a perk:</h2>
  <div id="perk-options"></div>
</div>
```

- [ ] **Step 2: Render the panel from `src/main.ts`**

```typescript
// add a render function near renderTitleScreen():
function renderPerkChoice(): void {
  const panel = document.getElementById('perk-choice')!;
  panel.classList.toggle('hidden', !pendingPerkChoice);
  if (!pendingPerkChoice) return;
  const optionsEl = document.getElementById('perk-options')!;
  optionsEl.innerHTML = pendingPerkChoice.map((perk, i) => `<div>${i + 1}) ${perk.label}</div>`).join('');
}

// call it from render(), alongside the other renderX(...) calls at the end of the function:
renderPerkChoice();
```

- [ ] **Step 3: Add CSS for the panel**

```css
/* append to style.css */
#perk-choice {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(10, 10, 20, 0.95); border: 1px solid #665; padding: 16px 24px;
  text-align: center; z-index: 5;
}
#perk-choice h2 { font-size: 16px; margin: 0 0 8px; }
#perk-options div { padding: 4px 0; font-size: 13px; }
```

- [ ] **Step 4: Typecheck**

Run: `cd ~/voidcrawler && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manually verify in browser**

Refresh, play until level 2.
Expected: a centered panel appears listing the 3 perk options by number as soon as the level-up happens, disappears the instant `1`/`2`/`3` is pressed and the perk is applied (unchanged keyboard handling from Phase B — only the *visual* surface is new).

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts style.css
git commit -m "Add interactive perk-choice overlay panel"
```

---

### Task 5: Death/victory summary screen

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `style.css`

**Interfaces:**
- Consumes: `gameState`, `floor.depth`, `kills`, `meta.currency` (all already exist).
- Produces: a `#run-summary` panel shown whenever `gameState !== 'playing'`, replacing the log-line-only ending from Phases A/B with a proper summary (floor reached, biome, kills, currency earned/total) plus a visible "Press Enter to continue" prompt (the `Enter`-reloads behavior itself is unchanged from Phase A).

- [ ] **Step 1: Add the run-summary DOM to `index.html`**

```html
<!-- in index.html, add inside #game-root: -->
<div id="run-summary" class="hidden">
  <h2 id="run-summary-title"></h2>
  <p id="run-summary-stats"></p>
  <p class="title-hint">Press Enter to continue</p>
</div>
```

- [ ] **Step 2: Track the last run's earned currency for display, and render the panel**

`endRun()` already computes `earned`/`updated.currency` locally but doesn't expose them past its own scope. Add module-level state to carry them into the render function:

```typescript
// add near the other module-level state:
let lastRunSummary: { state: 'dead' | 'victory'; floor: number; biome: string; kills: number; earned: number; totalCurrency: number } | null = null;

// in endRun(), replace the body with a version that also populates lastRunSummary:
function endRun(state: 'dead' | 'victory'): void {
  gameState = state;
  screen = state;
  const { updated, earned } = applyRunResult(meta, { floorReached: floor.depth, kills });
  meta = updated;
  saveMeta(meta);
  lastRunSummary = {
    state, floor: floor.depth, biome: biomeForDepth(floor.depth).name,
    kills, earned, totalCurrency: meta.currency,
  };
  log(state === 'dead'
    ? `You died on floor ${floor.depth}. Earned ${earned} currency (total ${meta.currency}).`
    : `You escaped the depths! Earned ${earned} currency (total ${meta.currency}).`);
}
```

(This also sets `screen = state`, which Task 3's title-screen gating doesn't otherwise handle — without it, `screen` would stay `'playing'` forever after death/victory since nothing else transitions it. This is a genuine gap Task 3 left open, closed here.)

Add the render function:

```typescript
function renderRunSummary(): void {
  const panel = document.getElementById('run-summary')!;
  panel.classList.toggle('hidden', !lastRunSummary);
  if (!lastRunSummary) return;
  const s = lastRunSummary;
  document.getElementById('run-summary-title')!.textContent = s.state === 'dead' ? 'You Died' : 'You Escaped!';
  document.getElementById('run-summary-stats')!.innerHTML = [
    `Reached floor ${s.floor} (${s.biome})`,
    `Kills: ${s.kills}`,
    `Currency earned: ${s.earned} (total: ${s.totalCurrency})`,
  ].join('<br>');
}

// call it from render(), alongside the other renderX(...) calls:
renderRunSummary();
```

- [ ] **Step 3: Add CSS for the panel**

```css
/* append to style.css */
#run-summary {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(10, 10, 20, 0.95); border: 1px solid #665; padding: 20px 32px;
  text-align: center; z-index: 5;
}
#run-summary h2 { font-size: 20px; margin: 0 0 12px; }
#run-summary-stats { font-size: 13px; line-height: 1.6; }
```

- [ ] **Step 4: Typecheck**

Run: `cd ~/voidcrawler && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manually verify in browser**

Refresh, play until death (or edit `player.hp = 1` via the browser console before taking a hit, to save time).
Expected: a centered "You Died" panel appears showing floor/biome/kills/currency, matching the combat log's numbers; pressing Enter reloads back to the title screen (per Task 3's verification, `screen` resets to `'title'` on fresh load).

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts style.css
git commit -m "Add death/victory run-summary overlay screen"
```

---

### Task 6: CSS theming pass

**Files:**
- Modify: `style.css`

**Interfaces:**
- Consumes: nothing — pure visual styling of the existing DOM structure from Tasks 1–5 and Phases A/B.
- Produces: a cohesive dark-fantasy palette applied consistently across `#hud`, `#inventory-panel`, `#combat-log`, `#title-screen`, `#perk-choice`, `#run-summary` — replacing the flat monospace-on-black look with real panel borders, spacing, and a title-appropriate font pairing, using only system fonts (no external font files, consistent with the "no external assets" constraint).

- [ ] **Step 1: Rewrite `style.css` in full**

```css
* { box-sizing: border-box; }

:root {
  --bg: #0a0a0f;
  --panel-bg: rgba(16, 14, 22, 0.92);
  --border: #4a3f5a;
  --accent: #c9a876;
  --text: #d8d0e0;
  --text-dim: #8a80a0;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Georgia', 'Times New Roman', serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

#game-root { position: relative; }
#game-canvas { background: #000; display: block; image-rendering: pixelated; }

#hud {
  position: absolute; top: 8px; left: 8px;
  background: var(--panel-bg); border: 1px solid var(--border); border-radius: 3px;
  padding: 6px 10px;
  font-family: 'Courier New', monospace;
  font-size: 13px; line-height: 1.5;
  text-shadow: 1px 1px 2px #000;
}

#combat-log {
  position: absolute; bottom: 8px; left: 8px;
  background: var(--panel-bg); border: 1px solid var(--border); border-radius: 3px;
  padding: 6px 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px; max-width: 340px; max-height: 90px;
  overflow: hidden; opacity: 0.9;
}

#inventory-panel {
  position: absolute; top: 8px; right: 8px;
  background: var(--panel-bg); border: 1px solid var(--border); border-radius: 3px;
  padding: 8px 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px; min-width: 200px;
}

.hidden { display: none; }

#title-screen {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--bg); z-index: 10;
}
#title-screen h1 {
  font-size: 36px; letter-spacing: 6px; color: var(--accent);
  text-shadow: 0 0 12px rgba(201, 168, 118, 0.4);
  margin-bottom: 4px;
}
#title-currency { color: var(--text-dim); font-size: 13px; margin: 4px 0 16px; }
#class-list {
  background: var(--panel-bg); border: 1px solid var(--border); border-radius: 4px;
  padding: 12px 20px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.8;
}
.title-hint { font-size: 12px; color: var(--text-dim); margin-top: 16px; }

#perk-choice, #run-summary {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: var(--panel-bg); border: 1px solid var(--border); border-radius: 4px;
  padding: 18px 28px; text-align: center; z-index: 5;
}
#perk-choice h2, #run-summary h2 {
  font-size: 18px; margin: 0 0 10px; color: var(--accent);
}
#perk-options { font-family: 'Courier New', monospace; font-size: 13px; }
#perk-options div { padding: 4px 0; }
#run-summary-stats {
  font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.7; color: var(--text);
}
```

This replaces (not appends to) the CSS added inline in Tasks 3–5 — those earlier steps' minimal CSS blocks are superseded by this single consistent pass rather than layered on top of them.

- [ ] **Step 2: Manually verify in browser**

Refresh `http://localhost:8766/`.
Expected: title screen, HUD, inventory, combat log, perk-choice, and run-summary panels all share the same dark-purple bordered panel look with a serif display font for headings and monospace for stats/logs; nothing overlaps or clips at the default window size; the game remains fully playable start-to-finish (title → class select → run → death/victory → reload → title).

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "Apply cohesive dark-fantasy CSS theme across all UI panels"
```

---

### Task 7: Full-suite regression check

**Files:** none (verification-only task)

- [ ] **Step 1: Run the full automated suite**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, 43/43 tests pass (unchanged from Task 2 — Tasks 3–6 touch only rendering/DOM/CSS, no unit-tested logic).

- [ ] **Step 2: Run the production build and verify it**

Run: `cd ~/voidcrawler && npm run build`
Expected: build succeeds.
Run: `cd ~/voidcrawler && npx vite preview --port 8767 &`
Open `http://localhost:8767/`, play a full run start-to-finish (title screen → class select → combat with sprites/sound → level-up perk choice → death or victory → summary screen → reload).
Expected: identical behavior to the dev server, no console errors, confirming the built artifact (what GitHub Pages will serve in Phase E) is fully playable.

- [ ] **Step 3: No commit** — this task is a verification gate, not a code change.

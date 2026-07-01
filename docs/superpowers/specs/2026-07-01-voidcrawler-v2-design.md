# Voidcrawler V2 ("Complete Edition") — Design Spec

Date: 2026-07-01
Status: Approved
Supersedes: `2026-07-01-voidcrawler-design.md` (v1) for everything below — v1 remains accurate history of what was built first; this spec describes what changes and what's added on top.

## Purpose

Take the working v1 roguelike (9 floors, 3 monster archetypes, 1 boss, itemization, permadeath meta-progression — vanilla JS, zero build step, zero external assets) to a genuinely production-shaped release: significantly more game content, real visual/audio polish, production engineering practices, and a public, playable/downloadable launch.

## Scope, In Four Parts

### 1. Content & systems expansion

- **Monster archetypes: 3 → 7.** Keep `rusher`, `caster`, `trapper`. Add:
  - `brute` — slow (moves every other turn), tanky, heavy single hits, no ranged/flee behavior.
  - `swarmling` — very low HP/damage, fast sight range, spawns 2–3 to a room instead of 1; meant to be fought as a group.
  - `shaman` — low HP, doesn't attack directly; each turn it's aggro'd, has a chance to heal or buff the nearest damaged ally instead of moving/attacking.
  - `stalker` — invisible (excluded from the player's FOV set) until the player is adjacent, then behaves like a rusher; a genuine ambush archetype.
- **9 total floors, restructured into 3 biomes of 3 floors each**: Catacombs (1–3), Fungal Caverns (4–6), Void Depths (7–9). Within each biome, the first 2 floors are regular (monster spawns per the biome's weighting) and the 3rd is that biome's boss floor — so floors 3, 6, and 9 are boss floors (6 regular + 3 boss, replacing v1's 8 regular + 1 boss). Each biome has its own tile color palette and its own per-biome monster spawn weighting (e.g., caverns lean on swarmlings, depths lean on stalkers/shamans).
- **3 unique bosses, one per biome**, each a distinct archetype (different stats/behavior, not just a stat-scaled reskin) that ends that biome and, on floor 9, ends the run in victory.
- **3 starting classes**: `adventurer` (balanced, existing), `berserker` (higher STR/damage, lower dodge, lower starting HP), `rogue` (higher DEX/crit/dodge, lower HP, starts with a dagger). Berserker and rogue are locked until purchased with meta-currency between runs (adventurer is always available, as today).
- **Perk system replaces the flat "press p for +STR" mechanic.** Every 2 player levels, present 3 perks drawn from a fixed pool (e.g. `+15% max HP`, `+8% crit chance`, `+10% dodge chance`, `lifesteal on crit`, `+1 trap damage resistance`); the player picks one via a choice UI. This is a meaningful decision point per level-up band, not automatic.
- **Accessory equipment slot** (rings/amulets) added alongside weapon/armor, with its own affix pool (distinct from weapon/armor affixes — e.g. `+max HP`, `+status resistance`, `+XP gain`).

### 2. Visual & audio polish

- **Procedural sprites, not solid-color squares.** Each entity type (player, each monster archetype, item rarity tiers, tile types) gets a small hand-authored pixel pattern drawn via Canvas 2D `fillRect` calls from a compact bitmap definition (e.g. an 8x8 or 10x10 grid of on/off cells per sprite, colored per archetype). No external image files — sprites are data structures in the source, keeping the "clone and run, nothing missing" property v1 had.
- **WebAudio-synthesized sound effects.** Hit, crit, miss, dodge, death, level-up, item pickup, footstep (optional, throttled), boss-encounter sting — all built from short `OscillatorNode`/`GainNode` envelopes at runtime, no audio files. A single mute toggle (persisted in the same meta-progression `localStorage` entry) controls all of it.
- **Title screen**: class selection (locked classes shown grayed out with their unlock cost), "New Run" / "Continue" (continue only enabled if a meta-save exists), mute toggle.
- **Styled death/victory screen**: run summary (floor reached, biome, monsters killed, currency earned, time survived) rendered as a proper overlay panel, not just a combat-log line — still triggered by the same `endRun()` path as v1.
- **CSS theming pass**: replace the plain monospace-on-black HUD/inventory/log panels with a cohesive dark fantasy palette, real panel borders/spacing, and a title font — still zero external font/asset dependencies (system font stack + CSS only).

### 3. Engineering rigor

- **TypeScript, strict mode**, for all of `src/`. This reverses v1's explicit "no build step" constraint — appropriate now that "production ready" is the stated goal. Type definitions formalize the interfaces already documented informally in the v1 implementation plan (`Floor`, `Player`, `Monster`, `Item`, combat/AI action shapes, etc.).
- **Vite** as the dev server and production build tool. `npm run dev` for local iteration, `npm run build` emits static output to `dist/`.
- **Vitest** replaces `node --test` for the logic-test suite (same tests, same coverage philosophy: pure deterministic modules get real unit tests; canvas/DOM/input glue is verified live in-browser, not mocked).
- **ESLint + Prettier** for consistency across the larger codebase.
- **GitHub Actions CI**: on every push, run typecheck → lint → test → build. A separate (or combined) job publishes `dist/` to GitHub Pages on pushes to `main`.
- **Explicitly not adding Playwright/Puppeteer-driven e2e browser tests.** This sandboxed environment is known to kill headless browser processes (exit 144) — committing a CI step that can't run reliably here would be worse than not having it. Correctness is instead covered by strict TypeScript, the Vitest suite, and manual verification through the already-proven claude-in-chrome live-browser workflow before each release.

### 4. Launch

- New **public GitHub repository** `skeletont638-code/voidcrawler`, pushed from the existing local history (the v1 commits carry over as real project history, not squashed).
- **README** with a one-line pitch, a GIF/screenshot if feasible, "play in browser" link (GitHub Pages), and "clone and run locally" instructions (`npm install && npm run dev`), plus controls and system list.
- **GitHub Pages**, auto-deployed by the CI workflow's build job — the game is playable directly from a URL, not download-only, in addition to being a clonable repo.

## Explicitly Out of Scope (still, even for V2)

Multiplayer, a real audio *file* pipeline (music/SFX stay synthesized), mobile/touch controls, server-side anything (leaderboards, accounts) — this stays a static, client-only game. Native/downloadable-executable packaging (e.g. Electron) is not included; "downloadable" means "clone the repo and run it locally," consistent with how the README frames it.

## Migration Notes (v1 → v2)

- Every `src/*.js` module gets a `.ts` counterpart with the same exported names/shapes; the v1 implementation plan's documented interfaces become the starting point for type signatures, not a rewrite from scratch.
- The existing `tests/*.test.js` files port to Vitest with minimal changes (`node:test`/`node:assert` calls become `vitest` equivalents) plus new tests for the new content (new archetypes, biomes, perks, accessories).
- `index.html`/`style.css` are reworked for the title screen and new theming, but the core `#game-canvas` + world-space rendering approach from v1 is retained.
- Meta-progression's `localStorage` shape gains new fields (`unlockedClasses` already existed for this; add `mutedAudio: boolean`) — `loadMeta()`'s existing merge-with-defaults fallback means old v1 saves degrade gracefully rather than crashing.

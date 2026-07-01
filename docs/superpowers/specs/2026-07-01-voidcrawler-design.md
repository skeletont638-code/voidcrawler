# Voidcrawler — Design Spec

Date: 2026-07-01
Status: Approved

## Purpose

A capability showcase: a genuinely playable, systemically complex browser roguelike, built with zero frameworks and zero build step. The point is to demonstrate interlocking game systems (procedural generation, FOV, AI, itemization, progression) working together, not just a single flashy trick.

## Platform & Constraints

- Vanilla HTML5 + Canvas 2D + ES modules. No frameworks, no bundler, no backend.
- Runs by opening `index.html` in a browser (served locally to satisfy ES module CORS rules, e.g. `python3 -m http.server` or the `run` skill).
- Keyboard-only input. Single player, single browser tab, no persistence beyond `localStorage`.
- Out of scope for v1: multiplayer, sound, touch controls, mid-run save/quit (permadeath only — a run ends in victory or death, no resuming mid-run).

## Architecture

Single-page app, ES modules, no build step:

- `main.js` — entry point, owns the `Game` object, the requestAnimationFrame loop, and input→action wiring.
- `dungeon.js` — BSP-tree dungeon generation, tile grid, recursive shadowcasting FOV/fog-of-war.
- `entities.js` — `Player`, `Monster` classes, stats, leveling, monster archetypes and their FSM behaviors, A* pathfinding.
- `combat.js` — turn resolution: damage formulas (crit/dodge), status effects (poison, burn), death handling.
- `items.js` — item definitions, procedural affix generation, rarity tiers, loot tables per floor, identify-on-use.
- `ui.js` — HUD (HP/level/floor), inventory panel, character sheet, minimap, combat log, floating damage numbers.
- `save.js` — `localStorage` read/write for meta-progression (currency, unlocked perks/classes); corrupt/missing save falls back to a fresh default silently.
- `fx.js` — juice: screen shake, particle bursts, tile movement tweening.

`Game` holds all mutable run state (dungeon, entities, turn queue, UI state) in one place; modules are pure functions/classes operating on that state rather than owning global singletons, so each module can be reasoned about independently.

## Core Systems

### Procedural dungeons
BSP (binary space partition) recursively splits the floor into regions, carves a room per leaf, connects sibling rooms with L-shaped corridors. 8 regular floors + 1 boss floor. Difficulty (monster count/strength, loot tier) scales with floor depth.

### Fog of war
Recursive shadowcasting computes the visible set from the player's position each turn. Tiles are in one of three states: unseen (black), previously-seen-but-not-visible (dimmed), currently visible (full brightness). Previously-seen tiles remain on the map permanently once discovered.

### Turn-based combat
Strict alternating turns: player acts once, then every monster that is awake and has line-of-sight/hearing-range to the player acts once. Damage = base weapon/monster damage ± variance, modified by crit chance (bonus damage) and dodge chance (negates hit). Status effects (poison: damage-over-time; burn: damage-over-time + higher variance) tick at the start of the afflicted entity's turn.

### Enemy AI
Each monster runs a finite state machine: `idle/patrol` (wanders or holds position) → `aggro` (triggered by line-of-sight or being hit) → `chase` (A* pathfinds toward the player's last known position) → `attack` (when adjacent, or ranged in line-of-sight for ranged archetypes) → `flee` (below an HP threshold, for archetypes that flee). Three archetypes ship in v1: melee rusher (chase + attack), ranged caster (holds distance, line-of-sight attacks), trap-setter (stationary, places damage tiles).

### Itemization
Weapons, armor, and consumables. Weapons/armor roll 0–3 procedural affixes (e.g. +damage, +crit chance, +resistance) from a per-rarity-tier pool (common/uncommon/rare/legendary — higher tiers roll more affixes and larger values). Potions and scrolls spawn unidentified; using one for the first time identifies that item type for the rest of the run.

### Progression
Killing monsters grants XP; leveling grants stat points the player allocates (STR/DEX/VIT, or similar). Death ends the run permanently — no mid-run reload. On run end (death or victory), the player's floor depth and kills convert to meta-currency, spent between runs on permanent unlocks: alternate starting classes and starting perks. Meta-progression persists via `localStorage`; a run itself never persists.

### Juice / polish
Floating damage numbers on hit, screen shake on crits and player damage taken, particle burst on death, minimap showing explored floor layout, smooth tile-to-tile movement animation instead of instant snapping.

## Data Flow

1. Keyboard input → `main.js` maps key to an action (move/attack/use-item/wait).
2. `Game.update(action)` resolves the player's action against current state (movement, attack via `combat.js`, item use via `items.js`).
3. FOV recomputed (`dungeon.js`) from the player's new position.
4. All awake monsters take their turn in sequence (AI decision via `entities.js`, resolution via `combat.js`).
5. `fx.js` records any transient effects (shake/particles/floating numbers) triggered during steps 2–4.
6. Render pass: `main.js` draws the tile grid + fog state, entities, and transient FX; `ui.js` redraws HUD/inventory/log from current state.

## Error Handling & Edge Cases

Game-appropriate, not production-service-appropriate:

- Moving into a wall/closed door: no-op plus a "bump" animation, no error state.
- Using an item with an empty inventory slot, or an action with no valid target: action is disabled/no-op, not an exception.
- Player death: input locks except "restart," death screen shows run summary and currency earned.
- Corrupted or missing `localStorage` save: `save.js` catches the parse failure and falls back to fresh default meta-progression rather than crashing.

## Testing Approach

This is an interactive visual game — the primary verification is playing it end-to-end (multiple floors, item pickup, death, level-up) via a browser, not unit tests. Two pieces of deterministic logic are worth unit-testing directly since they fail silently otherwise:

- Dungeon generation: every generated floor has all rooms mutually reachable (no isolated rooms).
- Combat math: damage/crit/dodge formulas produce expected results for known inputs.

## Explicitly Out of Scope (v1)

Multiplayer, sound/music, touch/mobile controls, mid-run save-and-resume, more than 3 monster archetypes, more than 4 item rarity tiers.

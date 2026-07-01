# Voidcrawler

A procedurally generated roguelike dungeon crawler, built entirely in TypeScript with zero external assets — every sprite is drawn from in-source pixel data, every sound effect is synthesized at runtime with the Web Audio API.

**[Play now →](https://skeletont638-code.github.io/voidcrawler/)**

## Features

- 9 procedurally generated floors across 3 biomes (Catacombs, Fungal Caverns, Void Depths), each with a unique boss
- 7 monster archetypes with genuinely distinct AI: a slow tank, a fast pack-spawning swarm, an ally-healing support caster, an ambush predator invisible until adjacent, and more
- Turn-based tactical combat with crits, dodges, and status effects
- Procedural itemization — weapons, armor, and accessories with randomized affixes across 4 rarity tiers
- A perk-choice leveling system: pick a build-defining perk every 2 levels
- 3 starting classes, unlockable with currency earned from runs
- Permadeath with persistent meta-progression between runs

## Controls

| Key        | Action                                                            |
| ---------- | ----------------------------------------------------------------- |
| Arrow keys | Move / attack (walk into a monster to attack it)                  |
| `g`        | Pick up item on current tile                                      |
| `i`        | Toggle inventory                                                  |
| `1`–`9`    | Equip/use inventory item, or pick a perk/class at a choice screen |
| `m`        | Toggle sound                                                      |
| `↑` / `↓`  | Select class (title screen)                                       |
| `b`        | Buy the selected locked class (title screen)                      |
| `Enter`    | Start run / continue past death or victory screens                |

## Run it locally

```bash
git clone https://github.com/skeletont638-code/voidcrawler.git
cd voidcrawler
npm install
npm run dev
```

Then open the printed `localhost` URL. No external assets, no backend, no build step required beyond `npm install` — the whole game is TypeScript + Canvas + Web Audio.

## Development

```bash
npm run typecheck    # TypeScript strict mode, zero errors
npm run lint          # ESLint
npm run format:check  # Prettier
npm test              # Vitest — deterministic game logic (dungeon generation,
                       # combat math, AI, itemization, save/meta-progression)
npm run build          # Production build to dist/
```

Rendering, input, and audio are verified by playing the game, not unit-tested — Canvas/DOM/AudioContext have no meaningful behavior outside a real browser. Everything else (dungeon generation connectivity, combat math, pathfinding, AI state transitions, itemization, save/load) has real automated test coverage.

## Tech

TypeScript (strict mode), Vite, Vitest, vanilla Canvas 2D rendering, the Web Audio API for sound. No game framework, no asset pipeline — deliberately built from first principles.

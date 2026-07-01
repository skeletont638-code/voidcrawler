# Voidcrawler V2 Phase E: Launch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Voidcrawler as a public GitHub repository with a clear README (clone-and-run instructions) and a live, auto-deployed GitHub Pages build, so it's playable both by downloading/cloning and by visiting a URL directly.

**Architecture:** Push the existing local git history (20+ commits of real project history, not squashed) to a new public repo. Extend the existing CI workflow with a `deploy` job using GitHub's official Actions-based Pages deployment (`actions/upload-pages-artifact` + `actions/deploy-pages`), gated to only run on pushes to `main` after the existing checks pass. Author a README that leads with what the game is, then splits into "Play now" (Pages link) and "Run locally" (clone instructions).

**Tech Stack:** `gh` CLI (already authenticated as `skeletont638-code`), GitHub Actions Pages deployment actions.

## Global Constraints

- This is a genuinely public, external action (new public repo, live URL) — confirm the exact repo name and visibility with the user before creating it, even though "launch it on GitHub as a free game to download" already authorizes the action in general.
- `base: './'` is already set in `vite.config.ts` from Phase A, which is what makes the built `dist/` output work when served from a GitHub Pages subpath rather than domain root — no Vite config change needed for Pages compatibility.
- No secrets or private data anywhere in the repo — this codebase has never touched credentials (confirmed: `save.ts`/`localStorage` is the only persistence, no API keys, no `.env`).

---

### Task 1: Write the README

**Files:**
- Create: `README.md`

**Interfaces:** None — this is documentation only.

- [ ] **Step 1: Write `README.md`**

```markdown
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

| Key | Action |
| --- | --- |
| Arrow keys | Move / attack (walk into a monster to attack it) |
| `g` | Pick up item on current tile |
| `i` | Toggle inventory |
| `1`–`9` | Equip/use inventory item, or pick a perk/class at a choice screen |
| `m` | Toggle sound |
| `↑` / `↓` | Select class (title screen) |
| `b` | Buy the selected locked class (title screen) |
| `Enter` | Start run / continue past death or victory screens |

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
npm run typecheck   # TypeScript strict mode, zero errors
npm run lint         # ESLint
npm run format:check # Prettier
npm test             # Vitest — deterministic game logic (dungeon generation,
                      # combat math, AI, itemization, save/meta-progression)
npm run build         # Production build to dist/
```

Rendering, input, and audio are verified by playing the game, not unit-tested — Canvas/DOM/AudioContext have no meaningful behavior outside a real browser. Everything else (dungeon generation connectivity, combat math, pathfinding, AI state transitions, itemization, save/load) has real automated test coverage.

## Tech

TypeScript (strict mode), Vite, Vitest, vanilla Canvas 2D rendering, the Web Audio API for sound. No game framework, no asset pipeline — deliberately built from first principles.
```

- [ ] **Step 2: Commit**

```bash
cd ~/voidcrawler && git add README.md
git commit -m "Add README"
```

---

### Task 2: Add the GitHub Pages deploy job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the existing `build-and-test` job's success as a gate (`needs:`).
- Produces: a live URL at `https://skeletont638-code.github.io/voidcrawler/` after every successful push to `main`.

- [ ] **Step 1: Add a `deploy` job to `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: build-and-test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate the YAML**

Run: `cd ~/voidcrawler && python3 -c "import yaml; d = yaml.safe_load(open('.github/workflows/ci.yml')); print('jobs:', list(d['jobs'].keys()))"`
Expected: `jobs: ['build-and-test', 'deploy']`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Add GitHub Pages deployment job to CI workflow"
```

---

### Task 3: Create the GitHub repository and push

**Files:** none — this is a `gh`/`git` operations task.

- [ ] **Step 1: Confirm with the user** (see Global Constraints) — repo name `voidcrawler`, public visibility, under the already-authenticated `skeletont638-code` account.

- [ ] **Step 2: Create the repository**

```bash
gh repo create skeletont638-code/voidcrawler --public --source=. --description "A procedurally generated roguelike dungeon crawler — TypeScript, zero external assets, synthesized audio."
```

Expected: repo created, `origin` remote added automatically by `gh repo create --source=.`.

- [ ] **Step 3: Push all history**

```bash
git push -u origin main
```

Expected: all ~35 commits pushed, `main` tracking `origin/main`.

- [ ] **Step 4: Enable GitHub Pages with the Actions build source**

```bash
gh api repos/skeletont638-code/voidcrawler/pages -X POST -f "build_type=workflow"
```

Expected: 201 Created (or 409 if Pages was already enabled by the first workflow run — either is fine).

- [ ] **Step 5: Verify the CI workflow runs and succeeds**

```bash
gh run list --repo skeletont638-code/voidcrawler --limit 3
```

Expected: a run against the just-pushed commit, eventually showing `completed`/`success` for both jobs (poll with `gh run watch` if still in progress).

- [ ] **Step 6: Verify the live Pages URL actually serves the game**

Once `deploy` succeeds, navigate to `https://skeletont638-code.github.io/voidcrawler/` in a real browser and confirm the title screen loads with no console errors — this is the actual "download-free, play now" surface the README promises, so it must be verified live, not just assumed from a green CI check.

# Voidcrawler V2 Phase D: Engineering Rigor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ESLint + Prettier for code consistency and a GitHub Actions CI workflow that typechecks, lints, tests, and builds on every push — closing out the "production engineering" half of the V2 spec.

**Architecture:** `typescript-eslint`'s flat-config recommended preset + `eslint-config-prettier` (to disable any ESLint rules that would conflict with Prettier's formatting) as a single `eslint.config.js`; Prettier gets a minimal `.prettierrc.json`; both wire into new `package.json` scripts. The CI workflow is one GitHub Actions YAML file with a single job running the same four checks a contributor would run locally (`typecheck`, `lint`, `test`, `build`), so CI is never checking something local development doesn't already cover.

**Tech Stack:** ESLint 10.6 (flat config), `typescript-eslint` 8.62, `eslint-config-prettier` 10.1, Prettier 3.9, GitHub Actions.

## Global Constraints

- No behavior change — this phase touches only tooling config and CI, never `src/`.
- Every existing test must keep passing; `npx tsc --noEmit` must stay at zero errors.
- Lint config should catch real mistakes (unused vars, `no-explicit-any` violations) without being so strict it fights the codebase's existing, already-reviewed style — start from the recommended preset rather than hand-picking a large custom rule set.

---

### Task 1: ESLint + Prettier setup

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run lint` (ESLint over `src/` and `tests/`), `npm run format` (Prettier write), `npm run format:check` (Prettier check, used by CI) — all added as new `package.json` scripts alongside the existing `dev`/`build`/`test`/`typecheck`.

- [ ] **Step 1: Install dependencies**

```bash
cd ~/voidcrawler && npm install --save-dev eslint@^10.6.0 typescript-eslint@^8.62.1 eslint-config-prettier@^10.1.8 prettier@^3.9.4
```

Expected: `package.json`'s `devDependencies` gains the four packages, `package-lock.json` updates, no errors.

- [ ] **Step 2: Create `eslint.config.js`**

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
);
```

- [ ] **Step 3: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 120,
  "trailingComma": "all"
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
dist/
node_modules/
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
// in package.json, "scripts" — add these three entries alongside the existing dev/build/preview/test/typecheck:
"lint": "eslint src tests",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 6: Run lint and format-check, fix whatever they surface**

Run: `cd ~/voidcrawler && npm run lint`
Expected: some findings against the existing Phases A–C code (most likely: `@typescript-eslint/no-unused-vars` warnings, if any leftover unused bindings exist from earlier phases' edits). Fix each one directly in the flagged file — do not disable the rule to make warnings disappear.

Run: `cd ~/voidcrawler && npm run format:check`
Expected: Prettier reports files that don't match its formatting (likely most of `src/`, since none of it was written with Prettier active). Run `npm run format` to auto-fix, then re-run `format:check` to confirm zero remaining diffs.

- [ ] **Step 7: Re-run the full verification stack after formatting**

Run: `cd ~/voidcrawler && npx tsc --noEmit && npx vitest run && npm run lint && npm run format:check`
Expected: zero type errors, 43/43 tests pass, zero lint errors, zero format diffs — confirms Prettier's reformatting didn't change behavior, only whitespace/quote style.

- [ ] **Step 8: Commit**

```bash
git add eslint.config.js .prettierrc.json .prettierignore package.json package-lock.json src/ tests/
git commit -m "Add ESLint + Prettier tooling and reformat the codebase"
```

---

### Task 2: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `typecheck`/`lint`/`format:check`/`test`/`build` npm scripts from Task 1 and Phase A.
- Produces: a CI check that runs on every push and pull request against any branch, giving a pass/fail signal Phase E's README can reference (e.g. a status badge, added in Phase E once the repo is public and the workflow has run at least once).

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:

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
```

- [ ] **Step 2: Validate the YAML is well-formed**

Run: `cd ~/voidcrawler && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || node -e "require('js-yaml')" 2>&1`

If neither `python3`'s `yaml` module nor a local `js-yaml` is available, do a simpler structural sanity check instead:

Run: `cd ~/voidcrawler && node -e "const fs=require('fs'); const t=fs.readFileSync('.github/workflows/ci.yml','utf8'); if(!t.includes('runs-on') || !t.includes('actions/checkout')) throw new Error('malformed workflow'); console.log('OK')"`
Expected: `OK` printed, no errors — this workflow will get its real validation from GitHub itself once pushed (Phase E), but this catches gross structural mistakes (bad indentation causing missing keys) before that point.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Add GitHub Actions CI workflow (typecheck, lint, format, test, build)"
```

# CI-FIX — TS7016 import-curriculum-units.mjs (@cmc/scripts)

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Ownership:** `packages/db/**`, `scripts/**` only  
**Date:** 2026-08-12  
**Commit:** none

## Symptom (CI)

`typecheck-and-test` / `@cmc/scripts` typecheck:

```text
scripts/ensure-curriculum-units.ts(19,39): error TS7016:
  Could not find a declaration file for module
  '../packages/db/prisma/import-curriculum-units.mjs'.
  '.../import-curriculum-units.mjs' implicitly has an 'any' type.
```

## Root cause

- `packages/db/prisma/import-curriculum-units.mjs` is plain ESM JavaScript (no types).
- `scripts/ensure-curriculum-units.ts` imports it under `strict` + `moduleResolution: NodeNext`.
- `scripts/tsconfig.json` has `allowJs: false` and only `include: ["**/*.ts"]`.
- Same `.mjs` is also imported by `packages/db/prisma/seed.mjs` via Node (`node prisma/seed.mjs`) — must stay runnable without a build step.

## Fix chosen

Add a sibling TypeScript declaration for NodeNext ESM resolution:

**`packages/db/prisma/import-curriculum-units.d.mts`**

- TypeScript resolves `import-curriculum-units.mjs` → sibling `import-curriculum-units.d.mts`.
- Runtime: Node ignores `.d.mts`; `seed.mjs` and `node --test scripts/import-curriculum-units.test.mjs` unchanged.
- Declares exported constants + pure helpers + `importCurriculumUnits(db: PrismaClient, …)`.

### Alternatives considered

| Option | Why not |
|--------|---------|
| Convert importer to `.ts` | Would force seed path to use `tsx`/build; breaks “plain `node prisma/seed.mjs`” convention |
| `// @ts-expect-error` / `any` cast in ensure script | Hides contract; worse DX |
| `allowJs: true` on scripts | Wider surface than needed; still weak types on the mjs |

Repo precedent: other dual-use seed helpers stay as side-effect-free `.mjs` (`seed-constants.mjs`); adding a sibling declaration is the least invasive way to type the first TS consumer.

## Files changed

```text
packages/db/prisma/import-curriculum-units.d.mts   (new)
```

No change to `import-curriculum-units.mjs`, `seed.mjs`, or `ensure-curriculum-units.ts` logic.

## Verification

```text
# scripts package alone
cd scripts && npx tsc -p tsconfig.json --noEmit
→ exit 0

# root (with .env as CI-like)
cd /home/manhquy/Downloads/cmc_edu
set -a && . ./.env && set +a && pnpm typecheck
→ Tasks: 34 successful, 34 total  (exit 0)
→ @cmc/scripts:typecheck included and green
→ No missing-env turbo failure in this run

# importer unit tests
node --test scripts/import-curriculum-units.test.mjs
→ 7/7 pass
```

## Status

**DONE** — CI blocker TS7016 fixed; dual consumers (TS ensure + Node seed) preserved; no commit.

---
phase: 3
title: Wire ops smoke statusbar
status: completed
priority: P1
dependencies:
  - 2
---

# Phase 3: Wire ops smoke statusbar

## Overview

Replace brittle `smoke-statusbar.mjs` href scrape with a thin `tsx` ops runner that reuses the Phase 2 helper and measures sticky CSS against **rebuilt prod admin** (`https://localhost/admin`).

## Requirements

- Functional: exit 0 only if both kinds measure sticky statusbar + non-sticky summary.
- Functional: hard-fail if openSeededDetail throws (missing seed).
- Non-functional: read `.env.prod` via helper; ignoreHTTPSErrors; viewport 1280×900.

## Architecture

```text
tsx apps/e2e/smoke-statusbar.ts
  → loadProdEnv(.env.prod)
  → chromium → loginAsSuperAdmin
  → openSeededDetail ×2 → getComputedStyle assertions
  → JSON summary to stdout → exit code
```

## Related Code Files

- Create: `apps/e2e/smoke-statusbar.ts`
- Delete or stub-deprecation: `apps/e2e/smoke-statusbar.mjs` (remove href scrape; prefer delete after ts lands)
- Reuse: Phase 2 helper only for nav/login

## TDD

| Step | Action |
|------|--------|
| Tests Before | Playwright contract already covers grammar; ops is integration smoke |
| Refactor | Delete scrape heuristics |
| Tests After | Manual ops run documented in success criteria |
| Regression Gate | `cd apps/e2e && pnpm exec tsx smoke-statusbar.ts` exit 0 on seeded rebuilt stack |

## Implementation Steps

1. Port measure() from current `.mjs` into `.ts` smoke.
2. Wire helper; remove `pickHref` / finance+crm href scan.
3. Delete `.mjs` (or one-line redirect comment pointing to tsx command).
4. Run against cmcv2 after `./scripts/rebuild-cmcv2-admin.sh` when CSS ship needs proof.

## Success Criteria

- [ ] No UUID href scrape in smoke sources
- [ ] Seeded prod stack → exit 0 + JSON `pass: true`
- [ ] Empty lists → non-zero exit + clear stderr/JSON reason
- [ ] Playwright suite still green

## Risk Assessment

- Privacy hook blocking argv with `.env.prod` — keep load inside helper reading fixed path (already pattern).
- Rebuild required for CSS — document; smoke failing after code-only change without rebuild is expected.

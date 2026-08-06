---
title: Design3 detail grammar validation harness (TDD)
description: >-
  Two-layer validation for DetailPage Odoo grammar (sticky thin statusbar):
  shared openSeededDetail helper, Playwright CI contract, thin ops smoke. Seed
  required; hard-fail empty lists. No href scrape.
status: completed
priority: P1
branch: feat/design3-admin-rollout
tags:
  - design3
  - odoo
  - e2e
  - tdd
  - validation
blockedBy: []
blocks: []
created: '2026-08-06T04:30:00.690Z'
createdBy: 'ck:plan'
source: skill
---

# Design3 detail grammar validation harness (TDD)

## Overview

Prove form detail grammar on **live** admin after Design3 rebuilds and in CI — without brittle `a[href]` scraping.

**Brainstorm (authority):** `plans/reports/brainstorm-260806-design3-detail-grammar-validation.md`  
**Approach B:** shared `openSeededDetail` + thin ops smoke + Playwright contract  
**Policy:** require seed; hard-fail if list empty  
**Independent of** `260806-1045-odoo-grammar-gap-cook` (statusbar CSS already cooked; this is proof harness)

## Locked decisions

| Topic | Decision |
|-------|----------|
| Detail entry | Click real list/pipeline UX (not href scrape, not API cold-goto this round) |
| Paths | `/finance/:uuid`, `/crm/opportunities/:uuid` |
| Empty data | Hard-fail with clear error |
| Helper module | `apps/e2e/src/design3/open-seeded-detail.ts` |
| Ops runner | `tsx apps/e2e/smoke-statusbar.ts` (replace brittle `.mjs` href scrape) |
| Reuse | Prefer `findInList` for receipt table rows; CRM cards = dedicated locator |
| Env | `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (`.env.prod` or CI) |
| Out of scope | Auto-seed, design3 audit detail matrix (phase 2 later), list theater, Settings xia |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [RED Playwright contract](./phase-01-red-playwright-contract.md) | Completed |
| 2 | [GREEN openSeededDetail helper](./phase-02-green-openseededdetail-helper.md) | Completed |
| 3 | [Wire ops smoke statusbar](./phase-03-wire-ops-smoke-statusbar.md) | Completed |
| 4 | [Docs pointer sync](./phase-04-docs-pointer-sync.md) | Completed |

## Cook order (serial TDD)

```text
1 RED contract (failing) → 2 GREEN helper → 3 ops smoke wire → 4 docs
```

## File ownership

| Phase | Owns |
|-------|------|
| 1 | `apps/e2e/tests/design3-statusbar.ui.spec.ts` (new); stub import path only |
| 2 | `apps/e2e/src/design3/open-seeded-detail.ts` (+ login/env helpers colocated or sibling) |
| 3 | `apps/e2e/smoke-statusbar.ts` (replace `.mjs`); delete or deprecate scrape `.mjs` |
| 4 | Pointers in dissection AGENT map / VIEW-GRAMMAR / cook notes — markdown only |

## Acceptance (plan-level)

- [ ] Playwright contract green against seeded stack (receipt + opportunity sticky)
- [ ] Ops smoke exit 0 with same sticky/summary rules
- [ ] Empty list → hard-fail message includes `seeded` / kind
- [ ] No `a[href]` UUID scrape remains for these two surfaces
- [ ] `pnpm --filter @cmc/e2e typecheck` green

## Pipeline

```text
/ck:plan --tdd (this) → [optional red-team/validate] → /ck:cook …/plan.md --tdd
```

## Open questions

None material — brainstorm closed seed + approach B.

# R8 — Live verification

**Date:** 2026-08-06  
**Lane:** R8 Live tests (datefield / filterbar consumers)  
**Runner:** package-local `pnpm exec vitest run` (not monorepo root)  
**Status:** **PASS**

## Commands

### packages/ui

```bash
cd packages/ui && pnpm exec vitest run \
  src/components/date-field.test.tsx \
  src/components/filter-bar.test.tsx \
  src/odoo/odoo-cp-sheet.test.ts
```

### apps/admin

```bash
cd apps/admin && pnpm exec vitest run \
  src/pages/hr/kpi.test.tsx \
  src/pages/crm/pipeline.test.tsx \
  src/pages/parents/index.test.tsx \
  src/pages/admin/audit-log.test.tsx \
  src/pages/engagement/gifts.test.tsx \
  src/pages/finance/receipt-list.test.tsx
```

> Note: running admin tests from monorepo root without `apps/admin` vitest config is invalid (missing `CSS.escape` setup). Package CWD required.

## Results overview

| Suite | Files | Tests | Pass | Fail | Duration |
|-------|------:|------:|-----:|-----:|---------:|
| `packages/ui` | 3 | 11 | 11 | 0 | 2.36s |
| `apps/admin` | 6 | 70 | 70 | 0 | 7.97s |
| **Total** | **9** | **81** | **81** | **0** | — |

Vitest: v4.1.10

## packages/ui detail

| File | Tests | Duration | Result |
|------|------:|---------:|--------|
| `src/odoo/odoo-cp-sheet.test.ts` | 6 | 20ms | PASS |
| `src/components/date-field.test.tsx` | 3 | 124ms | PASS |
| `src/components/filter-bar.test.tsx` | 2 | 177ms | PASS |

- Test Files: 3 passed (3)
- Tests: 11 passed (11)
- Start: 15:39:06
- Duration: 2.36s (transform 168ms, setup 409ms, import 637ms, tests 321ms, environment 4.12s)

## apps/admin detail

| File | Tests | Duration | Result |
|------|------:|---------:|--------|
| `src/pages/admin/audit-log.test.tsx` | 5 | 733ms | PASS |
| `src/pages/engagement/gifts.test.tsx` | 4 | 1008ms | PASS |
| `src/pages/finance/receipt-list.test.tsx` | 8 | 1581ms | PASS |
| `src/pages/parents/index.test.tsx` | 5 | 1624ms | PASS |
| `src/pages/hr/kpi.test.tsx` | 18 | 2721ms | PASS |
| `src/pages/crm/pipeline.test.tsx` | 30 | 4535ms | PASS |

- Test Files: 6 passed (6)
- Tests: 70 passed (70)
- Start: 15:39:06
- Duration: 7.97s (transform 3.10s, setup 753ms, import 9.46s, tests 12.20s, environment 8.03s)

### Notable slow cases (admin, >300ms)

- `gifts`: creates gift + invalidates list — 635ms
- `receipt-list`: FilterBar Selector re-query — 557ms
- `parents`: hides tab without permission — 465ms; opens email modal — 402ms
- `kpi`: confirm gating — 562ms; override modal — 322ms
- `pipeline`: default list query — 325ms; advance mutate — 564ms

## Failures

None.

## Noise / non-blocking

jsdom stubs only (do not fail suite):

- `Window.scrollTo()` not implemented (multiple admin pages)
- `HTMLCanvasElement.getContext()` not implemented (kpi canvas)

## Verdict

**PASS** — all 81 listed tests green under package configs.

## Unresolved questions

None.

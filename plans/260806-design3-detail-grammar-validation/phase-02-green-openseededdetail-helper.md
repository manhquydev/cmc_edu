---
phase: 2
title: GREEN openSeededDetail helper
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: GREEN openSeededDetail helper

## Overview

Implement shared helper so Phase 1 contract turns green (or maximally green under local e2e seed rules). Click-based navigation only; hard-fail without seed.

## Requirements

- Functional: `openSeededDetail(page, 'receipt'|'opportunity')` returns `{ path }` after URL matches contract.
- Functional: `loadProdEnv` / `loginAsSuperAdmin` shared for ops smoke (phase 3).
- Non-functional: errors must include kind + “seeded” when list empty.
- Non-functional: no `a[href]` UUID picking.

## Architecture

```ts
export function loadProdEnv(envPath?: string): Record<string, string>
export async function loginAsSuperAdmin(page: Page, env: Record<string, string>): Promise<void>
export async function openSeededDetail(
  page: Page,
  kind: 'receipt' | 'opportunity',
): Promise<{ path: string }>
```

| kind | list | click | URL |
|------|------|-------|-----|
| receipt | `/finance` | first DataTable body row via `findInList` (any non-empty text) | `/finance/:uuid` |
| opportunity | `/crm` | first pipeline card / opportunity control; fallback `?view=table` + row | `/crm/opportunities/:uuid` |

## Related Code Files

- Create: `apps/e2e/src/design3/open-seeded-detail.ts`
- Reuse: `apps/e2e/src/journey/find-in-list.ts`
- Modify: `apps/e2e/tests/design3-statusbar.ui.spec.ts` (only if seams needed)
- Ref: `apps/admin/src/pages/finance/receipt-list.tsx`, `crm/pipeline.tsx`

## TDD

| Step | Action |
|------|--------|
| Tests Before | Phase 1 RED already written |
| Refactor / GREEN | Implement helper; fix login password-rotate like audit |
| Tests After | Optional unit-less; rely on Playwright |
| Regression Gate | Playwright design3-statusbar green under seeded e2e; `pnpm --filter @cmc/e2e typecheck` |

## Implementation Steps

1. Implement env + login (mirror `design3-frontend-audit.mjs` credential keys + rotate).
2. Implement receipt path with `findInList(() => true)` or first row with content; click; `waitForURL`.
3. Implement opportunity path (card locator from pipeline DOM); hard-fail if zero cards/rows.
4. Confirm UUID path regex; reject `/finance/new` false positives.
5. Re-run Phase 1 suite → GREEN.

## Success Criteria

- [ ] Helper exports stable API above
- [ ] Playwright contract passes on seeded environment used by e2e
- [ ] Empty list throws (manual or temporary blank assert in test double if needed)
- [ ] Typecheck green

## Risk Assessment

- CRM kanban vs table — implement card-first + table fallback.
- Super_admin facility empty on prod — phase 3 ops will hard-fail (by policy); e2e preview uses journey seed / fixtures.

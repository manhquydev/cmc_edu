---
phase: 2
title: "A11y baseline lite"
status: completed
priority: P1
effort: S
dependencies: [1]
---

# Phase 2: A11y baseline lite (MS-3 partial)

## Overview

Close multi-scope **MS-3** with a **lite** baseline: written keyboard/role checklist + pointer from MASTER/llms — **not** full axe CI or automated WCAG certification.

## Requirements

- Functional: `design-system/cmc-edu/A11Y-BASELINE.md` with operator keyboard paths + composite role inventory expectations.
- Functional: link from `MASTER.md` and one line in `packages/ui/llms.txt`.
- Functional: design-lab-redteam finding MS-3/H* note status partial→partial or fixed-lite with evidence path.
- Non-functional: zero new CI fail gates for a11y; no axe dependency install unless already present.

## Architecture

```text
A11Y-BASELINE.md (human/agent checklist)
  ├── Shell: SideNav, ⌘K, focus
  ├── List: FilterBar role=search · ListPagination nav · Bulk toolbar · table checkboxes
  ├── Detail: EntityHeader h1 · breadcrumbs nav
  └── Feedback: Toast aria-live
packages/ui composites already ship many roles — document expected, don't invent new components.
```

## Related Code Files

- Create: `design-system/cmc-edu/A11Y-BASELINE.md`
- Modify: `design-system/cmc-edu/MASTER.md` (link)
- Modify: `packages/ui/llms.txt` (pointer)
- Modify: `apps/admin/src/pages/design-lab-redteam.tsx` (MS-3 / scorecard a11y note if present)
- Optional modify: design-lab inventory Feedback/a11y row note

## Implementation Steps

1. Inventory existing aria/role in `packages/ui/src/components` (FilterBar, ListPagination, BulkActionBar, CommandPalette, Toast, DataTable, PageHeader).
2. Write A11Y-BASELINE.md: required paths, expected roles, how to re-check (manual + optional future axe).
3. Link from MASTER.md + llms.txt.
4. Update red-team panel: add or update finding for a11y baseline lite.
5. Do **not** add CI axe job this phase.

## Success Criteria

- [x] `A11Y-BASELINE.md` exists: ≥5 operator paths + **honest gaps** section (not WCAG cert)
- [x] MASTER + llms link to A11Y-BASELINE only (single SoT)
- [x] Automated role smoke: key composites still contain expected role/aria (script or node:test)
- [x] Lab red-team: MS-3 / a11y = **partial** (baseline) — **never** status fixed without keyboard pass log
- [x] No new axe dependency / CI job
- [x] `pnpm check:ui-frames` / frames --strict still green

<!-- Updated: Red Team - ban fixed-lite greenwash; add role smoke -->

## Risk Assessment

- Over-claiming WCAG compliance → word as **baseline checklist**, not certification.
- Scope creep to axe CI → explicitly out of phase.

## Validation

```bash
test -f design-system/cmc-edu/A11Y-BASELINE.md
grep -q A11Y-BASELINE design-system/cmc-edu/MASTER.md
grep -qi a11y packages/ui/llms.txt || grep -q A11Y packages/ui/llms.txt
node scripts/check-ui-frames.mjs --strict
```

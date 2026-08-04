---
phase: 3
title: Governance finalize
status: completed
priority: P1
effort: S
dependencies:
  - 1
  - 2
---

# Phase 3: Governance finalize

## Overview

Sync work-definition, advise checklists, cycle reports, and lab scorecards so Soft Ops governance state is single source of truth after phases 1–2.

## Requirements

- Functional: work-definition Cycle 3/4 status accurate; advise MS-P1 checklist checked if 4a verified.
- Functional: short cook completion report under this plan `reports/`.
- Functional: design-lab red-team remediation list matches done/defer.
- Non-functional: no product feature changes.

## Related Code Files

- Modify: `plans/260804-ui-smart-cohesion-upgrade/reports/work-definition-clear-2026-08-04.md`
- Modify: `plans/260804-ui-smart-cohesion-upgrade/reports/advise-ms-p1-detail-governance-2026-08-04.md` (checklist ✓)
- Create: `plans/260804-cycle-4-soft-ops-governance/reports/cook-complete-2026-08-04.md`
- Modify: `apps/admin/src/pages/design-lab-redteam.tsx` if scores stale after phase 2
- Optional: `plans/260804-ui-smart-cohesion-upgrade/reports/workflow-next-cycle-2026-08-04.md` next pointer

## Implementation Steps

1. Mark advise work checklist items complete with evidence commands.
2. Update work-definition with Cycle 4a/4b rows.
3. Write cook-complete report: metrics snapshot + finding board.
4. Confirm non-goals still rejected (re-skin, domain bulk force, axe CI).
5. Run final `node --test scripts/check-ui-frames.test.mjs` + `--strict`.

## Success Criteria

- [x] Advise checklist all [x] for 4a items — evidence commands in advise report (2026-08-04)
- [x] work-definition lists Cycle 4 tiers + a11y lite (partial + role smoke) + MS-5 deferred
- [x] reports/cook-complete exists with measured numbers
- [x] Red-team panel not claiming “depth matrix missing” (C2/H6 fixed; detailTiers report)
- [x] Final tests green — frames 3/3 + --strict 0 + a11y roles 8/8

## Risk Assessment

- Doc-only drift again → point metrics to `pnpm check:ui-frames` as authority.

## Validation

```bash
node --test scripts/check-ui-frames.test.mjs
node scripts/check-ui-frames.mjs --strict
test -f plans/260804-cycle-4-soft-ops-governance/reports/cook-complete-2026-08-04.md
```

---
title: Cycle 4 Soft Ops governance residual
description: >-
  Close MS-1/2/4 depth honesty (4a), add a11y baseline lite, finalize governance
  docs/lab — no re-skin, no axe CI full, no domain bulk.
status: completed
priority: P1
branch: develop
tags:
  - soft-ops
  - design-system
  - governance
  - a11y
blockedBy: []
blocks: []
created: '2026-08-04T02:29:26.939Z'
createdBy: 'ck:plan'
source: skill
---

# Cycle 4 Soft Ops governance residual

## Overview

Multi-scope red-team (~3.6/5 Soft Ops) found governance gaps beyond list bulk/dual-title:

| ID | Issue | Cycle 4 response |
|----|--------|------------------|
| MS-4 | Detail recipe two-tier undocumented | **4a** name tiers full/standard/settings/thin |
| MS-2 | No depth matrix in CI report | **4a** `check-ui-frames` report FilterBar/pager/detailTiers |
| MS-1 | EntityHeader “under-adopted” | **4a** classify settings/thin as intentional |
| MS-3 | No a11y baseline | **4b** docs + keyboard checklist (not full axe CI) |
| MS-5 | Clipboard bulk | **defer** (honesty already partial) |

**Direction locked:** Option B Soft Ops · no re-skin · no second DS · no OWL.

**Inputs:**  
`plans/260804-ui-smart-cohesion-upgrade/reports/{research-redteam-ds-multi-scope,brainstorm-ms-p1,research-ms-p1,advise-ms-p1,cook-validate-cycle-4a}-2026-08-04.md`

## Outcome

1. Agents know which detail depth is correct per screen class.  
2. Depth metrics are measurable (`pnpm check:ui-frames`).  
3. A11y has a **minimal written baseline** maintainers can re-run.  
4. Lab/red-team/work-def not stale vs product.

## Non-goals

- Re-skin / dark mode / LMS Soft Ops  
- Full axe CI gate  
- Domain bulk multi-mutate  
- Force EntityHeader on settings/thin  
- Strict fail on thin DetailPage  

## Phases

| Phase | Name | Status | Pri |
|-------|------|--------|-----|
| 1 | [Close 4a depth report](./phase-01-close-4a-depth-report.md) | **Completed** (verify-only) | P1 |
| 2 | [A11y baseline lite](./phase-02-a11y-baseline-lite.md) | **Completed** | P1 |
| 3 | [Governance finalize](./phase-03-governance-finalize.md) | **Completed** | Completed |

## Success metrics

### Precondition (Phase 1 — already shipped 4a; verify only, not new delivery)

| Metric | Target | Gate type |
|--------|--------|-----------|
| dualTitleReview | 0 | **strict** CI |
| bulkListsOk | true | **strict** CI |
| detailTiers buckets 2/2/3/2 (approx) | report present | **report-only** |
| filterBarCount ≥ 5 | report | **report-only** |
| PAGE-FRAMES §C tiers | exists | docs |

### Residual delivery (Phases 2–3 — this plan’s real cook)

| Metric | Target | Gate type |
|--------|--------|-----------|
| `A11Y-BASELINE.md` | exists · lists paths + **gaps honest** · no “WCAG certified” claim | docs |
| Role smoke check | `scripts/check-ui-a11y-roles.mjs` (or test) asserts key composites keep roles | automated smoke |
| MS-3 lab status | **partial** (baseline doc) — never “fixed” without human keyboard pass | honesty |
| Advise 4a checklist | marked [x] with evidence commands | docs |
| cook-complete report | metrics snapshot + finding board | docs |
| frames strict still green | exit 0 | regression |

## Red Team Review

**Date:** 2026-08-04 · 3 reviewers (security · assumption · failure-mode)

| Disposition | Finding | Action |
|-------------|---------|--------|
| **Accept** | Metrics table over-claims 4a as residual delivery | Split precondition vs residual (above) |
| **Accept** | `--strict` ≠ depth gated | Label report-only vs strict in plan + A11Y doc |
| **Accept** | MS-3 `test -f` theater | Add role smoke script + forbid “fixed” without keyboard pass |
| **Accept** | Phase 1 status pending while code green | Phase 1 verify-only; mark completed after verify |
| **Accept** | Dual SoT a11y risk | Single A11Y-BASELINE SoT; MASTER links only |
| **Accept (doc)** | Clipboard bulk privacy residual | Note in cook-complete; **not** implement bulk privacy this plan |
| **Reject** | Must gate /design prod authz this plan | Out of scope (security valid residual; separate product work) |
| **Reject** | Must implement domain bulk confirm this plan | Non-goal MS-5; gifts confirm optional later |
| **Reject** | Full axe CI | Explicit non-goal |

### Whole-Plan Consistency Sweep

- Non-goals still: re-skin · axe CI · force EH · domain bulk.  
- Phase 2 wording: baseline **partial**, not fixed-lite compliance.  
- Phase 3 must not invent “depth matrix strict”.  
- Unresolved contradictions: **0** after accept/reject table.

## Dependencies

- Prior plan corpus: `plans/260804-ui-smart-cohesion-upgrade/` (Option B Soft Ops).  
- No code blocks on API/DB migrations.

## Cook handoff

```text
/ck:cook plans/260804-cycle-4-soft-ops-governance/plan.md --auto
```

Phase 1 should short-circuit if verify passes. Phase 2–3 implement residual.

## Related files

- `design-system/cmc-edu/PAGE-FRAMES.md` · `VIEW-GRAMMAR.md` · **new** `A11Y-BASELINE.md`  
- `scripts/check-ui-frames.mjs` · `.test.mjs`  
- `packages/ui/llms.txt`  
- `apps/admin/src/pages/design-lab.tsx` · `design-lab-redteam.tsx`  
- `plans/260804-ui-smart-cohesion-upgrade/reports/*`  

## Validation Log

### Verification Results (2026-08-04)
- Tier: Standard (fact check vs codebase)
- Claims checked: 12
- Verified: 11 | Failed: 0 | Unverified: 1 (advise checklist still open — Phase 3)
- Evidence:
  - PAGE-FRAMES tiers table present (design-system/cmc-edu/PAGE-FRAMES.md)
  - scripts/check-ui-frames.mjs detailTiers + FilterBar report; tests 3/3; --strict exit 0
  - tiers live: full2 standard2 settings3 thin2; dualTitle0 bulk8 FilterBar6
  - A11Y-BASELINE.md **absent** (Phase 2 residual) — VERIFIED gap
  - Composites have roles: filter-bar role=search, list-pagination nav, bulk toolbar, toast aria-live, cmd dialog
- Failures: none blocking cook
- Decisions (auto, user authorized full pipeline):
  1. Proceed with residual-only cook (Phase 2–3)
  2. Phase 1 = verify + mark complete, no rewrite of 4a
  3. A11y = baseline partial + role smoke, not axe CI

### Whole-Plan Consistency Sweep
- Precondition vs residual metrics reconciled with red-team accepts
- Ready for cook residual phases

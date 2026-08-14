---
title: "Classes ListPage empty recipe after 144"
description: "One-PR Wave 8 fan-out: BRIDGE empty honesty on /admin/classes. No sort, no bulk widen. Housekeeping: close #144 plan + INDEX."
status: active
priority: P1
effort: "0.5-1d"
tags: [ui, listpage, classes, bridge]
created: 2026-08-14
blockedBy: []
blocks: []
---

# Classes ListPage empty recipe after 144

## Overview

Successor to merged #144. Direction: **Classes empty grammar only**.

Authority: `BRIDGE.md` § ListPage recipe. Pattern: **courses** for `first-run`; **students** for search-zero → bare string (no unfiltered total).

## Contract

| Field | Content |
|-------|---------|
| **Outcome** | `/admin/classes`: no-search `total===0` → `first-run` + working CTA; search-zero → bare string; page clamp on stale page; bulk page-only (no widen). |
| **Constraints** | Solo + CI; one product concern (+ tiny housekeeping); empty CTA name must not substring-match `Tạo lớp`; no new e2e journey required (none click list CTAs today). |
| **Non-goals** | API sort; BulkActionBar API/copy redesign; class detail; Wave 4B; parents; mass fan-out; new Playwright journey. |
| **Acceptance** | See Phase 2 success criteria + CI green. |

## Scout anchors (fact-checked)

| Fact | Evidence |
|------|----------|
| Empty = bare string | `classes/index.tsx:448` |
| One filtered `total` | `index.tsx:213–217`; API same `where` |
| No client sort **input** | `class-batch-router.ts:45–51` (hardcoded `orderBy createdAt desc` at `:258`) |
| Header `+ Tạo lớp`; dialog submit `Tạo lớp` | `:395`, `:651` |
| Bulk copy only, no widen | `:412–429` |
| No e2e list CTA clicks | capture/deeplink only |

## Phases

| # | Phase | Depends |
|---|-------|---------|
| 1 | [Kickoff](./phase-01-start.md) | — |
| 2 | [Implement](./phase-02-implement-classes-empty-recipe.md) | 1 |
| 3 | [Housekeeping](./phase-03-housekeeping-close-prior-plan-and-index.md) | 2 |

## Red Team Review

### Session R1 — 2026-08-14
**Findings:** 7 (5 Accept, 2 Reject/narrow)

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 1 | Unit≠Playwright substring | High | Accept narrow: safe CTA label + unit exact; **no new e2e** (no list journeys) |
| 2 | Must add page-only bulk copy | High | Reject — BulkActionBar redesign out of scope; no widen = honest |
| 3 | Vacuous no-widen on empty fixture | High | Accept — test with rows + select-all |
| 4 | Page clamp misframed | High | Accept — clamp stale page vs data.total |
| 5 | CTA must open dialog in criteria | Medium | Accept |
| 6 | Closing prior plan leaves pending phases | High | Accept — mark phases completed w/ #144 |
| 7 | Phase 3 multi-concern | Medium | Accept narrow — INDEX + prior plan; BRIDGE ≤1 line |

### Fact-check
- students≠first-run pattern → cite **courses** for first-run. Applied.
- `:258` cite clarified.

### Whole-Plan Consistency Sweep (R1)
Unresolved: none after phase edits.

### Session R2 — 2026-08-14
**Verdict: CLEAN — ready to cook** after R1 apply (courses pattern, clamp, tests, housekeeping reconcile).

## Validation Log

### Session — 2026-08-14
Verification-only (owner chose Classes / option A via “sang ak:plan” after recommend).
- Claims checked: 6 scout anchors — Verified 6 / Failed 0
- Cook: proceed `--auto`


<!-- slug: classes-listpage-empty-recipe-after-144 -->

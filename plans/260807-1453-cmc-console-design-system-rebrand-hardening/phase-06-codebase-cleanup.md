---
phase: 6
title: "Phase 6: Codebase Cleanup"
status: completed
priority: P2
effort: "2-3d"
dependencies: [1, 2, 5]
---

# Phase 6: Codebase Cleanup

<!-- Updated: Red Team Session 2026-08-07 — see plan.md "## Red Team Review" for full rationale -->

**Execution order note:** this phase now runs 5th, immediately BEFORE Phase 4
(Live Browser Visual Smoke) — see plan.md's corrected Phases table. Red-team
found the original order (visual smoke before this phase's CSS deletions)
meant the only pixel-level human check would run before the riskiest
operation in the plan (deleting CSS based on a grep heuristic), leaving it
completely unverified. This phase's own Risk Assessment already flagged this
contradiction; the fix is the reorder, not a new safeguard within this phase.

## Overview

Remove dead code created as a byproduct of Phases 1, 2, and 5 — this phase is
scoped to debris from *this plan's own work*, not a general-purpose cleanup of
the whole repo. Historical cleanup (design-lab-2 exploration artifacts,
`/design3` route deletion, etc.) was already done in the original rollout's
Phase 6 and is not re-litigated here.

**Red-team correction:** the original orphan-selector search path
(`apps/admin/src` + `packages/ui/src/components`) excluded
`packages/ui/src/console/` (née `odoo/`) entirely — meaning the navbar and
kanban board's own CSS (`console-navbar.tsx`'s `.console-brand`,
`.console-menu-*`, `.console-systray*`; `console-kanban.tsx`'s
`.console-kanban-*`) would show as "zero-hit" and be flagged as deletion
candidates, when they're actually the shell chrome rendering live. Search
path widened below to the whole reachable tree.

## Requirements

- [ ] Zero orphaned `odoo`-named files/paths remain except (a) inside
      historical plan/journal files, intentionally left untouched, and
      (c) `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`, which **Phase 7**
      renames — do not touch it here (round-2, below-cap).
- [ ] The selector-mirror CSS blocks deleted in Phase 2 are confirmed gone,
      not just unused.
- [ ] Any dead `SideNav`/`AppFrame` import flagged during Phase 2 is confirmed
      removed (cross-check Phase 2's completion notes).
- [ ] No new dead code was introduced by Phase 5's extractions (e.g., if
      `ViewSwitcher` extraction left behind now-unused local toggle markup in
      `pipeline.tsx`/`schedule.tsx`).

## Architecture

Verification-and-deletion phase — no new abstractions, no behavior change.

## Related Code Files

**Verify via search, then delete if confirmed dead:**
- `git ls-files | grep -i odoo` (tracked files only — avoids `dist/` noise) — expect only
  historical plan/journal/report files (untouched by design) and the
  intentionally-kept dissection-plan process files under
  `plans/260806-odoo-ui-component-dissection/` (that plan's own name and pin
  file legitimately reference "odoo" — it's about the source project, not our
  branding; do not touch it beyond what Phase 7 explicitly updates)
- `packages/ui/src/console.css` — re-verify no orphaned mirror rules survived Phase 2
- `apps/admin/src/pages/crm/pipeline.tsx`, `apps/admin/src/pages/teaching/schedule.tsx` — leftover pre-extraction markup

## Implementation Steps

1. Run **`git ls-files | grep -i odoo`** — not `find -iname '*odoo*'`
   (round-2, below-cap: `find` also surfaces untracked `dist/` build artifacts
   such as `packages/ui/dist/odoo/`, which are neither historical nor leftover
   and just add noise). Classify every hit into **three** buckets:
   (a) historical/intentional — leave;
   (b) leftover from this plan's work — delete;
   (c) **owned by a later phase — leave and list in notes.**
   Bucket (c) is new and load-bearing: at this point
   `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` still exists and matches no
   carve-out, but its rename is **Phase 7 Step 4**. Under the old two-bucket
   rule an executor would either rename it early (breaking Phase 7's `git mv`
   on a missing source, and invalidating the edit list Phase 7 Step 1 builds)
   or delete it as "leftover" — destroying the maintainer map Phase 7 is
   supposed to rewrite. Also expect `docs/design-system-odoo.md` to be gone
   already (Phase 1) and the dissection-plan files to stay (they legitimately
   reference the upstream project, not our branding).
2. Grep `console.css` for any rule whose selector no longer matches anything
   in the codebase (widened heuristic, red-team correction: extract all class
   selectors, grep each against `apps/admin/src`, `packages/ui/src/components`,
   **`packages/ui/src/console/` (the navbar/kanban shell components — omitted
   from the original search path and would have false-flagged live shell
   CSS), and `apps/e2e/**`** — flag zero-hit selectors as candidates — confirm
   manually before deleting, since some classes are applied
   dynamically/conditionally (template literals, `clsx`) and won't show as a
   plain string match; known dynamic-construction sites from Phase 5's reading:
   `detail-page.tsx`, `list-page.tsx`, `side-nav.tsx` build classes via
   template literals — treat these as "confirm manually" by default, not
   "grep says zero hits so it's safe").
3. Re-check Phase 2's completion notes for the dead-SideNav-import flag; confirm
   it was actually removed, not just noted.
4. Re-check Phase 5's diff for leftover pre-extraction code in the two
   `ViewSwitcher`-adopting pages.
5. Real gates: `pnpm typecheck && pnpm test && pnpm --filter @cmc/admin build`.
   Then `pnpm check:ui-frames && pnpm check:ui-a11y-roles` for the record only
   — neither can detect a wrongly-deleted CSS selector (plan.md Constraints).
6. `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` locally.
7. `detect_changes()` (or manual fallback per Phase 1 Step 0's decision) —
   confirm the diff is deletions only (or trivial import cleanup), no behavior
   change. **Because Phase 4 (visual smoke) now runs immediately after this
   phase, this is not the last safety net for a bad deletion — but it is the
   last automated one, so treat a passing gate here as necessary, not sufficient.**

## Success Criteria

- [x] `git ls-files | grep -i odoo` output contains only justified hits, each
      accounted for in this phase's notes under bucket (a) historical,
      (b) deleted, or (c) owned by Phase 7 — with
      `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` explicitly in (c).
- [x] No orphaned CSS selectors remain in `console.css` (or each surviving
      "zero-hit" selector has a documented reason, e.g. dynamic class
      construction).
- [x] All CI gates green.
- [x] `detect_changes()` confirms a deletion-only (or near-zero-behavior) diff.

## Risk Assessment

- **Deleting a dynamically-referenced class**: a selector that looks unused
  via plain grep might be constructed at runtime (template literal, `clsx`,
  conditional). Step 2 explicitly requires manual confirmation before deletion
  for exactly this reason — a false-positive deletion here is a live visual
  regression that grep alone won't catch. **Phase 4 (visual smoke) now runs
  immediately AFTER this phase**, so there is one human check downstream — but
  it inspects 6 routes, not 315 selectors, so treat it as a backstop, not
  coverage. Be conservative anyway.
  *(Round-2, below-cap: this bullet previously read "Phase 4 already ran, so
  this phase doesn't get another visual-smoke safety net" — stale text from
  before round-1's own reorder, directly contradicting Step 7 fifteen lines
  away. All four round-2 reviewers flagged it; it is why round-1's twice-stated
  "Unresolved contradictions: 0" does not hold.)*
- **Scope creep into unrelated cleanup**: this phase is bounded to this plan's
  own byproducts. If the `find -iname '*odoo*'` sweep surfaces unrelated old
  cruft (e.g., something from a pre-2026-08 exploration), note it as a
  separate future item rather than pulling it into this diff.


## Completion Notes

**Completed:** 2026-08-07.

See `notes/phase-06-odoo-path-classification.md` for full (a)/(b)/(c) buckets.

**Deleted:** 13 orphan CSS rule groups (dead breadcrumb/list-table/control-panel
chrome with zero emitters). Sticky thead retained on `.console-list thead th`.

**Phase 7 owns:** `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`.

**SideNav/AppFrame:** still exported; no dead imports found.

**Phase 5:** no extraction leftovers.

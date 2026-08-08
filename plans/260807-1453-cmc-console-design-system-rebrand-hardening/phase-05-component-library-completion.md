---
phase: 5
title: "Phase 5: Component Library Completion"
status: completed
priority: P2
effort: "1d"
dependencies: [1, 2, 3]
---

# Phase 5: Component Library Completion

<!-- Updated: Red Team Session 2026-08-07 — see plan.md "## Red Team Review" for full rationale -->

**Execution order note:** this phase now runs 4th (after Phase 3, before
Phase 6 and Phase 4) — see plan.md's corrected Phases table. It was originally
positioned after the visual smoke phase; red-team found that ordering meant
the smoke test would never see this phase's UI changes.

## Overview

Close the concrete, buildable-today gaps found in the admin component/page
coverage audit. **Red-team correction: three of this phase's four original
requirements described work that was already shipped and CI-locked, or
proposed a component whose spec matched neither of its intended consumers.**
Building any of them as originally written would have risked reverting a
correct, tested behavior or shipping an unused abstraction. This phase is now
much smaller — mostly verification and one narrow, real gap (sticky `<thead>`
test coverage) — plus two explicitly deferred items unchanged from the
original plan.

**Round-2 correction (finding #15): effort re-estimated 3-5d → 1d.** Round 1
gutted the requirements but left the estimate and the Success Criteria intact,
converting build work into paperwork at the original price. What actually
remains is **one e2e assertion** plus three short decision notes. Both
abstractions still nominally on the table have **zero references repo-wide** —
`grep -rn 'ViewSwitcher\|FormDialog' --include=*.ts --include=*.tsx .` → 0 hits;
they are planning-session inventions, not gaps anyone reported. The shared
chrome is a single CSS class with exactly two call sites
(`pipeline.tsx:401`, `schedule.tsx:292`) whose value unions differ. **"Decline"
is the expected outcome for both; a one-line note is a complete deliverable.**
Do not let the phase title ("Component Library Completion") pressure an
extraction into existence.

## Requirements

- [ ] ~~Navbar brand = module name~~ — **removed.** Red-team found this is
      already implemented and CI-locked:
      `packages/ui/src/console/console-navbar.tsx`'s `brandContent` already
      falls through to `activeApp.label` when a module is active, and
      `apps/e2e/tests/admin-shell.ui.spec.ts` already asserts
      `.o-brand`/`.console-brand` shows the active module label, not a
      hardcoded string. **No work needed.** If anyone re-proposes this,
      re-read `console-navbar.tsx`'s brand-resolution logic and the cited
      e2e assertion first — don't "fix" something that already works.
- [ ] `ViewSwitcher` extraction — **downgraded from a firm requirement to an
      evaluate-first decision.** Red-team found the originally specified
      `view: 'list' | 'kanban'` contract matches neither real consumer:
      `pipeline.tsx` uses `'kanban' | 'table'`, `schedule.tsx` uses
      `'list' | 'calendar' | 'kanban' | 'week'` with `role="toolbar"`
      semantics `pipeline.tsx` doesn't have. There is also zero prior
      reference to a `ViewSwitcher` anywhere in the codebase — this gap was
      identified during planning, not requested by any existing spec.
      Read both implementations side by side; extract a shared
      `options: {value, label, icon}[]` + `value` + `onChange` toggle ONLY if,
      after reading both, the actual reusable surface is worth the
      indirection (the visual chrome is already shared via one CSS class,
      `.o-view-switcher`/`.console-view-switcher` — a React wrapper only adds
      value if it removes real duplicated logic, not just duplicated markup).
      If declined, document why in one sentence — don't skip the decision
      silently.
- [ ] CRM dialog archetype (`FormDialog`) — **downgraded to evaluate-first,
      likely-decline.** Red-team found all 7 CRM dialogs already use the
      existing `Dialog purpose="form"` + `DialogHeader` primitives (and
      `ConfirmDialog` already exists as this repo's shared dialog wrapper at
      the same layer). A new `FormDialog` would be a fourth wrapper over
      primitives that already provide the archetype. Read
      `packages/ui/src/primitives.ts`'s `Dialog`/`DialogHeader` re-export and
      at least 3 of the 7 CRM dialog files before deciding. If a genuinely
      common piece exists (candidate: the `<HStack justify="end">` confirm/cancel
      footer, which does look identical across all 7), extract only that
      piece, not a whole new template. Document the decision either way.
- [ ] `ControlBar` visual densify — **removed as a structural change,
      downgraded to a values-only re-check.** Red-team found this was already
      shipped and is test-locked
      (`packages/ui/src/console/console-cp-sheet.test.ts`'s "densifies
      control-bar padding under shell" assertions), and that the originally
      proposed "L/C/R band" restructure would actually be a breaking change to
      `ControlBarProps`'s `header`/`filters`/`footer` vertical-slot contract —
      not the "CSS-only" change it was described as, and it would ripple to
      all 23 `ListPage` adopters. **Do not change `ControlBarProps`'s slot
      shape.** If Phase 3's fresh audit finds a genuine value-level gap
      (spacing, color, not structure) against Odoo's real `control_panel.scss`,
      fix values only, inside the existing slot structure, and re-run
      `console-cp-sheet.test.ts` to confirm it still encodes the right values
      (update the test's asserted values if they were wrong, not the component's
      structure).
- [ ] Sticky `<thead>` behavior (CSS already present) gets e2e test coverage
      proving it — currently unverified by CI. **This is the one item in this
      phase confirmed to be real, uncontested new work.**
- [ ] **Explicitly deferred, not built here** (unchanged from original plan,
      still correctly scoped as external blockers, not scope cuts):
      - `leaderboard.tsx` FilterBar — blocked on a backend ranked-aggregate
        endpoint that doesn't exist yet.
      - `refund.tsx` FilterBar — blocked on a receipt-search/pick + approval
        UX spec that doesn't exist yet.
      - `class-placement.tsx` — **not a gap**: legitimate custom lookup
        wizard, not a list-filter archetype. Leave as-is.
      - Odoo Search OS (facets/GroupBy/Favorites) — already parked; stays parked.

## Architecture

Mostly a verification/documentation phase now, not a build phase. The one
confirmed build item (sticky `<thead>` e2e coverage) extends an existing test
file rather than creating new component surface.

## Related Code Files

**Read (verify, don't rebuild):**
- `packages/ui/src/console/console-navbar.tsx` (brand resolution — confirm already correct)
- `apps/admin/src/pages/crm/pipeline.tsx`, `apps/admin/src/pages/teaching/schedule.tsx` (ViewSwitcher evaluation)
- `packages/ui/src/primitives.ts`, the 7 CRM dialog files under `apps/admin/src/pages/crm/` (FormDialog evaluation)
- `packages/ui/src/components/control-bar.tsx`, `packages/ui/src/console/console-cp-sheet.test.ts` (densify — confirm already shipped)

**Modify (conditional on the evaluate-first decisions above):**
- `packages/ui/src/components/view-switcher.tsx` + test — only if extraction is justified
- CRM dialog footer extraction — only if justified, and only the footer piece
- An existing list-view e2e spec — extend with a sticky-`<thead>` assertion (confirmed work)

**Do NOT modify:**
- `console-navbar.tsx`'s brand-resolution logic (already correct)
- `ControlBarProps`'s slot shape (`header`/`filters`/`footer`)
- `apps/admin/src/pages/engagement/leaderboard.tsx`, `apps/admin/src/pages/enrollment/class-placement.tsx`, `apps/admin/src/pages/finance/refund.tsx`

## Implementation Steps

1. Read `console-navbar.tsx` and `admin-shell.ui.spec.ts`'s brand assertion;
   confirm dynamic brand already works; record "no work needed, verified" in
   completion notes.
2. Read `pipeline.tsx` and `schedule.tsx` side by side; decide on
   `ViewSwitcher` extraction per the evaluate-first criteria above; implement
   or document the decline.
3. Read `primitives.ts`'s `Dialog`/`DialogHeader` and 3+ CRM dialog files;
   decide on `FormDialog` (or the narrower footer-only extraction) per the
   evaluate-first criteria; implement or document the decline.
4. Cross-reference Phase 3's fresh-audit findings for `control_panel.scss`;
   if a real value-level gap exists, fix values only in `control-bar.tsx`'s
   CSS, re-run `console-cp-sheet.test.ts`. If no gap, record "already correct,
   verified against Phase 3 audit" and do nothing.
5. Add sticky `<thead>` e2e assertion to an existing list-view spec (e.g.
   extend the `receipt-list.tsx` or `classes/index.tsx` journey/UI spec rather
   than creating a new file). The CSS being asserted is
   `console.css`'s `.console-list-table thead th { position: sticky; … }`
   (née `odoo.css:423-424`), currently unasserted anywhere.
   **Watch the baseURL (round-2 open question):**
   `apps/e2e/playwright.config.ts` sets the `ui-chromium` project's `baseURL`
   to `http://localhost:4174` — the **LMS** preview — while admin previews on
   `4173`. This is an admin-list assertion, so use an absolute `:4173` URL or
   whatever pattern the existing admin specs use; a relative path will
   silently target LMS and pass or fail for the wrong reason.
6. Write the deferred-items note (leaderboard/refund/class-placement/Search-OS)
   into this phase's completion notes for Phase 7 to cite.
7. Real gates: `pnpm typecheck && pnpm test && pnpm --filter @cmc/admin build`.
   Then `pnpm check:ui-frames && pnpm check:ui-a11y-roles` for the record only
   — `check-ui-frames` is blind to this plan's changes (plan.md Constraints).
8. `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` locally.
9. `detect_changes()` (or manual fallback per Phase 1 Step 0's decision).

## Success Criteria

- [x] Navbar brand confirmed already correct (verification note, zero code change).
- [x] `ViewSwitcher` and `FormDialog` decisions made and documented either way
      (extracted with tests, or explicitly declined with a one-sentence reason
      grounded in what was actually read).
- [x] `ControlBar`'s slot structure unchanged; any value-level fix is backed
      by a specific Phase 3 audit finding, not a general "feels soft" judgment.
- [x] Sticky `<thead>` has e2e coverage.
- [x] Deferred items list is explicit and complete (leaderboard, refund,
      class-placement, Search OS) with the actual blocker named for each.
- [x] All CI gates green (including `pnpm --filter @cmc/admin build` and the
      `PLAYWRIGHT_UI=1` e2e command); `detect_changes()` blast radius matches
      this phase's (now much smaller) actual file list.

## Risk Assessment

- **Reverting a correct behavior**: the navbar-brand and ControlBar-densify
  items exist in this phase file specifically because red-team caught that
  building them as originally described would have reverted already-shipped,
  tested behavior. The verification-first framing above exists to prevent
  that from happening again if this phase is executed by someone who didn't
  read the red-team section.
- **Forcing an abstraction that doesn't fit**: `ViewSwitcher` and `FormDialog`
  both have real YAGNI risk (zero prior demand signal, contracts that don't
  match real consumers as originally specified) — the evaluate-first
  structure exists to make "no extraction" a legitimate, expected outcome,
  not a failure to complete the phase.


## Completion Notes

**Completed:** 2026-08-07 on `feature/cmc-console-design-system-rebrand`.

### Decisions / verifications

1. **Navbar brand** — **no work.** `console-navbar.tsx` resolves
   `brand ?? activeApp?.label ?? apps[0].label ?? 'CMC EDU'`. E2e
   `admin-shell.ui.spec.ts` asserts `.console-brand` → `Tổng quan` on cockpit.

2. **ViewSwitcher extraction** — **declined (YAGNI).** `pipeline.tsx` uses
   `'kanban' | 'table'` without toolbar role; `schedule.tsx` uses
   `'list' | 'calendar' | 'kanban' | 'week'` with `role="toolbar"`. Shared
   chrome is already one CSS class (`.console-view-switcher`). Zero prior
   `ViewSwitcher` references. Extraction would not remove meaningful logic.

3. **FormDialog** — **declined.** All CRM dialogs already use
   `Dialog purpose="form"` + `DialogHeader` (+ existing `ConfirmDialog`). A
   fourth wrapper adds no shared contract; footer HStacks are thin and
   dialog-specific enough that a shared footer piece is not worth a public API.

4. **ControlBar densify** — **no value change.** Phase 3 audit found no
   control-panel spacing gap. `console-cp-sheet.test.ts` already locks
   `padding: 8px` densify under shell. Slot props unchanged.

5. **Sticky thead** — **done.** CSS now targets both `.console-list-table thead th`
   and `.console-list thead th` (DataTable/Astryx path). Unit:
   `console-list-sticky.test.ts`. E2e: `admin-shell.ui.spec.ts` facilities list
   asserts `getComputedStyle(th).position === 'sticky'` (admin baseURL `:4173`,
   super_admin cookie).

   **Follow-up (Phase 4 smoke):** e2e asserts `position: sticky` only, not
   scroll-pin geometry. Nested Astryx `overflow-x: auto` under `.console-list`
   may create a second scrollport — verify headers pin on a long list during
   human visual smoke; if not, neutralize nested overflow in a later CSS fix.

### Deferred (explicit, not dropped)

| Item | Blocker |
|------|---------|
| `leaderboard.tsx` FilterBar | Backend ranked-aggregate endpoint does not exist |
| `refund.tsx` FilterBar | Receipt-search/pick + approval UX spec does not exist |
| `class-placement.tsx` | Not a gap — custom lookup wizard, not list-filter archetype |
| Odoo Search OS (facets/GroupBy/Favorites) | Already parked; stays parked |

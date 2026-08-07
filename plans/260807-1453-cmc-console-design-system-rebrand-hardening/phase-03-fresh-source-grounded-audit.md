---
phase: 3
title: "Phase 3: Fresh Source-Grounded Audit"
status: completed
priority: P1
effort: "3-4d"
dependencies: [1, 2]
---

# Phase 3: Fresh Source-Grounded Audit

## Overview

Re-verify admin's UI against the real, pinned Odoo 19.0 source directly —
independently of the 2026-08-05 fidelity audit's conclusions, not by reading
that audit and trusting it. This both (a) catches any drift/regression since
2026-08-05 and (b) catches anything Phases 1-2's rename/retirement sweep
introduced. Reuses the existing pin and extraction process from
`plans/260806-odoo-ui-component-dissection/` rather than re-deriving it from
scratch — that plan already did the hard work of identifying the authority
source paths; this phase re-*walks* them fresh rather than re-*discovering*
them.

## Requirements

- [ ] **Step 0 (blocking — reframed by round-2 finding #15): reconcile the pin,
      but understand what the two "sides" actually are.** Round 1 described
      this as "two conflicting commits recorded in this repo," giving both equal
      evidentiary weight. They are not equal:
      - **Tracked, in code:** `5568f6e472e2e53bc2931e744421015b0f0f3550` at
        `packages/ui/src/odoo.css:5`, `docs/design-system-odoo.md:39`, and
        `packages/ui/src/console/console-tokens.test.ts:31` (renamed in Phase 1)
        — the last of which is a **live test assertion**, the only CI guard on
        the attribution.
      - **Tracked, in reports:** `7de220c941c77d4fffdc270a7862c69475fa4577`
        appears in 16+ plan reports (e.g.
        `plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md:6`).
      - **Untracked:** `plans/260806-odoo-ui-component-dissection/ODOO_PIN.txt`
        is **gitignored** (`.gitignore:78` `/plans/**`, re-including only
        `*.md`) — local scratch that does not exist in a fresh clone or in CI.
        The local sparse clone HEAD also reads `7de220c9…`.
      **Therefore:** the outcome must land in *tracked* files
      (`odoo.css` header + the doc + `console-tokens.test.ts`). Recording the
      decision only in `ODOO_PIN.txt` would evaporate on the next clone.
      Decide from evidence of which commit the shipped CSS rules actually match
      — not from the 3-vs-2 count and not from convenience.
- [ ] **Step 0.1: budget the test change — this phase is NOT zero-diff.**
      Whatever Step 0 concludes, if `5568f6e4…` is wrong then
      `console-tokens.test.ts:31`'s asserted string must change in the same
      commit or `pnpm test` goes red. The phase's Architecture section and
      Implementation Step 5 previously claimed zero expected changes, which is
      unsatisfiable in that branch. **Independence caveat:** that test is the
      only automated guard on the attribution, so if the same agent edits both
      the CSS header and the assertion in one commit, nothing independently
      verifies the new hash is the commit the CSS was actually derived from —
      record the derivation evidence explicitly in the audit report.
- [ ] Confirm the (now-reconciled) pinned Odoo commit in
      `plans/260806-odoo-ui-component-dissection/ODOO_PIN.txt` matches
      the local sparse clone at `/home/manhquy/Downloads/odoo-src` (do not
      move the pin forward — see plan.md non-goals).
- [ ] Independently re-read each authority source path listed in that plan
      (shell/navbar, control panel, list, form, kanban, settings, float layers)
      and compare directly against our current (Phase 1/2-renamed)
      `console.css` + `console-navbar.tsx` + `console-kanban.tsx` + templates —
      not against the old audit report's summary of them.
- [ ] Produce a findings list in the same accept/reject-with-rationale format
      this repo already uses for red-team reviews (see
      `plans/260805-1920-design3-admin-rollout/plan.md` Red Team Review section
      for the format).
- [ ] Explicitly re-check the two things most likely to have drifted from the
      rename: (a) `.o_web_client` is still the only literal-mirror class and
      nothing new was accidentally left un-renamed, (b) computed CSS values
      (not just property names) are unchanged from the pre-rename baseline for
      a sample of key selectors (navbar height, kanban card width, statusbar
      chevron clip-path) — a rename should never have touched a value, but this
      phase is the checkpoint that confirms it.

## Architecture

**Scope note (round-2 finding #15):** the audit portion of this phase is
substantially redundant against gates that already ran — `console-tokens.test.ts`,
`console-cp-sheet.test.ts:62-71`, and `console-shell-stacking.test.ts:38` assert
literal CSS values exhaustively and automatically, which is strictly stronger
than Step 3's manual three-selector spot-check for detecting rename drift. There
is also unreconciled tension between Goal 1 (erase "Odoo" from our identifiers
because the naming is our own invention) and Goal 3 (spend days re-proving pixel
fidelity *to* Odoo). Step 0's pin reconciliation is the part with clear,
non-redundant value.

**Validation decision (2026-08-07): TIME-BOX this phase.** Keep it (7 phases
retained), but:
1. Do Step 0's pin reconciliation properly — it has real license-attribution
   value and produces a tracked diff.
2. **Spot-check only the surfaces Phases 1-2 actually touched**, rather than
   independently re-walking all seven authority sources. The full re-walk
   mostly re-proves what `console-tokens.test.ts`,
   `console-cp-sheet.test.ts:62-71`, and `console-shell-stacking.test.ts:38`
   already assert automatically and exhaustively on every CI run.
3. Reframe the Success Criterion below accordingly: "every authority surface
   has an entry" becomes "every surface **touched by Phases 1-2** has an
   entry, and untouched surfaces are listed as explicitly out of this pass."
Do not treat this phase as a substitute for the automated value locks — they
are the stronger check.

This is a research/verification phase — **except for Step 0's pin correction,
which does produce a tracked diff** (see Step 0.1). No other production code
changes expected unless the audit finds a real fidelity gap
(in which case, log it as a new finding for a follow-up decision, don't fix
it inline mid-audit; keep the audit's job separate from the fix's job so the
report stays a clean point-in-time record).

## Related Code Files

**Read (authority sources, already enumerated by the dissection plan):**
- `/home/manhquy/Downloads/odoo-src` (local sparse clone, pinned commit) — `webclient/webclient.xml`, `webclient_layout.scss`, `navbar/navbar.xml`, `navbar.scss`, `search/layout.xml`, `search/control_panel/control_panel.{xml,scss}`, `views/list/list_controller.xml`, `list_renderer.{xml,scss}`, `views/form/form_controller.{xml,scss}`, `views/kanban/kanban_controller.xml`, `kanban_renderer.xml`, `kanban_record.scss`, `webclient/settings_form_view/**`, `core/dialog`, `core/dropdown`, `core/notifications`, `core/commands`

**Read (our implementation, post Phase 1-2 rename):**
- `packages/ui/src/console.css`
- `packages/ui/src/console/console-navbar.tsx`, `console-kanban.tsx`
- `apps/admin/src/shell/shell.tsx`
- Page templates in `packages/ui/src/components/` (`ListPage`, `DetailPage`, `FormPage`, `DashboardPage`, `ControlBar`)
- `packages/ui/src/console/console-tokens.test.ts` (the pin-commit assertion — Step 0 above may need to update the string this test checks)

**Create:**
- `plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/fresh-fidelity-audit-<date>.md`

## Implementation Steps

1. `cd /home/manhquy/Downloads/odoo-src && git rev-parse HEAD` — compare
   against `ODOO_PIN.txt`; if it doesn't match, re-checkout the pinned commit
   (don't advance it) before reading anything.
2. For each authority surface (shell, control panel, list, form, kanban,
   settings, float layers): read the Odoo source file(s) directly, then read
   our corresponding `console.css`/component code, and record any mismatch —
   don't skip a surface because the old audit already covered it; the point
   is independent re-derivation.
3. Spot-check computed values for navbar height, kanban card width, statusbar
   chevron shape against both the Odoo source and our pre-Phase-1 baseline
   (git history) to confirm the rename didn't silently change a value.
4. Write findings to the report, each tagged Accept (real gap, needs a
   follow-up decision — do not fix inline) / Reject (false alarm, with the
   evidence that resolved it) / Already-known (matches a previously accepted
   deviation in `docs/design-system-odoo.md`'s "Approved deliberate deviations"
   table — cite it, don't re-litigate it).
5. Expect a **non-zero** diff for this phase: Step 0's pin correction touches
   `console.css`'s header, `docs/design-system-console.md`, and
   `console-tokens.test.ts`'s asserted string (round-2 finding #15 — the old
   "expect zero changes" was unsatisfiable whenever Step 0 concludes the
   in-code pin is the stale one). Any *fidelity* fix still stays out of this
   phase's diff and goes to a follow-up decision.

## Success Criteria

- [x] Odoo pin reconciled, with the decision and its derivation evidence
      recorded in **tracked** files (`console.css` header,
      `docs/design-system-console.md`, `console-tokens.test.ts`) — not only in
      the gitignored `ODOO_PIN.txt`.
- [x] If the in-code pin changed, `console-tokens.test.ts`'s assertion was
      updated in the same commit and `pnpm test` is green.
- [x] Every authority surface **touched by Phases 1-2** has an entry in the
      fresh audit report; surfaces not touched are listed explicitly as out of
      this pass, with the automated value-lock test that covers them named
      (time-box decision, 2026-08-07).
- [x] No un-triaged findings — everything is Accept/Reject/Already-known.
- [x] Computed-value spot-check confirms Phase 1-2 changed no visual values,
      only names.
- [x] Report committed at the path above.

## Risk Assessment

- **Confirmation bias risk**: reading the old audit report first and then
  "confirming" it would defeat the point of a *fresh* audit. Mitigate by
  reading Odoo source and our code first (steps 1-3), and only cross-referencing
  the old audit/deviation table at the triage step (step 4) to avoid re-litigating
  already-accepted deviations — not before.
- **Pin drift**: if the local sparse clone was garbage-collected or moved,
  step 1 catches it before any comparison happens on stale/wrong source.
- **Scope creep**: findings that surface real new gaps should go to a
  follow-up decision (or Phase 5 if they're component-completeness shaped),
  not get fixed inline mid-audit — keeps this phase's diff clean and the
  report trustworthy as a point-in-time record.


## Completion Notes

**Completed:** 2026-08-07.

**Pin decision:** `7de220c941c77d4fffdc270a7862c69475fa4577` (matches local odoo-src + shipped values).
Prior `5568f6e4…` retired from tracked attribution.

**Report:** `reports/fresh-fidelity-audit-2026-08-07.md`

**Tracked diff:** console.css header, console-tokens.test.ts, design-system-console.md (pin + path fix).
No fidelity production fixes (none required).

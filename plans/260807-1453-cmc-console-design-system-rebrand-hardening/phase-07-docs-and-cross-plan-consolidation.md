---
phase: 7
title: "Phase 7: Docs and Cross-Plan Consolidation"
status: todo
priority: P1
effort: "2-3d"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Docs and Cross-Plan Consolidation

<!-- Updated: Red Team Session 2026-08-07 — see plan.md "## Red Team Review" for full rationale -->

**Red-team correction:** the original cross-reference edit list was wrong in
both directions — it named `docs/06-kien-truc-url-routing.md`, which contains
no actual reference to the design system (its only "Odoo" mentions are an
unrelated URL-scheme comparison with the real Odoo product, and editing it
would be spurious churn), and it omitted four real referrers, one of which is
executable code (`apps/e2e/design3-frontend-audit.mjs`) and two of which live
inside the still-`active` dissection plan's command map and phase files. Fixed
below. This phase also now carries an explicit LGPL-3 attribution-preservation
requirement — the original "reframe every Odoo mention" instruction had no
carve-out for license text, which (unlike the CSS file, guarded by
`console-tokens.test.ts`) has no CI guard on the doc side.

## Overview

Make `docs/design-system-console.md` the complete, sole evergreen authority
(content rewrite — Phase 1 only did the file rename + title), fix every
cross-reference across evergreen docs and the still-active dissection plan,
and formally close `plans/260805-1920-design3-admin-rollout/plan.md`. Historical
completed plans are explicitly NOT rewritten — this phase touches evergreen
docs and the one still-`active`/still-`validation` plan, nothing else.

## Requirements

- [ ] `docs/design-system-console.md` fully rewritten: every "Odoo" branding
      reference becomes "CMC Console" framing, EXCEPT the historical
      provenance/verification-method section — including the LGPL-3 license
      notice, upstream URL, and pin commit — which stays factual, unredacted,
      and **verbatim** (this system's lineage — built by studying real Odoo
      19.0 source under an LGPL-3 license obligation — is true history and a
      license requirement, not branding, and must stay documented plainly).
      Use the commit Phase 3's Step 0 determined to be authoritative (the two
      pin commits reconciled there must match here). Title becomes "Design
      System: CMC Console (Admin ERP UI Language)". All token/class/component
      names in the doc match Phase 1/2's actual renames (no doc drift) —
      re-read the actual current code while writing, don't transcribe the old
      doc's specific numbers (several were wrong, see plan.md Naming Decision).
- [ ] Cross-references updated in: `docs/12-design-system-ui.md`,
      `docs/system-architecture.md`, `docs/codebase-summary.md`,
      `docs/project-changelog.md` (add a changelog entry for this rebrand),
      `apps/e2e/design3-frontend-audit.mjs` (a live script, not just a doc —
      it references `docs/design-system-odoo.md` by name in its output),
      **`apps/e2e/webwright-prod-smoke.mjs`** (round-2 finding #11 — the 12th
      e2e consumer, missed by round-1's enumeration here as well as in Phase 1;
      edit statically, do not execute it — it reads `.env.prod` and drives the
      prod stack),
      `design-system/cmc-edu/README.md`, `design-system/cmc-edu/VIEW-GRAMMAR.md`.
      **`docs/06-kien-truc-url-routing.md` is explicitly NOT edited** — its
      "Odoo" mentions are an unrelated URL-scheme comparison, not a reference
      to this design system; confirmed by reading it during red-team.
- [ ] `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` renamed to
      `CONSOLE-COMPONENT-MAP.md`; content and all its own cross-references
      updated to match.
- [ ] `plans/260806-odoo-ui-component-dissection/plan.md` (status `active`,
      ongoing) updated to reference the new doc/file paths in its own
      "Source of truth" table — this plan keeps running afterward, so its
      authority-path table must not point at renamed-away files. **Also
      update its sibling `AGENT-COMMAND-MAP.md` and the two phase files that
      reference `ODOO-COMPONENT-MAP.md` (`phase-01-controlbar-form-sheet-p1.md`,
      `phase-02-search-system-filters-groupby-favorites.md`)** — omitted from
      the original plan, found during red-team.
- [ ] `plans/260805-1920-design3-admin-rollout/plan.md` status flipped from
      `validation` to `completed` — **only after confirming BOTH of its stated
      blockers are closed.** Round-2 finding #2: that plan's line 9 reads
      "acceptance re-measure closed 2026-08-07; remains validation until human
      visual smoke **+ PR merge**". Round 1 had this phase close it on
      visual-smoke evidence alone. With PR #75 merged as plan.md Prerequisites
      step 1, both are satisfied — verify (`gh pr view 75` → `MERGED`), cite
      Phase 4's report for the smoke half, and cite the merge for the other.
- [ ] **`premium.css` references removed from the docs** (round-2 finding #1 +
      user decision): Phase 2 deletes `packages/ui/src/premium.css`, the
      `apps/lms/src/main.tsx` import, and its two `package.json` entries.
      Any evergreen doc describing `premium.css` as the LMS design layer is now
      wrong — grep `docs/` and `design-system/` for `premium.css` and correct
      each hit. The LMS design language is `apps/lms/src/app.css`'s `lms-*`
      classes; say that instead.
- [ ] No edits to any other historical/completed plan file
      (`260802-design-lab-visual-system`, `260803-2043-odoo-ux-grammar-full-adoption`,
      `260803-2301-ui-shell-settings-command-bulk-rollout`,
      `260805-1325-design2-system-exploration`, `260806-1045-odoo-grammar-gap-cook`,
      `260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit`,
      `260806-design3-detail-grammar-validation`) — these stay as accurate
      point-in-time history.
- [ ] This plan's own `plan.md` `blocks`/`blockedBy` cross-references (already
      set at creation time) are confirmed still accurate; if either referenced
      plan's frontmatter needs a matching `blockedBy` entry added, add it now.

## Architecture

Documentation-only phase. Follow `documentation-management.md`: update the
smallest owning surface, link to machine-owned sources rather than duplicating
them, verify links and claims against current source after editing.

## Related Code Files

**Rewrite:**
- `docs/design-system-console.md`

**Modify (cross-references only, not full rewrites):**
- `docs/12-design-system-ui.md`
- `docs/system-architecture.md`
- `docs/codebase-summary.md`
- `docs/project-changelog.md`
- `apps/e2e/design3-frontend-audit.mjs` (output text referencing the doc name)
- `apps/e2e/webwright-prod-smoke.mjs` (round-2 finding #11 — edit statically, never execute)
- `design-system/cmc-edu/README.md`
- `design-system/cmc-edu/VIEW-GRAMMAR.md`
- `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md` (renamed from `ODOO-COMPONENT-MAP.md`)
- `plans/260806-odoo-ui-component-dissection/plan.md`
- `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md`
- `plans/260806-odoo-ui-component-dissection/phase-01-controlbar-form-sheet-p1.md`
- `plans/260806-odoo-ui-component-dissection/phase-02-search-system-filters-groupby-favorites.md`
- `plans/260805-1920-design3-admin-rollout/plan.md` (status flip + closure note)
- `plans/260807-1453-cmc-console-design-system-rebrand-hardening/plan.md` (this plan — confirm cross-plan frontmatter)

**Do NOT modify:**
- `docs/06-kien-truc-url-routing.md` (no real reference — see overview)
- Any file under `docs/journals/`
- Any other plan in `plans/` not listed above

## Implementation Steps

1. Grep every cross-reference to `design-system-odoo.md`, `odoo.css`,
   `OdooNavbar`, and `ODOO-COMPONENT-MAP.md` across `docs/` and `plans/`
   (excluding journals and historical completed plans) to build the exact
   edit list before starting — don't rely on memory of "the docs that probably
   reference it."
2. Rewrite `docs/design-system-console.md` section by section, verifying each
   token/class/component name mentioned actually matches what Phases 1-2
   shipped (re-read the actual current `console.css`/component exports while
   writing, don't transcribe from the old doc blind).
3. Update each cross-referencing evergreen doc from step 1's list.
4. `git mv design-system/cmc-edu/ODOO-COMPONENT-MAP.md CONSOLE-COMPONENT-MAP.md`;
   rewrite its content to match.
5. Update `plans/260806-odoo-ui-component-dissection/plan.md`'s "Source of
   truth" table paths.
6. Update `plans/260805-1920-design3-admin-rollout/plan.md`: status →
   `completed`; add a closure note citing this plan and Phase 4's report path.
7. Confirm this plan's own `plan.md` frontmatter `blocks`/`blockedBy` fields
   are consistent with steps 5-6's edits (both referenced plans should show a
   matching `blockedBy` pointing back at this plan, if not already present —
   add it directly to their frontmatter, matching this repo's existing
   hand-edited convention for these fields).
8. Verify every internal doc link resolves (no dangling references to the
   deleted `design-system-odoo.md`/`ODOO-COMPONENT-MAP.md` filenames anywhere
   in `docs/` or active plans).
9. `pnpm lint` (markdown/doc-adjacent lint if configured) — otherwise a final
   manual read-through.
10. `detect_changes()` — expect doc-only diff, zero code-symbol impact.

## Success Criteria

- [ ] `docs/design-system-odoo.md` no longer exists anywhere; every reference
      to it is gone or repointed, including in `apps/e2e/design3-frontend-audit.mjs`
      and the dissection plan's `AGENT-COMMAND-MAP.md`/phase files.
      `docs/06-kien-truc-url-routing.md` deliberately left untouched.
- [ ] `docs/design-system-console.md` is internally consistent with the actual
      shipped code (spot-check at least 5 token/class names against
      `console.css`), and its LGPL-3 attribution + upstream URL + the
      Phase-3-reconciled commit are present verbatim.
- [ ] `CONSOLE-COMPONENT-MAP.md` exists; `ODOO-COMPONENT-MAP.md` doesn't.
- [ ] `plans/260806-odoo-ui-component-dissection/plan.md` source-of-truth
      table points at real, current file paths.
- [ ] `plans/260805-1920-design3-admin-rollout/plan.md` status is `completed`,
      with BOTH blockers evidenced: Phase 4's smoke report **and** PR #75
      merged.
- [ ] No doc still describes `premium.css` as the LMS design layer (it is
      deleted in Phase 2).
- [ ] Zero edits present in any historical/completed plan file outside the two
      named above.
- [ ] `detect_changes()` confirms doc-only blast radius.

## Risk Assessment

- **Doc drift on rewrite**: transcribing the old doc's structure without
  re-verifying against actual current code would just relocate the same
  staleness risk under a new name. Step 2's requirement to re-read actual
  source while writing exists specifically to prevent this.
- **Missed cross-reference**: step 1's grep-first approach (build the edit
  list before editing) is the mitigation for "found another reference three
  weeks later" — better to over-search now than under-search.
- **Accidentally editing a historical plan**: the explicit "do NOT modify"
  list exists because it's easy to "helpfully" fix an old plan's now-stale
  Odoo references while in the area — resist that; those files are accurate
  history of what was true when they ran, not live documentation.

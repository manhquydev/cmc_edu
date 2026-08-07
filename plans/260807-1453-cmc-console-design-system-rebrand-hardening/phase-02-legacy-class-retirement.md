---
phase: 2
title: "Phase 2: Legacy Class Retirement"
status: completed
priority: P1
effort: "2-3w"
dependencies: [1]
---

# Phase 2: Legacy Class Retirement

<!-- Updated: Red Team Session 2026-08-07 — see plan.md "## Red Team Review" for full rationale -->

## Overview

Retire the legacy premium-era classes (`ck-*`, `tpl-*`, `sh-*`) that are
currently painted via a Phase-6 "selector mirror" — duplicate CSS rules under
`.o_web_client` that repaint the same visuals as the new `.console-*` classes
without actually renaming the components that still emit the old class names.

**Red-team correction (four independent findings, all confirmed against the
codebase):**
1. `ck-trpc`, previously listed as a class to retire, **does not exist** — it
   was a grep artifact of the substring inside `mock-trpc.ts`/`mock-trpc.js`
   test-mock filenames. Dropped entirely.
2. The real scale is ~4x the original estimate: `ck-*` is ~316 selectors in
   `odoo.css` alone (not 67), `sh-*` is ~19 (not 14) and is emitted by the
   still-**exported** `SideNav`/`AppFrame` components, and `tpl-*` is ~28
   selectors with **zero live emitters anywhere** — it's dead mirror CSS, not
   a component migration.
3. The original exit criterion ("zero occurrences in `apps/admin/src` **or
   `packages/ui/src`**") contradicted plan.md's exclusion of
   `packages/ui/src/premium.css`. Round 1 resolved this by hardening the
   exclusion. **Round 2 resolved it the other way and that is the version in
   force:** the exclusion's rationale was false (LMS emits none of the file's
   classes; its only emitters are the shared components this phase rewrites),
   so `premium.css` is deleted here rather than fenced off. See Requirements.
4. Some CSS rules group multiple class families in one comma-separated
   selector list (e.g. `.sh-cta, .ck-mc, .sh-item, .ck-toast { ... }`) — a
   per-family sweep with gates between families can ship a half-renamed group
   undetected. Fixed below with an explicit pre-split step.

## Requirements

- [ ] **Scope boundary REVERSED by round-2 finding #1 + user decision
      (2026-08-07): `packages/ui/src/premium.css` is now IN scope, for verified
      deletion.** The old boundary excluded it as "LMS-owned," and round 1 spent
      a Critical finding hardening that exclusion. The rationale was false:
      - `apps/lms/src` emits **zero** `ck-*`/`sh-*`/`tpl-*` classes. Its entire
        className set is `lms-page`, `lms-page__title`, `lms-shell`,
        `lms-star-hero{,__label,__value}`, `lms-topbar{,__brand}`,
        `lms-child-chip` (`apps/lms/src/pages/parent/home.tsx:156`) — all
        defined in `apps/lms/src/app.css`.
      - `premium.css` is 2274 lines of `.ck-*`/`.tpl-*`/`.sh-*`/`.fp-*` rule
        heads with no `:root`, no element selectors, no `lms-` anything.
      - Its **only** emitters are the 26 shared `packages/ui/src/components/*.tsx`
        files that this phase rewrites anyway. So the file-level fence
        protected nothing, and keeping it while repointing the emitters would
        orphan 313 selectors from every consumer with no gate — *inverting*
        the drift-reduction goal rather than achieving it.
      **Do this, as its own revertable commit:** verify zero LMS consumers
      (`grep -rohE '\b(ck|sh|tpl)-[a-z][a-z0-9-]*' apps/lms/src` → expect
      empty), then delete `packages/ui/src/premium.css`, remove
      `apps/lms/src/main.tsx:20`'s import, and drop the two `package.json`
      entries (`exports`, `files`). Run the full gate set including an LMS
      smoke before moving on. This is the only action in the plan that actually
      retires legacy classes rather than re-prefixing them.
- [ ] `SideNav`/`AppFrame` **stay exported from `@cmc/ui`, unchanged** — see
      plan.md Non-Goals. **Round-2 precision (finding #8): only 13 of the 19
      `sh-*` selectors are emitted by these two components.** The other 6 —
      `sh-brand-name`, `sh-brand-sub`, `sh-cta`, `sh-cta--ghost`,
      `sh-cta--secondary`, `sh-logo` — have **zero emitters repo-wide**, so the
      old instruction to "repoint the emitting component" is unexecutable for
      them; they are dead-delete. **Record the 13 survivors by exact selector
      name in this phase's completion notes** so the plan-level exit check is a
      `comm` against a list, not a judgment call (plan.md's Success Criteria
      previously demanded zero `sh-*`, contradicting this carve-out).
- [ ] **Step 0 (rewritten by round-2 finding #12): re-derive the inventory with
      an ANCHORED pattern and an explicit false-positive filter.** Round 1's
      command regenerates the exact phantom it spent a Critical finding
      deleting: run verbatim it returns **261 unique hits, 32 of which are not
      CSS classes** — including `ck-trpc` (55 files, all `mock-trpc.js/.ts`
      import paths, e.g. `apps/admin/src/lib/permission-gate.test.tsx:17`) plus
      `ck-in`, `ck-out`, `ck-office`, `ck-inbox`, `ck-door`, `ck-circle`
      (substrings of `check-in`, `back-office`, `block-…`). Unlike Phase 1's
      Step 0.5, this step carried **no filter instruction at all**, while its
      Success Criterion required recording the output as authoritative.
      **Selectors:**
      `grep -oE '\.(ck|tpl|sh)-[a-z][a-z0-9-]*' packages/ui/src/console.css | sort -u`
      (expect 315 `ck-` / 28 `tpl-` / 19 `sh-`).
      **Emitters — anchor on attribute context, and include the renamed
      `packages/ui/src/console/` directory** (omitted by round 1, 8 unique
      `ck-` refs):
      `grep -rohE '\b(ck|tpl|sh)-[a-z][a-z0-9-]*' apps/admin/src packages/ui/src/components packages/ui/src/console apps/e2e --include=*.tsx --include=*.ts | sort -u`
      then **intersect the emitter set with the selector set** and require a
      written justification for every non-intersecting hit before any edit.
      **Expect `tpl-*` to show zero emitter hits** — if so, every `tpl-*`
      selector is dead-code deletion, not a component migration.
- [ ] **Step 0.4 (new — round-2 finding #4): produce a disposition for ALL 315
      `ck-*` selectors before committing to this phase's effort estimate.** The
      old rule ("fold where a real `.console-*` equivalent exists") covers only
      **43** of them: the suffix intersection between the 315 `.ck-*` and the
      113 `.o-*` selectors in `odoo.css` is 43, and **zero** CSS rules pair a
      `.ck-` with an `.o-` selector, so there is no in-file evidence of intended
      pairing for the other 272. Meanwhile Success Criteria demands zero `ck-*`
      remaining. As written the phase specifies 14% of its own work and then
      requires 100% completion — an executor hitting the gap either invents 272
      new `.console-*` names (a third prefix migration, explicitly rejected by
      plan.md's "Real retirement, not another prefix") or ticks a false
      criterion.
      **Validation decision (2026-08-07) — the policy is DELETE-FIRST, not
      rename-everything:**
      1. Delete `premium.css` first (step 2 below), then **re-measure live
         emitters** — the count that matters is what survives that removal,
         since all 315 `ck-*` selectors sit inside the `.o_web_client` mirror
         block (`odoo.css:1664`+) that duplicates the stylesheet being deleted.
      2. Any `ck-*` rule with **no live emitter → delete outright.** Do not
         rename dead CSS into the new namespace; that is how the mirror block
         got here in the first place.
      3. Only genuinely-emitted classes are renamed to `.console-*`; the 43
         with an existing peer are folded into it (suffix collisions checked
         first).
      **Emit a table covering all 315 → fold / rename / delete /
      keep-with-reason, and re-derive this phase's effort estimate from it** —
      not from 43, not from 315. Delete is expected to dominate; the table is
      what settles it.
- [ ] **Step 0.5 (rewritten by round-2 finding #12): use a BLOCK-based scan for
      multi-family selector groups, not a line-based grep.** Round 1's command
      returns 7 hits of which **6 are same-family churn** (`.ck-cstrip-seg-link,
      .ck-cstrip-seg-wrap`; three `.tpl-…, .tpl-…` groups; `.ck-steps-…`;
      `.ck-week-…`) — nothing to split — while missing **both** real
      cross-family hazards, because its `[a-z-]*,` sub-pattern cannot express
      them:
      - `odoo.css:2481` — `.o_web_client .sh-cta:active, .o_web_client .ck-mc:active`
        (breaks on the `:` of `:active`)
      - `odoo.css:2709` — `.tpl-dash-metrics > .ck-mc { max-width: none; }`
        (a **child combinator**, no comma — the pattern can never match it)
      Line 2709 is the dangerous one: it is a `ck-mc` rule *scoped by* a `tpl-*`
      ancestor, not a `tpl-*` rule. A mechanical "delete every line containing
      `.tpl-`" removes a `.ck-mc` declaration — and because `tpl-*` is genuinely
      inert, nothing fails, the Success Criterion gets ticked, and line 2481's
      group ships across two family commits: exactly the bisectability hole this
      step exists to close.
      **Method:** parse each `…{` selector prelude across newlines; flag any
      prelude whose set of `ck|sh|tpl|o` family prefixes has size > 1,
      regardless of combinator. Split each into single-family rules with
      identical declarations, in its own small commit, before the per-family
      passes. **Rule: a `tpl-*` token appearing as an ancestor in a compound
      selector is a scoping change, not a deletion — resolve those individually.**
- [ ] For each `ck-*` class, apply its Step 0.4 disposition. For the 43 with a
      genuine `.console-*` equivalent: repoint the emitting component, delete
      the `ck-*` rule. **Check for suffix collisions before folding** — no
      collision-detection step existed; `.ck-fc*` vs `.o-fc*` is an immediate
      candidate.
- [ ] `sh-*`: the **13** emitted by `SideNav`/`AppFrame` stay untouched (record
      them by name). The **6** with zero emitters (`sh-brand-name`,
      `sh-brand-sub`, `sh-cta`, `sh-cta--ghost`, `sh-cta--secondary`,
      `sh-logo`) are deleted outright — there is no emitter to repoint, which
      is why the old "repoint the emitting component" wording was unexecutable
      for them (finding #8). Note `sh-cta` also participates in the
      `odoo.css:2481` cross-family group — resolve that via Step 0.5 first.
- [ ] Delete all `tpl-*` selectors outright once Step 0 confirms zero emitters
      (expect this to be a pure CSS deletion, not a `.tsx` change).
- [ ] Float layers (`ToastViewport`, `CommandPalette`) — which mount as
      siblings of the router tree, not under `.o_web_client` — keep working
      after their `ck-toast*`/`ck-cmd*` classes are renamed; the unscoped
      float-layer CSS rules move to the new names and
      `console-float-layer.test.ts` (renamed in Phase 1) still guards them.
      **Note:** that test's matcher only sees bare (non-grouped) selector
      blocks — Step 0.5's split makes sure the float-layer rules aren't stuck
      inside a multi-family group where the test can't see them.
- [ ] `apps/e2e/**` selectors and the fidelity-audit script updated in lockstep
      with each family's rename (not deferred to the end) — same reasoning as
      Phase 1's e2e requirement.

## Architecture

Per-family retirement (`ck-*`, then `sh-*`, then delete `tpl-*`), each as its
own small commit with a CI gate between them — but only after Step 0.5's
selector-group split makes each family's rules genuinely independent in the
CSS source. Without that split, "per-family" is cosmetic — the cascade
doesn't respect commit boundaries.

## Related Code Files

**Read first (Step 0/0.5 discovery — exact lists, not guessed):**
- `packages/ui/src/console.css`
- `packages/ui/src/components/*.tsx` (emitters)
- `apps/admin/src/**/*.tsx` (emitters)
- `apps/e2e/**` (selector consumers)

**Modify (final list depends on Step 0's actual findings, not a pre-guess):**
- `packages/ui/src/console.css` — delete/repoint selectors
- Components found emitting a real (non-phantom, non-`tpl-*`) legacy class
- `packages/ui/src/console/console-float-layer.test.ts` — update expected class names if the toast/palette classes moved
- `apps/e2e/**` files touching any renamed selector

**Now IN scope (round-2 reversal):**
- `packages/ui/src/premium.css` — verify dead, then delete, together with
  `apps/lms/src/main.tsx:20` and the two `package.json` entries. Own commit.

**Explicitly out of scope:**
- `apps/lms/src/**` components and `apps/lms/src/app.css` (the real LMS design
  surface — the `lms-*` classes). The LMS exclusion still holds for these; it
  never legitimately covered `premium.css`.
- `packages/ui/src/components/side-nav.tsx`, `app-frame.tsx` (stay exported, the 13 `sh-*` rules they emit stay as-is)
- `apps/admin/src/test/mock-trpc.ts` and its 48 test importers (the phantom `ck-trpc` — not a rename target)

## Implementation Steps

1. Run Step 0's discovery greps; **intersect emitters against selectors and
   discard the ~32 phantoms** (`ck-trpc` et al.); record the filtered counts.
2. **Delete `premium.css` first** (own commit): verify
   `grep -rohE '\b(ck|sh|tpl)-[a-z][a-z0-9-]*' apps/lms/src` is empty, then
   remove the file, `apps/lms/src/main.tsx:20`, and the two `package.json`
   entries. Gate: `pnpm typecheck && pnpm test && pnpm --filter @cmc/admin build`
   plus an LMS smoke. Doing this before the family passes shrinks everything
   downstream and is trivially revertable on its own.
3. Produce Step 0.4's disposition table for all 315 `ck-*` selectors; re-derive
   this phase's effort estimate from it before continuing.
4. Run Step 0.5's **block-based** multi-family scan; split every flagged
   prelude into single-family rules (same declarations) in one small commit;
   resolve `odoo.css:2709`'s `tpl-*`-as-ancestor case individually (it is a
   scoping change, not a deletion). Verify `pnpm typecheck && pnpm test`.
5. Retire the `ck-*` family per the disposition table, **delete-first**: after
   step 2's `premium.css` removal, re-measure live emitters; delete every
   emitter-less `ck-*` rule outright, then repoint and rename only what is
   genuinely emitted (checking suffix collisions before each fold). Gate:
   `pnpm typecheck && pnpm test && pnpm --filter @cmc/admin build`.
6. `sh-*`: delete the 6 emitter-less selectors; leave the 13 emitted by
   `SideNav`/`AppFrame` and record them by name. Same gate.
7. Delete `tpl-*` selectors (confirmed dead in Step 0). Same gate.
8. Update every file from
   `grep -rlE "['\"\`.](ck|sh|tpl)-[a-z]" apps/e2e --include=*.ts --include=*.mjs`
   at the same commit as the family it belongs to (not batched at the end).
   Edit `design3-frontend-audit.mjs` and `webwright-prod-smoke.mjs`
   statically — **do not execute either** (Phase 1, finding #3).
9. `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` locally
   against the Prerequisites DB, after all families are done. Back up
   `apps/e2e/acceptance-results/journeys.json` first.
10. `pnpm --filter @cmc/admin build`.
11. Optional `detect_changes()` (see plan.md Constraints — GitNexus is no
    longer a prerequisite); otherwise review `git diff --stat` per commit.

## Success Criteria

- [ ] Step 0's counts recorded, **with phantoms excluded and justified** — the
      raw emitter grep returns 32 non-classes including `ck-trpc`; the recorded
      inventory must be the intersected/filtered set, not the raw 261.
- [ ] **Step 0.4's disposition table covers all 315 `ck-*` selectors**, and this
      phase's effort estimate was re-derived from it.
- [ ] Zero `ck-*` and `tpl-*` occurrences remain in
      `packages/ui/src/console.css`, `packages/ui/src/components`,
      `packages/ui/src/console`, `apps/admin/src`, or `apps/e2e`
      (grep-verified against Step 0's filtered list).
- [ ] `sh-*`: exactly the 13 `SideNav`/`AppFrame` selectors remain, enumerated
      by name in the completion notes; the 6 emitter-less ones are gone.
- [ ] **`packages/ui/src/premium.css` deleted**, `apps/lms/src/main.tsx:20`
      import removed, both `package.json` entries dropped — with the
      zero-LMS-consumer verification recorded, in its own revertable commit.
      LMS smoke green afterwards.
- [ ] `SideNav`/`AppFrame` still exported, unchanged, from `packages/ui/src/index.ts`.
- [ ] No multi-family selector prelude remains — verified by the **block-based**
      scan (Step 0.5), including combinator and pseudo-class forms, not the
      line-based comma grep.
- [ ] `console-float-layer.test.ts` passes with renamed classes.
- [ ] Real gates green: `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @cmc/admin build`, local `PLAYWRIGHT_UI=1 ui-chromium`
      e2e (against the Prerequisites DB; back up `journeys.json` first).
      `check:ui-frames`/`check:ui-a11y-roles` for the record only.
- [ ] `detect_changes()` optional (GitNexus is no longer a prerequisite); when
      skipped, `git diff --stat` reviewed per commit instead.

## Risk Assessment

- **Biggest risk in the whole plan** (unchanged from the original assessment,
  now correctly sized): the real scope here is ~4x what was originally
  estimated, and the fix isn't "sweep harder," it's "verify each per-family
  commit against Step 0.5's split groups so a regression stays bisectable to
  a small diff" — the mitigation only works because of the added pre-split step.
- **`premium.css` deletion is now in scope, and it is the highest-leverage step
  here — but verify before deleting.** It shares ~313 class names with
  `console.css`, and the evidence that LMS emits none of them
  (`grep -rohE '\b(ck|sh|tpl)-…' apps/lms/src` → empty) must be re-run and
  recorded at execution time, not taken from this plan. Phase 4's smoke list
  has no LMS route, so the LMS smoke in step 2's gate is the only check that
  will catch a wrong call — keep the deletion in its own commit so reverting
  costs nothing.
- **Real LMS scope creep still applies** to `apps/lms/src/**` and
  `apps/lms/src/app.css` (the `lms-*` classes). Those remain out of scope.
- **`SideNav`/`AppFrame` deletion temptation**: zero current importers makes
  them look like safe cleanup targets, but removing a public export is a
  contract change nobody asked for — leave them.


## Completion Notes

**Completed:** 2026-08-07 on `feature/cmc-console-design-system-rebrand`.

**Disposition (post dynamic recovery):** fold=0, rename=236, delete=79 of 315 `ck-*`.
See `notes/phase-02-ck-disposition.md`.

**sh-* survivors (13):** sh-sb, sh-brand, sh-nav, sh-item, sh-item-icon, sh-sub, sh-subitem, sh-root, sh-main, sh-top, sh-top-title, sh-top-actions, sh-content.

**sh-* deleted (6):** sh-brand-name, sh-brand-sub, sh-cta, sh-cta--ghost, sh-cta--secondary, sh-logo.

**tpl-*:** all 28 deleted (zero emitters).

**premium.css:** deleted after LMS zero-consumer verification (`notes/phase-02-lms-premium-check.txt`).

**Commits:**
- `650ff5d` delete premium.css
- `78342be` ck/tpl retirement + sh keep/delete
- follow-up nits: disposition accuracy, header comments, orphan surface utilities

**Gates:** typecheck 29/29; ui 142; admin 555; admin+lms build; ui-chromium **54/54**; journeys.json restored from bak-phase1.

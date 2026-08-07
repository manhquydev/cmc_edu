---
title: "CMC Console Design System Rebrand & Hardening"
description: "Rename apps/admin's Odoo-sourced ERP design system to 'CMC Console' branding (tokens/components/files/docs), retire legacy ck-*/tpl-*/sh-* mirror classes for real, re-audit against real Odoo 19.0 source fresh, close the long-open human visual smoke gate via live browser check, complete the admin component library, and clean up transition debt. Scope: apps/admin (ERP) ONLY — LMS keeps its separate TL12 premium design and is not touched."
status: pending
priority: P1
effort: "5-8w (provisional — Phase 2 re-derives its own estimate at Step 0.4)"
tags: [design-system, rebrand, console, admin, ui, cleanup]
created: 2026-08-07
blockedBy: []
blocks: [260805-1920-design3-admin-rollout, 260806-odoo-ui-component-dissection]
---

# CMC Console Design System Rebrand & Hardening

## Overview

`apps/admin`'s design system is a source-grounded recreation of Odoo 19.0's backend
web-client UI, shipped and CI-green (`docs/design-system-odoo.md`,
`plans/260805-1920-design3-admin-rollout/plan.md` — status `validation`, all 6
phases unit-complete). Two things are still wrong with it:

1. **It's branded "Odoo" everywhere in our own code** (`--odoo-*` tokens,
   `OdooNavbar`, `odoo.css`, `docs/design-system-odoo.md`, the `.o-*` template
   class family) even though only ONE class (`.o_web_client`) is an actual
   literal mirror of real Odoo DOM markup. Everything else is our own naming
   that happens to say "Odoo." User decision: rename our own branding to
   **"CMC Console"**; keep the one genuine structural mirror class as-is.
2. **Open debt from the rollout is still open**: human visual smoke was never
   done (CI proves DOM/state, not pixels), 3 ListPages lack FilterBar, and
   ~89 legacy `ck-*`/`tpl-*`/`sh-*` classes are painted via a "selector mirror"
   duplicate-CSS workaround instead of being truly retired.

This plan does both: rebrands admin's own design-system identifiers, then uses
the rebrand as the forcing function to finally close out the rollout's open
items (fresh audit, live visual smoke, legacy class retirement, component gaps,
cleanup) — cheaper to do together than as two separate touches of the same
files.

**Explicitly excluded:** LMS (student/parent). It uses a different, separate
design language (TL12 "premium," mobile-first) by deliberate product decision
recorded in `docs/design-system-odoo.md` and reconfirmed by the user for this
plan. Nothing in this plan touches `packages/ui/src/premium.css`,
`AppFrame`/`SideNav`, or any `apps/lms` file.

## Naming Decision (locked — do not re-litigate mid-implementation)

**Red-team correction (see `## Red Team Review`): every class/token count below was measured with an unanchored grep during planning and is WRONG, some by 4x. Do not treat any count in this table as a target — Phase 1/2's first step is re-deriving exact counts from the live codebase with anchored patterns. The table's job is to fix *which prefix* things move to, not *how many* there are.**

| What | Old | New | Rationale |
|---|---|---|---|
| CSS custom properties (~38-40, re-verify) | `--odoo-*` | `--console-*` | Parallels existing `--cmc-*` shared/base tokens (TL12) without colliding with them; scoped to the ERP-specific layer. |
| Our own template classes defined in `odoo.css` (~113-119, re-verify) + classes emitted only from `packages/ui/src/components/*.tsx` (not previously counted — ~81 more) | `.o-*` | `.console-*` | These are entirely our invention (Phase 3 port), not Odoo's. 1:1 suffix-preserving rename (`.o-navbar` → `.console-navbar`). Discovery must cover BOTH `packages/ui/src/odoo.css` (selectors) AND `packages/ui/src/components/**/*.tsx` + `apps/admin/src/**` (emitters) — the two were previously scoped separately and undercounted as a result. |
| Legacy premium-era classes: `ck-*` (315 unique selectors in `odoo.css`, measured round 2 — not 67, not "~316 re-verify"), `tpl-*` (28 selectors, **zero live emitters** — dead mirror CSS, not a component migration), `sh-*` (19 selectors: **13 emitted by `SideNav`/`AppFrame`, 6 with zero emitters anywhere**) | mixed prefixes, painted via selector-mirror duplication | `ck-*` per the explicit disposition table Phase 2 Step 0 must produce (see below); the 13 emitted `sh-*` stay with their components, the 6 emitter-less `sh-*` are deleted; `tpl-*` deleted outright | **Round-2 correction (finding #4): the "fold where a `.console-*` equivalent exists" rule covers only 43 of 315 `ck-*` classes** — suffix intersection is 43, and zero CSS rules pair a `.ck-` with an `.o-` selector, so there is no in-file evidence of intended pairing for the other 272. Phase 2 Step 0 must emit a disposition (fold / rename / delete / keep) for **every one of the 315** before its effort estimate means anything. **Round-2 scope reversal (finding #1 + user decision 2026-08-07): `packages/ui/src/premium.css` is now IN scope for verified deletion** — see the row below. |
| `packages/ui/src/premium.css` (2274 lines; 423 `.ck-*`, 33 `.tpl-*`, 29 `.sh-*`, 2 `.fp-*` rule heads) | imported by `apps/lms/src/main.tsx:20`, previously excluded as "LMS-owned" | **verify dead, then delete** (file + LMS import + the two `package.json` entries) | **Round-2 finding #1 overturned the exclusion's rationale.** `apps/lms/src` emits **zero** `ck-*`/`sh-*`/`tpl-*` classes — its complete className set is `lms-page`, `lms-page__title`, `lms-shell`, `lms-star-hero{,__label,__value}`, `lms-topbar{,__brand}`, `lms-child-chip`, all defined in `apps/lms/src/app.css`. The stylesheet's only emitters are the 26 shared `packages/ui/src/components/*.tsx` files that Phase 2 rewrites anyway — so the file-level fence protected nothing, and keeping it would have left 313 selectors permanently orphaned from every emitter with no gate (inverting the drift-reduction goal, not achieving it). User decision: verify zero LMS consumers, then delete in one revertable commit. |
| `SideNav`, `AppFrame` public exports (emit `sh-*`) | exported from `@cmc/ui`, zero current importers in admin or LMS | **stay exported, unchanged** | Explicit decision (was an inferred side-effect pre-red-team): nothing currently imports either component, but they are public barrel exports (`packages/ui/src/index.ts`). Removing/renaming them is a public-contract change nobody asked for — out of scope (YAGNI). Their `sh-*` CSS rules stay as dead-but-owned code; Phase 6 may flag them but does not delete without a separate explicit decision. **Round-2 precision (finding #8): only 13 of the 19 `sh-*` selectors are actually emitted by these two components. The other 6 (`sh-brand-name`, `sh-brand-sub`, `sh-cta`, `sh-cta--ghost`, `sh-cta--secondary`, `sh-logo`) have zero emitters repo-wide — they are dead-delete, not "repoint the emitting component" (there is nothing to repoint).** |
| `ck-trpc` | — | — | **Does not exist — deleted from scope.** Red-team found this was a grep artifact: all matches are the substring `ck-trpc` inside the test-mock filename `mock-trpc.js`/`mock-trpc.ts`, not a CSS class. No action needed. |
| Root shell scope class | `.o_web_client` | **unchanged** | This is a genuine literal copy of Odoo's own DOM class name (verified against `plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md`, and independently re-confirmed during red-team: it is the only `.o_*` underscore-style selector actually used as a selector rather than a code comment). Kept deliberately as a structural/CSS-fidelity anchor for future re-audits against upstream Odoo. It carries zero user-facing "Odoo branding" — it's an invisible selector. Renaming it for cosmetic reasons would destroy the fidelity anchor for no benefit. |
| Components | `OdooNavbar`, `OdooNavbarProps` | `ConsoleNavbar`, `ConsoleNavbarProps` | Our branding, exported symbols. Note: a string literal in `apps/admin/src/shell/shell.test.tsx` (test description text, not code) also says "OdooNavbar" — a symbol-rename tool will not touch prose strings; Phase 1 must grep for these separately. |
| Components | `KanbanBoard`, `KanbanColumn`, `KanbanCard` | **unchanged** | Generic project-management naming, not Odoo-specific (confirmed: Kanban predates and is unrelated to Odoo). Renaming would be churn with no branding benefit (YAGNI). Files still move into the renamed directory. |
| Directory | `packages/ui/src/odoo/` | `packages/ui/src/console/` | |
| Files | `odoo.css` (sibling of the directory, at `packages/ui/src/odoo.css`), `odoo-navbar.tsx`, `odoo-kanban.tsx`, and the 7 test files in `packages/ui/src/odoo/` (`odoo-navbar.test.tsx`, `odoo-kanban.test.tsx`, `odoo-astryx-remap.test.ts`, `odoo-cp-sheet.test.ts`, `odoo-shell-stacking.test.ts`, `odoo-tokens.test.ts`, `odoo-float-layer.test.ts`) | `console.css`, `console-navbar.tsx`, `console-kanban.tsx`, + matching `console-*.test.ts(x)` | Corrected from an earlier miscount ("10 files"/"8 tests" — actual is 9 files total, 7 of them tests, with `odoo.css` living one level up from the directory, not inside it). |
| Package export | `packages/ui/package.json` `exports["./odoo.css"]` = `"./src/odoo.css"`, plus `files` allowlist entry | `exports["./console.css"]` = `"./src/console.css"` | **Missing from the original plan — added by red-team.** `apps/admin/src/main.tsx` imports `@cmc/ui/odoo.css` through this export map; renaming the file without updating this breaks the admin build (not caught by `typecheck`, only by an actual build). |
| Doc | `docs/design-system-odoo.md` | `docs/design-system-console.md` | Title becomes "Design System: CMC Console (Admin ERP UI Language)". Historical provenance section (verification against real Odoo 19.0 source, including the LGPL-3 attribution + upstream commit) stays factual, unredacted, and **verbatim** — that's honest lineage and a license obligation, not branding. See Phase 3/7 for a pin-commit discrepancy that must be resolved as part of this, not glossed over. |
| Maintainer map | `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` | `CONSOLE-COMPONENT-MAP.md` | |
| **Explicitly NOT renamed** | `FilterBar` symbol | unchanged | Locked by `scripts/check-ui-frames.mjs` gate; renaming requires rewriting that script in the same commit, which is out of scope (existing rollout plan already made this call). |
| **Explicitly in scope but missed in the original plan** | `apps/e2e/**` — **exactly 12 files** hardcode `.o-*` selectors (round-2 measured; round 1 said "12+" and then listed 11). Always derive the list with `grep -rlE "['\"\`.]o-[a-z]" apps/e2e --include=*.ts --include=*.mjs`, never by hand. Includes two shared journey helpers, `design3-frontend-audit.mjs`, and `webwright-prod-smoke.mjs` — **edit both scripts statically, execute neither** (both read `.env.prod` and drive the prod stack) | same selectors, renamed | **Added by red-team — this was the single largest gap in the original plan.** Every phase's file list and exit grep must include `apps/e2e/`, not just `packages/ui` and `apps/admin`. Missing this would silently break `ui-e2e` (a required CI check) and the `pnpm acceptance:report` proven-journey count. |

## Prerequisites (before Phase 1 starts)

Added by round-2 red team. These are ordered, blocking, and cheap — each exists
because a later phase silently assumes it.

1. **Merge PR #75 first** (user decision 2026-08-07). The design system is
   **not shipped**: `gh pr view 75` → `OPEN`, `develop`→`main`, 99 files,
   `MERGEABLE`; `git rev-list --count main..develop` → 18, `develop..main` → 0;
   the design system landed on `develop` 2026-08-06, one day before this plan
   was written. plan.md previously described it as "shipped and CI-green"
   (round-2 finding #2) and sized the rebrand as a post-ship migration. Land the
   PR, then rename against a current `main` as its own PR. This also clears the
   rollout plan's *second* stated blocker — `plans/260805-1920-design3-admin-rollout/plan.md:9`
   lists "human visual smoke **+ PR merge**", and Phase 7 previously closed it
   on smoke evidence alone.
2. **Add `outputs/` to `.gitignore`** (own commit). Currently un-ignored
   (`git check-ignore outputs/x` → exit 1; `.gitignore:189` covers only
   `.playwright-mcp/`), and two e2e scripts write authenticated full-page PNGs
   there. See finding #3.
3. **Stand up the throwaway synthetic DB once, here — not in Phase 4.**
   `bash scripts/synthetic-seed-env.sh --fresh` with `SYNTH_SEED_ALLOW=1` (the
   script is mode `100644`, so it must be invoked via `bash`, not executed
   directly). Phases 1/2/5/6 all cite a local e2e gate that hard-fails without
   `APP_DATABASE_URL`/`DATABASE_URL`; the only standup instructions used to live
   in Phase 4, which the round-1 reorder moved to last (finding #5).
4. **Pin GitNexus or skip it.** Do not run unpinned `npx gitnexus analyze`
   against this repo root — see Constraints.

## Non-Goals

- LMS chrome and shell (`AppFrame`/`SideNav` usage, `apps/lms/**` components)
  — untouched, per user decision. **`packages/ui/src/premium.css` is no longer
  covered by this exclusion** (round-2 finding #1 + user decision): it is
  imported by LMS but LMS emits none of its classes, so it is dead code, not
  LMS-owned design language. It is deleted under Phase 2 after verification.
- Odoo-parity features already declared non-goals: pivot indent formula,
  calendar grid-shell, dropdown↔bottom-sheet responsive switch. Build only if
  a real admin surface needs one.
- Automated visual-regression/screenshot-diff CI tooling. No VRT *framework*
  exists today (zero `toHaveScreenshot`/Percy/Chromatic references), **but the
  original phrasing "none exists today" was measured with a grep that
  structurally could not find what does exist** (round-2 finding #3): two
  `apps/e2e` scripts call `page.screenshot()` — `design3-frontend-audit.mjs`
  (`:292`, `:421`, `:663`) and `webwright-prod-smoke.mjs` (`:42-46`) — both
  targeting the prod stack and both writing to `outputs/`, which is not
  gitignored. Neither is CI-wired, but both persist authenticated screenshots
  to disk on demand. Adding persisted-screenshot automation reopens a
  previously *gated*
  policy question (`docs/journals/260717-acceptance-ledger-v1-manifest-driven-antidrif.md`:
  screenshot evidence Phase 4 explicitly parked over child-data risk — capturing
  real student/guardian data if pointed at the wrong environment). This plan's
  Phase 4 closes the human-visual-smoke gap with **ephemeral, local-only,
  synthetic-seed-data** browser inspection instead — it does not persist
  screenshots and does not touch that gated decision. Standing up real
  visual-regression tooling is a separate, future decision requiring its own
  threat-model review.
- Backend work to unblock `leaderboard.tsx` (needs a ranked-aggregate endpoint)
  or `refund.tsx` (needs a receipt-search/pick + approval UX spec). Phase 5
  documents these as explicitly deferred, not silently dropped.
- Moving the Odoo source pin forward. The dissection plan pins a specific Odoo
  19.0 commit intentionally; this plan re-verifies our code against that same
  pinned commit, it does not chase upstream HEAD. **Red-team correction:** two
  different commits are currently recorded as "the pin" in this repo
  (`packages/ui/src/odoo.css` header + `docs/design-system-odoo.md` +
  `odoo-tokens.test.ts` all cite `5568f6e4…`; `ODOO_PIN.txt` and the actual
  local clone HEAD are at `7de220c9…`). Phase 3 reconciles which one is
  authoritative as its first step, before any source comparison — this is a
  provenance/attribution correction, not a "which pin to chase" decision.
- Standing up automated visual-regression/screenshot-diff CI tooling (restated
  from above for emphasis — Phase 4 is ephemeral/manual by design).
- **Hardening the two prod-targeted e2e scripts** (`apps/e2e/design3-frontend-audit.mjs`,
  `apps/e2e/webwright-prod-smoke.mjs`). Validation decision 2026-08-07:
  **rename their selectors only, mark them do-not-execute, and file the real
  fix as separate work.** Both currently read `.env.prod`, hardcode
  `https://localhost/admin` with no configurable base URL, write full-page
  PNGs of authenticated pages (including `/admin/students`) to `outputs/`, and
  `design3-frontend-audit.mjs` additionally **rotates the super-admin
  password** (`:149-169`). Renaming keeps them syntactically current so this
  plan does not silently break them; running or rewriting them is out of scope.
  **Deferred work item — "harden prod e2e scripts":** parameterize the base
  URL, source credentials from a throwaway env, drop the password-rotation
  branch, redirect artifacts out of the repo, and give it the same
  threat-model review Phase 4 received. Neither script is CI-wired, so nothing
  breaks by leaving them unrunnable in the meantime.
- Removing or renaming the public `SideNav`/`AppFrame` exports from `@cmc/ui`.
  Nothing currently imports them, but they are a public barrel contract; this
  plan leaves them exported and unchanged (see Naming Decision table).

## Constraints

- `typecheck-and-test` AND `ui-e2e` must stay green after every phase — both
  are required CI checks on `main` (AGENTS.md "Operating model": solo-operator +
  AI-generated code, CI is the only review gate).
- **Local e2e gate is `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`
  (the `ui-chromium` Playwright project only registers when `PLAYWRIGHT_UI=1`
  is set — without it the command matches zero specs and looks like a pass).**
  Every phase that cites this command must include the env var; CI's
  `ui-e2e.yml` already sets it, which is why this was easy to miss locally.
- **Round-2 correction (finding #5): that command cannot run locally without
  the Prerequisites step 3 database.** `apps/e2e/src/global-setup.ts:10-16,49-58,80`
  hard-fails on missing `APP_DATABASE_URL`/`DATABASE_URL`, runs
  `assertNotProdDatabase` against both, and needs a migrated Postgres with the
  `cmc_app` role password set — all supplied by `ui-e2e.yml:127-129,145-152` in
  CI and by nothing at all locally. **Second-order hazard: each local
  `PLAYWRIGHT_UI=1` run overwrites `apps/e2e/acceptance-results/journeys.json`**
  (the JSON reporter registers only under that env var), which is the exact file
  `scripts/acceptance-report/verify.ts:32` ingests. Four mandated local runs
  against a mid-rename dirty tree would replace the acceptance ledger's input
  with `dirty: true` local results — and AGENTS.md requires that number to come
  from the CI `ui-e2e` artifact. Back up `journeys.json` before local runs, or
  re-derive from the CI artifact before making any acceptance claim.
- **`pnpm check:ui-frames` is NOT a gate for this plan and must not be cited as
  one** (round-2 finding #10, superseding round-1 finding #19's partial fix).
  `scripts/check-ui-frames.mjs:13` walks only `apps/admin/src/pages`; `:33-45`
  counts 11 React symbol names; `:174-185` fails on exactly two conditions
  (`bulkListsOk`, `dualRisk`); `:186` exits 0 otherwise. It contains zero
  references to `o-`, `--odoo-`, `ck-`, `sh-`, or `tpl-` and never reads a
  `.css` file or anything under `packages/ui`. Every operation in this plan is
  invisible to it — it will be green after a completely broken rename. The
  `--json` before/after baseline diff is likewise vacuous: nothing here touches
  those symbols, and its first field is `generatedAt` (a fresh ISO timestamp),
  so the diff is both always non-empty and never meaningful. Keep running it as
  a regression-of-record; do not treat green as evidence. **The real gates are
  `pnpm --filter @cmc/admin build`, `pnpm test` (7 unit tests that read CSS text
  and assert literal values), and the `ui-chromium` e2e run.**
- **GitNexus: manual verification is the primary path. This supersedes
  Validation Log decision #2** (round-2 finding #13 — the user's
  "apply all 15 findings" decision on 2026-08-07 explicitly reverses the
  earlier "index now, blocking prerequisite" choice). Reasons, both measured:
  1. **Supply chain.** `gitnexus` appears in no `package.json`, no workflow, no
     lockfile. `npx gitnexus analyze` resolves whatever version is published
     that day, unpinned and unverified, and runs it with read access to a repo
     root holding `.env.prod` and `.env.local-sim-accounts`. This repo already
     has a documented convention for third-party CLI execution and it is the
     opposite: `scripts/bootstrap-harness.sh:28-60` installs from a pinned
     release tag and verifies a SHA-256 checksum before executing. Making an
     unpinned `npx` a *blocking* prerequisite — with the instruction to
     "troubleshoot until it works," which pushes toward `npm i -g` — raised
     exposure with no threat-model note.
  2. **It buys nothing here.** The only TypeScript symbols renamed are
     `OdooNavbar`/`OdooNavbarProps`, whose complete production consumer set is
     three sites: `packages/ui/src/index.ts:173-174` (barrel),
     `apps/admin/src/shell/shell.tsx:5` (import), `:129` (JSX). The remaining
     `grep -rn 'OdooNavbar'` hits are the definition, its own colocated test, a
     prose string, and a comment. `ViewSwitcher`/`FormDialog` have 0 hits
     repo-wide. There is no call graph to analyse.
  **Do:** `grep -rn 'OdooNavbar' packages apps` → edit the three sites →
  `tsc --noEmit` → before/after count diff. If you want GitNexus anyway, pin it
  (`npx gitnexus@<version>`) and record the version + integrity hash here
  alongside the `bootstrap-harness.sh` precedent. Every `detect_changes()` gate
  in the phase files is optional on the same grounds — these phases are, by
  their own Architecture sections, pure string substitution with no symbol
  impact.
- CSS custom-property and class-string renames aren't GitNexus-tracked symbols —
  each rename sweep in Phase 1/2 needs a grep-verified before/after count
  (zero old-prefix occurrences remaining outside intentionally-excluded files)
  plus the **real** gates — `pnpm typecheck`, `pnpm test`,
  `pnpm --filter @cmc/admin build` (catches broken CSS import resolution that
  `typecheck` cannot see), and the `PLAYWRIGHT_UI=1` e2e command above —
  before moving to the next phase. `pnpm check:ui-frames` and
  `pnpm check:ui-a11y-roles` are run for the record but prove nothing here
  (see the `check:ui-frames` constraint above).
- **Rename discovery/verification must cover `apps/e2e/**` in addition to
  `packages/ui` and `apps/admin`** — the original plan omitted it and it
  hardcodes the exact selectors being renamed, including in shared journey
  helpers and a 30-selector fidelity-audit script.
- **Never hand-enumerate the `apps/e2e` file list — generate it** (round-2
  finding #11, reported independently by all four reviewers). Round 1 claimed
  "12+ files," then Phase 1 listed **11**. The actual count is 12; the missing
  file, `apps/e2e/webwright-prod-smoke.mjs`, is the highest-consequence member:
  it hardcodes `.o-brand` (`:173`), `main.o-main` (`:219`), `.o-kanban-board,
  .o-list` (`:223`), `o_web_client` (`:96`), reads `.env.prod` (`:24-40`), and
  writes screenshots to `outputs/`. Playwright `.count()` returns 0 rather than
  throwing, so after the rename it emits an all-zero report that reads as
  "smoke clean" against the prod stack — the exact fail-open pattern round 1
  identified for its sibling script and fixed only there. Phase 6's
  `find -iname '*odoo*'` will not catch it (no "odoo" in the filename).
  **Canonical discovery command, to be used in every phase instead of a
  written-out list:**
  `grep -rlE "['\"\`.]o-[a-z]" apps/e2e --include=*.ts --include=*.mjs`
  A hand-maintained list has now drifted twice.
- Keep `FilterBar` symbol name (see Naming Decision table).
- Plans live in `plans/<timestamp>-<slug>/` in this repo (not
  `docs/plans/active/`, which is Harness-managed).

## Cross-Plan Coordination

- **`plans/260805-1920-design3-admin-rollout/plan.md`** (status: `validation`,
  blocked only on "human visual smoke" + PR merge). This plan's Phase 4 closes
  that exact item. Relationship recorded bidirectionally: that plan is
  `blockedBy` this one; this plan `blocks` it. On Phase 4 completion, flip that
  plan's status to `completed` (Phase 7, item 5).
- **`plans/260806-odoo-ui-component-dissection/plan.md`** (status: `active`,
  ongoing process — owns the Odoo source pin, the extraction process, and the
  evergreen `ODOO-COMPONENT-MAP.md`). This plan reuses that pin and process in
  Phase 3 rather than re-deriving it, and renames the map file/updates its own
  authority-path references in Phase 7. Relationship recorded bidirectionally:
  that plan is `blockedBy` this one (its authority paths change); this plan
  `blocks` it.
- Other design/odoo-tagged plans in `plans/` (`260802-design-lab-visual-system`,
  `260803-2043-odoo-ux-grammar-full-adoption`, `260803-2301-ui-shell-settings-command-bulk-rollout`,
  `260805-1325-design2-system-exploration`, `260806-1045-odoo-grammar-gap-cook`,
  `260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit`,
  `260806-design3-detail-grammar-validation`) are `completed` historical
  records. Per `documentation-management.md` they are stateful records, not
  evergreen authority — **do not rewrite their content** for the rename; they
  stay as accurate history of what was true when they ran.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Rename admin's own design-system branding (tokens/components/files/docs) from "Odoo" to "CMC Console," preserving the one genuine Odoo DOM-mirror class | P1 |
| 2 | Retire `ck-*`/`tpl-*`/`sh-*` legacy classes into the new scheme for real — remove the selector-mirror duplication | P1 |
| 3 | Fresh, source-grounded re-audit of admin against the pinned real Odoo 19.0 commit (don't just trust the 2026-08-05 audit) | P1 |
| 4 | Close the long-open "human visual smoke" gap via live, local, synthetic-data browser verification | P1 |
| 5 | Fill concrete component-library gaps found in the audit (navbar brand=module, ViewSwitcher extraction, CRM dialog archetype, ControlBar densify, sticky-thead test proof) | P2 |
| 6 | Clean up dead code left behind by the rename/retirement | P2 |
| 7 | Update evergreen docs and close/relink the plans this work supersedes | P1 |

## Phases

| # | Phase (file) | Execution order | Status |
|---|-------|---|--------|
| 1 | [Phase 1: Rebrand — Tokens, Symbols, Files & Docs](./phase-01-start.md) | 1st | Completed |
| 2 | [Phase 2: Legacy Class Retirement](./phase-02-legacy-class-retirement.md) | 2nd | Completed |
| 3 | [Phase 3: Fresh Source-Grounded Audit](./phase-03-fresh-source-grounded-audit.md) | 3rd | Completed |
| 4 | [Phase 4: Live Browser Visual Smoke](./phase-04-live-browser-visual-smoke.md) | **6th (moved)** | Pending |
| 5 | [Phase 5: Component Library Completion](./phase-05-component-library-completion.md) | 4th | Pending |
| 6 | [Phase 6: Codebase Cleanup](./phase-06-codebase-cleanup.md) | 5th | Pending |
| 7 | [Phase 7: Docs and Cross-Plan Consolidation](./phase-07-docs-and-cross-plan-consolidation.md) | 7th | Pending |

**Red-team correction:** file numbers no longer match execution order.
Original sequencing put the only pixel-level human check (Phase 4) before the
two phases that change pixels afterward (Phase 5's component work, Phase 6's
CSS deletions), which meant the visual smoke evidence Phase 7 cites to close
the rollout plan would predate the actual final UI. Corrected order:
**1 → 2 → 3 → 5 → 6 → 4 → 7**. File names/numbers are kept as originally
created (to avoid a risky mass rename mid-review); each phase file's
`dependencies` frontmatter reflects the corrected order — follow
`dependencies`, not the filename number, when executing.

Phases are **sequential** (not parallel) — nearly every phase touches
`packages/ui/src/console.css` (née `odoo.css`) and shared admin templates, so
concurrent edits would conflict. Each phase gates on CI staying green before
the next starts.

## Success Criteria

- [ ] PR #75 merged to `main` before Phase 1 starts (Prerequisites step 1).
- [ ] `outputs/` added to `.gitignore`; zero authenticated screenshots ever
      committed (Prerequisites step 2).
- [ ] Zero remaining `--odoo-*`, our-own `.o-*` template classes, `ck-*`, and
      `OdooNavbar`/`OdooNavbarProps` occurrences in `packages/ui`,
      `apps/admin`, **and `apps/e2e`** (grep-verified against the exact class
      names enumerated at Phase 1/2 start, not a broad prefix pattern — see
      Phase 1/2 for why), with these **explicit, enumerated exceptions**:
      - `.o_web_client` — the deliberately preserved DOM-mirror anchor.
      - **The 13 `sh-*` selectors emitted by `SideNav`/`AppFrame`** — these
        stay, per the Naming Decision carve-out. **Round-2 finding #8: this
        exception was missing from this criterion, which demanded zero `sh-*`
        while Phase 2 was forbidden to deliver it.** Phase 2 must record the
        13 surviving selectors by exact name so this check is a `comm`, not a
        judgment call. The other 6 `sh-*` (zero emitters) are deleted.
      - `tpl-*` selectors deleted outright (dead code, no live emitters).
- [ ] `packages/ui/src/premium.css` verified to have zero LMS consumers, then
      deleted along with `apps/lms/src/main.tsx:20` and its two
      `package.json` entries — in one revertable commit (user decision;
      round-2 finding #1).
- [ ] Phase 2 Step 0 produced an explicit disposition for **all 315** `ck-*`
      selectors, not just the 43 with a `.o-*` counterpart (round-2 finding #4).
- [ ] `packages/ui/package.json`'s `exports`/`files` entries and
      `apps/admin/src/main.tsx`'s import updated to match the renamed CSS file;
      `pnpm --filter @cmc/admin build` succeeds (not just `typecheck`).
- [ ] **Real gates** green after every phase: `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @cmc/admin build`, and
      `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`
      (against the Prerequisites step 3 database — it cannot run without one).
      `pnpm check:ui-frames` and `pnpm check:ui-a11y-roles` are run as
      regression-of-record but are **not** evidence for this plan:
      `check-ui-frames` is structurally blind to every change here (Constraints,
      round-2 finding #10).
- [ ] `apps/e2e/acceptance-results/journeys.json` not left overwritten by a
      local dirty-tree run; any acceptance figure quoted comes from the CI
      `ui-e2e` artifact (round-2 finding #5).
- [ ] `detect_changes()` is optional (see Constraints — GitNexus is no longer a
      prerequisite); when skipped, the manual verification named in Phase 1 is
      used and stated explicitly in the phase's completion notes.
- [ ] Fresh fidelity audit report exists, resolves which Odoo commit is
      authoritative (see Non-Goals), and its findings are triaged
      (accept/reject with rationale, matching this repo's existing red-team
      format).
- [ ] Visual smoke report exists covering: toast, ⌘K, CRM list↔kanban,
      CRM opportunity detail statusbar, a cancelled-receipt statusbar, teaching
      calendar — run LAST (after Phases 3/5/6, see corrected execution order),
      using only a throwaway synthetic-seed stack, no persisted screenshots.
      **Round-2 finding #7: the report must state honestly what the session
      did and did not prove.** An injected `cmc_staff_session` cookie is NOT a
      stronger auth path than `x-dev-user` — `mintStaffCookie`
      (`apps/e2e/src/session-injection.ts:128-145`) takes `roles`/`facilityId`
      as caller-supplied arguments and `apps/api/src/context.ts:218-232` builds
      the subject straight from those claims with zero DB lookup, byte-identical
      to `parseDevUser` (`:74-86`). Either drive the real
      `POST /auth/staff-login` flow against a seeded staff user, or record the
      phase as verifying **rendering, not permission derivation**. Do not claim
      the latter while doing the former.
- [ ] `docs/design-system-console.md` is the sole evergreen authority, with
      LGPL-3 attribution and the (reconciled) upstream commit preserved
      verbatim; all cross-references updated (grep-derived list, not
      hand-enumerated); `docs/design-system-odoo.md` no longer exists.
- [ ] `plans/260805-1920-design3-admin-rollout/plan.md` status flipped to
      `completed`, citing the LAST-run visual smoke report (post-cleanup), not
      an earlier one — **and only once BOTH its stated blockers are closed.**
      That plan's line 9 lists "human visual smoke **+ PR merge**"; Phase 7
      previously closed it on smoke evidence alone (round-2 finding #2). With
      PR #75 merged as Prerequisites step 1, both are satisfied — confirm, don't
      assume.

## Evidence & References

- `docs/design-system-odoo.md` (current authority, to be renamed)
- `plans/260805-1920-design3-admin-rollout/plan.md` (predecessor, status `validation`)
- `plans/260806-odoo-ui-component-dissection/plan.md` + `reports/odoo-19-source-dissection.md` (Odoo pin, extraction process, component matrix)
- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` (to be renamed)
- `scripts/check-ui-frames.mjs` (frame-adoption gate; confirmed zero dependency on Odoo-named symbols except locked `FilterBar`)
- `docs/journals/260717-acceptance-ledger-v1-manifest-driven-antidrif.md` (screenshot-evidence policy gate — informs Phase 4's ephemeral-only approach)
- Explore-agent findings from this planning session (identifier classification, e2e/smoke tooling map, component/page coverage table) — folded directly into Phases 1, 3-5 below.

## Red Team Review

### Session — 2026-08-07

**Reviewers:** 4 (Security Adversary/Fact Checker, Failure Mode Analyst/Flow Tracer, Assumption Destroyer/Scope Auditor, Scope & Complexity Critic/Contract Verifier) — full tier (7 phases), each independently reading all 8 plan files and verifying claims against the live codebase.

**Findings:** 41 raised across 4 reviewers, deduplicated to 22 unique root causes below. **Severity breakdown:** 15 Critical, 6 High, 1 Medium (post-dedup; several were flagged Critical by 2-4 reviewers independently, which is why the accept rate is unusually high — this is convergent evidence, not one reviewer's opinion).

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `ck-trpc` "legacy class" is a grep artifact of the `mock-trpc.ts` filename substring — no such CSS class exists (found independently by all 4 reviewers) | Critical | Accept | Phase 2, plan.md Naming Decision |
| 2 | Legacy class counts wrong by ~4x: `ck-*` is ~316 selectors not 67, `tpl-*` is ~28 with **zero live emitters** (dead CSS, not a migration), `sh-*` is ~19 emitted by exported `SideNav`/`AppFrame` | Critical | Accept | Phase 2, plan.md Naming Decision |
| 3 | `.o-*` count wrong (113-131 depending on scope, not 119); original discovery scope missed `packages/ui/src/components/*.tsx` emitters entirely | High | Accept | Phase 1, plan.md Naming Decision |
| 4 | Grep pattern `\.o-[a-z]` (dotted) cannot match JSX `className="o-main"` (dotless) — baseline/exit criteria measured the wrong surface and would report false-zero while live classes remain unrenamed | Critical | Accept | Phase 1, Phase 2 |
| 5 | `apps/e2e/**` entirely absent from every phase's scope despite 12+ files hardcoding the exact selectors being renamed, incl. two shared journey helpers and a 30-selector fidelity-audit script that fails open (`.count() === 0` reads as pass) | Critical | Accept | Phase 1, Phase 2, Phase 6, plan.md (all sections) |
| 6 | `packages/ui/package.json`'s `exports["./odoo.css"]`/`files` entry and `apps/admin/src/main.tsx`'s import were missing from Phase 1 — renaming the CSS file breaks the admin build, uncaught by `typecheck` | Critical | Accept | Phase 1 |
| 7 | Two conflicting Odoo pin commits exist (`5568f6e4…` in shipped CSS/docs/test vs `7de220c9…` in `ODOO_PIN.txt`/clone HEAD); Phase 3 would silently audit against the wrong provenance | High | Accept | Phase 3, Phase 7, plan.md Non-Goals |
| 8 | Phase 4's seed command (`LOCAL_SIM_SEED_ALLOW=1 tsx scripts/seed-local-sim-demo.ts`) does not read `DATABASE_URL`, targets the local-sim `cmc_prod` docker stack via HTTPS, reads real `.env.prod` super-admin credentials, and **rotates the super-admin password** — the plan's stated safeguard checks a variable the script never uses | Critical | Accept | Phase 4 (full rewrite) |
| 9 | `PLAYWRIGHT_UI=1` env var missing from every citation of the local e2e gate command — without it, `--project=ui-chromium` matches zero specs and a broken rename would pass locally then fail in CI | Critical | Accept | plan.md Constraints, Phase 1, Phase 2, Phase 5, Phase 6 |
| 10 | GitNexus is not installed/indexed in this repo (`.gitnexus/` gitignored and absent) — every phase's `impact()`/`rename()`/`detect_changes()` gate cannot run as written | Critical | Accept | plan.md Constraints, Phase 1 |
| 11 | Phase 5's "navbar brand = hardcoded CMC EDU" requirement describes already-shipped, CI-locked behavior (`admin-shell.ui.spec.ts` asserts the dynamic path); building it risks reverting a correct behavior | Critical | Accept | Phase 5 (delete requirement) |
| 12 | `ViewSwitcher`'s proposed `'list'\|'kanban'` contract matches neither `pipeline.tsx` (`'kanban'\|'table'`) nor `schedule.tsx` (4-value) — spec was wrong, and zero prior demand signal exists for the abstraction | High | Accept | Phase 5 (respecify or decline) |
| 13 | `FormDialog` would duplicate the existing `Dialog purpose="form"` + `DialogHeader` + `ConfirmDialog` primitives already used by all 7 CRM dialogs | High | Accept | Phase 5 (evaluate, likely decline) |
| 14 | `ControlBar` "densify" describes already-shipped, test-locked behavior (`odoo-cp-sheet.test.ts`); the proposed L/C/R restructure is actually a breaking slot-API change (`header/filters/footer` → three bands), not the "CSS-only" change claimed | High | Accept | Phase 5 (soften to value-only re-verify) |
| 15 | Phase 2's per-family CSS retirement can't see multi-family comma-grouped selectors (e.g. one rule listing `.sh-cta, .ck-mc, .sh-item, .ck-toast` together) — a per-family gated commit can ship a half-renamed group undetected | Medium | Accept | Phase 2 |
| 16 | Visual smoke (Phase 4) was ordered before Phase 5 (component changes) and Phase 6 (CSS deletions) — the only pixel-level check would run before the final pixels exist, and Phase 7 would close the rollout plan citing stale evidence | High | Accept | plan.md Phases table (reorder via dependencies), Phase 4/5/6/7 |
| 17 | Phase 4's dev-server path authenticates via the forgeable `x-dev-user` header, not the real `cmc_staff_session` cookie — permission-derived UI (module list, ⌘K contents, buttons) would be verified under a bypass, not the real auth path | Medium | Accept | Phase 4 (rewrite to use real-cookie-auth stack) |
| 18 | "Zero screenshot files in the repo" doesn't address browser-automation tooling writing image artifacts to disk outside the repo (e.g. `.playwright-mcp/`, already gitignored — evidence this has happened before) | Medium | Accept | Phase 4 |
| 19 | `check-ui-frames` cannot enforce "adoption counts unchanged" (those are report-only, not gated) and doesn't track `ControlBar` at all — the plan's stated tripwire for a bad densify can never fire | Medium | Accept | Phase 1, Phase 5 |
| 20 | Phase 7's cross-reference edit list included one doc with no real reference (`docs/06-kien-truc-url-routing.md` — its "Odoo" mentions are an unrelated URL-scheme comparison) and omitted 4 real referrers, one of which is executable code (`apps/e2e/design3-frontend-audit.mjs`) and two of which live inside the still-active dissection plan | High | Accept | Phase 7 |
| 21 | Phase 7's blanket "reframe every Odoo mention" instruction could strip LGPL-3 attribution language from the doc, which has no CI guard (unlike the CSS file, which has `odoo-tokens.test.ts` asserting the license string) | High | Accept | Phase 7 |
| 22 | Effort estimate (3-5w) undershoots the phases' own summed estimates (~5-7w) even before accounting for Finding 2's ~4x scope correction; "89% adoption / 45 pages" figures don't match `check-ui-frames.mjs` output (actual ~78% / 52 non-exempt page files) | Medium | Accept | plan.md frontmatter + Naming Decision, Phase 5 |

**Rejected:** none. One reviewer flagged the `.o_web_client` "keep as-is" rationale as an open question (hadn't independently verified it); a different reviewer's Fact-Checker/Scope-Auditor pass did independently verify it (it's the only literal `.o_*` underscore selector actually used as a selector rather than appearing in a comment) — treated as resolved, not a rejection.

### Whole-Plan Consistency Sweep

- **Files reread:** `plan.md`, `phase-01-start.md`, `phase-02-legacy-class-retirement.md`, `phase-03-fresh-source-grounded-audit.md`, `phase-04-live-browser-visual-smoke.md`, `phase-05-component-library-completion.md`, `phase-06-codebase-cleanup.md`, `phase-07-docs-and-cross-plan-consolidation.md`.
- **Decision deltas checked:** 22 (the table above).
- **Reconciled stale references:** `plan.md` Naming Decision table, Non-Goals, Constraints, Phases table, Success Criteria rewritten in place (this session). Phase 1, 2, 4, 5, 6, 7 rewritten to match (see each phase's own edit for specifics — counts de-committed to "re-verify, don't trust," `apps/e2e` added everywhere, `PLAYWRIGHT_UI=1` fixed everywhere, GitNexus fallback added, Phase 4 seed path replaced, Phase 5's three phantom/already-shipped requirements softened or removed, Phase 6/4 dependency order flipped, Phase 7's cross-reference list corrected, Phase 3 given a pin-reconciliation step).
- **Unresolved contradictions: 0.** Every finding above has a corresponding edit; no finding was accepted without a matching change to the phase file(s) it names.
- ⚠️ **Superseded by the round-2 sweep below — this "0" was wrong.** Round 2 found at least two contradictions surviving inside the files this sweep claims to have reread: `phase-06:92-94` vs `:111-113` (opposite claims about whether Phase 4 runs after Phase 6 — created by *this* session's own reorder) and `phase-01:70` vs `:138` (two different paths for `soft-ops-fullcalendar.css`, only one of which exists). A sweep that self-certifies zero while introducing a contradiction is not evidence; see round 2's sweep for the corrected method.

### Session 2 — 2026-08-07 (round 2, post-round-1 verification pass)

**Why a second round:** round 1 accepted 22 of 22 findings with zero rejections. Round 2 was scoped to independently re-derive round-1's factual corrections and to find defects the round-1 edits *introduced*, rather than rediscovering the original 22.

**Reviewers:** 4 (Security Adversary/Fact Checker, Failure Mode Analyst/Flow Tracer, Assumption Destroyer/Scope Auditor, Scope & Complexity Critic/Contract Verifier) — full tier, each independently reading all 8 plan files and re-measuring against the live tree at `develop`/`26fb984`.

**Findings:** 34 raised, deduplicated to 24 unique root causes, 15 reported (cap). **Severity:** 8 Critical, 7 High. **Rejected on evidence grounds: 0** — every reported finding carried `file:line` citations.

**Round-1 outcome quality:** 6 of the 15 are REGRESSIONS introduced by round-1 edits; 6 more are round-1 corrections that are themselves wrong or imprecise (VERIFIES-FIX-WRONG). Full evidence and the consolidated round-1 fix-verification table: `plans/reports/red-team-260807-1614-cmc-console-rebrand-round2.md`.

| # | Finding | Severity | R1 relation | Disposition | Applied To |
|---|---------|----------|-------------|-------------|------------|
| 1 | LMS/`premium.css` exclusion rationale false — LMS emits zero of its classes; its only emitters are the shared components Phase 2 rewrites, so the fence protects nothing and Phase 2 inverts its own drift-reduction goal | Critical | VERIFIES-FIX-WRONG | Accept | plan.md Naming Decision + Non-Goals + Success Criteria, Phase 2 |
| 2 | "Shipped and CI-green" premise wrong — unmerged, open PR #75, `develop` 18 ahead/0 behind, system committed one day before the plan | Critical | NEW | Accept | plan.md Prerequisites + Success Criteria, Phase 7 |
| 3 | Phase 1 Step 15 mandates a script that reads `.env.prod`, rotates the super-admin password, hardcodes the prod URL, and writes `/admin/students` PNGs to un-gitignored `outputs/` | Critical | REGRESSION | Accept | plan.md Prerequisites + Non-Goals, Phase 1 |
| 4 | Phase 2's retirement rule covers 43 of 315 `ck-*`; Success Criteria demands zero → unsatisfiable | Critical | VERIFIES-FIX-WRONG | Accept | plan.md Naming Decision + Success Criteria, Phase 2 |
| 5 | Local e2e gate cannot run (no DB standup before Phase 4) and clobbers `acceptance-results/journeys.json` | Critical | REGRESSION | Accept | plan.md Prerequisites + Constraints, Phases 1/2/5/6 |
| 6 | Phase 1's discovery grep omits `packages/ui/src/odoo/` itself, `apps/e2e`, and `.ts`; exit check passes vacuously | Critical | VERIFIES-FIX-WRONG | Accept | Phase 1 |
| 7 | Phase 4's "real cookie auth" has the same self-asserted-roles trust model as `x-dev-user` | Critical | VERIFIES-FIX-WRONG | Accept | plan.md Success Criteria, Phase 4 |
| 8 | plan.md Success Criteria demanded zero `sh-*` against its own carve-out; also only 13 of 19 are emitted (6 have no emitter to "repoint") | Critical | REGRESSION | Accept | plan.md Naming Decision + Success Criteria, Phase 2 |
| 9 | `--odoo-*` rename scoped to the CSS file; `odoo-kanban.tsx:66` builds the token name in a template literal and its test asserts the old string → kanban colours break with every gate green | High | NEW | Accept | Phase 1 |
| 10 | `check:ui-frames` is blind to everything this plan changes, cited as a gate 11×; `--json` baseline vacuous (`generatedAt` churns every run) | High | VERIFIES-FIX-WRONG | Accept | plan.md Constraints + Success Criteria, Phases 1/2/5/6 |
| 11 | `apps/e2e/webwright-prod-smoke.mjs` — 12th consumer, missing from all three enumerations, fail-open, reads `.env.prod` | High | VERIFIES-FIX-WRONG | Accept | plan.md Constraints, Phases 1/2/6/7 |
| 12 | Both of Phase 2's new greps broken: Step 0 regenerates `ck-trpc` + 31 phantoms with no filter instruction; Step 0.5 is 86% noise and misses `odoo.css:2481` (pseudo-class) and `:2709` (child combinator) | High | VERIFIES-FIX-WRONG | Accept | Phase 2 |
| 13 | GitNexus escalated to blocking prerequisite: unpinned `npx` against a repo root holding `.env.prod`, contrary to `bootstrap-harness.sh`'s pinned+checksummed convention, to analyse a 1-caller rename | High | REGRESSION | Accept | plan.md Constraints, Phase 1 — **supersedes Validation decision #2** |
| 14 | Phase 4's environment cannot be stood up: no staff user seeded, no serve command exists, script is mode `100644` | High | NEW | Accept | plan.md Prerequisites, Phase 4 |
| 15 | Phases 3 and 5 largely ceremony; `ODOO_PIN.txt` is gitignored so the "two tracked pins" framing is wrong; Phase 3 cannot be zero-diff | High | NEW | Accept | Phases 3, 5 |

**Below the cap (accepted, deprioritised, applied where cheap):** Phase 6's stale Risk-Assessment contradiction (4/4 reviewers); Phase 1's unnecessary manual false-positive filter (a `\b` anchor gives 111 names and zero false positives); Phase 1 as one unbisectable commit; Phase 6's `find -iname '*odoo*'` gate being unsatisfiable while Phase 7 owns `ODOO-COMPONENT-MAP.md`; the `soft-ops-fullcalendar.css` path/unit error.

**User decisions (2026-08-07):** apply all 15 findings and keep the 7-phase structure; merge PR #75 before renaming; verify `premium.css` dead, then delete it.

### Whole-Plan Consistency Sweep (round 2)

**Method change — this is the point.** Round 1's sweep self-certified "Unresolved contradictions: 0" twice while *introducing* the contradictions round 2 found. A sweep that cannot fail is not evidence. This one was run as executable greps over all 8 files after every edit, and it caught eight stale claims created by round 2's own edits, each fixed before this section was written.

- **Files reread:** `plan.md` + all 7 `phase-*.md`.
- **Decision deltas checked:** 18 (15 findings + 3 user decisions).
- **Grep probes run:** `premium.css` still described as out-of-scope/untouched; `check:ui-frames` cited as a gate without qualification; instructions to *execute* `design3-frontend-audit.mjs`; GitNexus "blocking prerequisite" language outside superseded notes; the stale `"Phase 4 already ran"` string; the non-existent `packages/ui/src/components/soft-ops-fullcalendar.css` path; hand-enumerated e2e file counts; phase-effort sum vs frontmatter.
- **Stale references reconciled (8):** plan.md Constraints' rename-sweep gate list (still named `check:ui-frames` as a gate); Validation Log decision #2 and its propagation bullet (still asserted the reversed GitNexus rule); Phase 5 step 7 and Phase 6 step 5 (`check:ui-frames` inside a `&&` gate chain); plan.md Naming Decision and Phase 1 Overview (`"12+ files"` → exactly 12, plus the generating command); plan.md frontmatter effort (`6-9w` → `5-8w provisional`, since the phase estimates sum to ~5.3-7.6w and Phase 2 now re-derives its own).
- **Cross-file deltas propagated:** the `premium.css` reversal touches plan.md (Naming Decision, Non-Goals, Success Criteria), Phase 2 (Overview, Requirements, scope lists, steps, Risk Assessment) and Phase 7 (doc corrections). The PR #75 decision touches plan.md (new Prerequisites, Success Criteria) and Phase 7 (rollout closure now requires both blockers).
- **Structural check:** `ak plan validate` → valid; phase `dependencies` frontmatter still topologically consistent with the 1→2→3→5→6→4→7 execution order.
- **Unresolved contradictions: 0** — and unlike round 1, that claim is reproducible: re-run the grep probes listed above.

**Known remaining soft spot (stated, not hidden):** Phase 2's effort is deliberately unresolved until its Step 0.4 disposition table exists. plan.md's `effort` is marked provisional for that reason rather than carrying a number the phase content does not support.

## Validation Log

### Session — 2026-08-07

**Verification pass:** skipped per guard (a `## Red Team Review` section with
verification evidence already exists above; no `[UNVERIFIED]` tags remained
to resolve).

**Questions asked:** 4 (within this project's configured 3-8 range).

| # | Topic | Question | Decision |
|---|---|---|---|
| 1 | Sequencing | Given Phase 2's real scope (~4x original estimate) and the 6-9w total effort, how to sequence delivery? | **Ship as one continuous effort** — all 7 phases stay in this plan, executed sequentially as written. No split-off. |
| 2 | GitNexus availability | GitNexus isn't indexed in this repo — index now or use the manual fallback? | ~~**Index now, before Phase 1 starts** — upgraded from "attempt, fall back on failure" to a blocking prerequisite: troubleshoot until `npx gitnexus analyze` succeeds.~~ **SUPERSEDED 2026-08-07 by round-2 finding #13 + the user's "apply all 15" decision.** Unpinned `npx` against a repo root holding `.env.prod` contradicts this repo's own pinned+checksummed convention (`scripts/bootstrap-harness.sh:28-60`), and the only symbol renamed has 3 production call sites — there is no call graph to analyse. Manual verification is now the primary path; see Constraints. |
| 3 | Odoo pin commit | Two conflicting pin commits exist (`5568f6e4…` vs `7de220c9…`) — does the user already know which is right? | **Don't know — investigate in Phase 3.** Phase 3's Step 0 (already written) handles this; no change needed beyond confirming it stays as the resolution path. |
| 4 | Visual smoke ownership | Who drives the browser for Phase 4's live check? | **The implementing agent drives it live**, operator reviews the resulting report. |

### Phase Propagation

- Phase 1: Step 0 and Implementation Step 1 upgraded from "attempt GitNexus indexing, fall back silently on failure" to "index as a blocking prerequisite, troubleshoot until it works, only fall back if genuinely impossible." plan.md Constraints updated to match. — **REVERSED by round 2 (finding #13); see the superseded note in the table above.**
- Phase 4: added an explicit "Validation decision" note confirming agent-driven live browser automation, operator-reviewed report.
- Phases 3, 5, 6, 7, and the overall Phases table: unchanged by this validation round — sequencing and pin-investigation decisions confirmed the plan's existing structure rather than requiring edits.

### Whole-Plan Consistency Sweep

- **Files reread:** `plan.md` and all 7 `phase-*.md` files.
- **Decision deltas checked:** 4 (the table above).
- **Reconciled stale references:** GitNexus language in plan.md Constraints and Phase 1 (Requirements + Implementation Steps) updated together so neither contradicts the other on "blocking prerequisite" vs "best-effort attempt." — **This decision was itself reversed by round 2 (finding #13); the current rule is in Constraints.**
- **Unresolved contradictions: 0.** ⚠️ **Also wrong — see the round-2 sweep below.** This pass reread all 8 files and still missed the Phase 6 and Phase 1 contradictions round 2 found.

**Verification Results (carried forward from Red Team Review, per the skip guard):** Claims checked: 90+ across 4 reviewers. Failed: 22 unique root causes, all Accepted and fixed (see `## Red Team Review`). No outstanding `Failed` claims remain unaddressed.

**Recommendation:** eligible for implementation. Every red-team Critical/High finding has a corresponding fix in the phase files; all 4 validation decisions are propagated; no unresolved contradictions. — ⚠️ **This recommendation was premature; see Session 2.** Round 2 found 8 Critical and 7 High defects in the very files this session certified, six of them created by round 1's own edits.

### Session 2 — 2026-08-07 (post round-2 red team)

**Verification pass:** skipped per the guard — a `## Red Team Review` Session 2 with heavy verification evidence exists above (4 reviewers, ~90 claims re-derived against the live tree). Zero `[UNVERIFIED]` tags remain.

**Questions asked:** 4 (within this project's configured 3-8 range). All four were decision points round 2 surfaced but could not settle without the owner.

| # | Topic | Question | Decision |
|---|---|---|---|
| 1 | `ck-*` disposition | 272 of 315 `ck-*` have no `.console-*` counterpart — what is the policy? | **Delete-first.** Delete `premium.css`, re-measure live emitters, delete every emitter-less `ck-*` rule outright, rename only what is genuinely emitted, fold the 43 with a real peer. Do not rename dead CSS into the new namespace. |
| 2 | Phase 4 auth | Real login flow, or injected cookie with a rendering-only claim? | **Real `POST /auth/staff-login` flow** against a seeded staff user. `mintStaffCookie` is not acceptable; any unavoidable fallback must be named and its claim downgraded. |
| 3 | Prod e2e scripts | Harden `design3-frontend-audit.mjs` / `webwright-prod-smoke.mjs`, or leave them renamed-but-unrunnable? | **Rename selectors only; mark do-not-execute; file "harden prod e2e scripts" as separate work** with its own threat-model review. Neither is CI-wired, so nothing breaks meanwhile. |
| 4 | Phase 3 scope | Full seven-surface audit, or time-box? | **Time-box:** pin reconciliation done properly, then spot-check only the surfaces Phases 1-2 touched. Untouched surfaces listed as out-of-pass with their covering value-lock test named. |

**Earlier decision reversed:** Validation decision #2 (GitNexus as a blocking prerequisite) is superseded — see the strikethrough in the Session 1 table and the current rule in Constraints.

### Phase Propagation (Session 2)

- **Phase 2:** Step 0.4 rewritten around the delete-first policy (3-step ordering, re-measure after `premium.css` removal); Implementation step 5 matched. Also carries the round-2 scope reversal — `premium.css` deletion is now this phase's step 2.
- **Phase 3:** time-box decision written into Architecture; Success Criterion narrowed from "every authority surface" to "every surface touched by Phases 1-2," with out-of-pass surfaces named alongside their automated value locks.
- **Phase 4:** real-login requirement replaces the (a)/(b) choice; Success Criterion updated to match.
- **plan.md Non-Goals:** "harden prod e2e scripts" recorded as an explicit deferred work item with the specific hazards enumerated, so it is a tracked gap rather than a silent one.
- **Phases 1, 5, 6, 7:** unchanged by this round beyond the round-2 red-team edits already applied.

### Whole-Plan Consistency Sweep (Session 2)

- **Files reread:** `plan.md` + all 7 `phase-*.md`.
- **Decision deltas checked:** 4 (plus the 1 reversal).
- **Reconciled stale references:** Phase 2's Step 0.4/step 5 pair (policy stated in two places, both updated together); Phase 3's Architecture note and Success Criterion (time-box stated in both); Phase 4's Requirements and Success Criteria (auth decision in both).
- **Structural check:** `ak plan validate` → valid.
- **Unresolved contradictions: 0** — reproducible via the grep probes listed in the round-2 red-team sweep above.

**Recommendation:** eligible for implementation **once plan.md's four Prerequisites are done**, PR #75 first. Phase 2's effort remains provisional by design until its Step 0.4 table exists.

## Open Questions

None blocking, but three items are explicitly deferred rather than silently dropped:

1. **`leaderboard.tsx` FilterBar** — blocked on a backend ranked-aggregate endpoint that doesn't exist (Phase 5).
2. **`refund.tsx` FilterBar** — blocked on a receipt-search/pick + approval UX spec that doesn't exist (Phase 5).
3. **"Harden prod e2e scripts"** — `design3-frontend-audit.mjs` and `webwright-prod-smoke.mjs` stay renamed-but-unrunnable; the real fix (base URL, credential source, password-rotation branch, artifact paths) is separate work needing its own threat-model review (Non-Goals, validation decision #3).

**Provisional, by design:** Phase 2's effort estimate, pending its Step 0.4 disposition table. plan.md's `effort` is marked provisional rather than carrying a number the phase content cannot support.

<!-- slug: cmc-console-design-system-rebrand-hardening -->

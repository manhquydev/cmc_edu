---
phase: 1
title: "Phase 1: Rebrand — Tokens, Symbols, Files & Docs"
status: completed
priority: P1
effort: "1.5-2w"
dependencies: []
---

# Phase 1: Rebrand — Tokens, Symbols, Files & Docs

<!-- Updated: Red Team Session 2026-08-07 — see plan.md "## Red Team Review" for full rationale -->

## Overview

Rename every piece of admin's design system that is **our own branding** from
"Odoo" naming to "CMC Console" naming. Do not touch `.o_web_client` (the one
genuine literal Odoo DOM-mirror class — see plan.md Naming Decision table).
Do not touch `KanbanBoard`/`KanbanColumn`/`KanbanCard` (generic naming, not
Odoo-specific — only their file location moves).

**Red-team correction:** the original discovery method (`grep -rc '\.o-[a-z]'`)
only matches CSS-file selector strings, never JSX `className="o-main"` usages
— it is structurally blind to the majority of what needs renaming. This
rewrite replaces "grep a prefix pattern and expect zero" with "enumerate the
exact class list once, then grep for each exact name." It also adds four file
categories the original phase missed entirely: `packages/ui/package.json`
(the CSS export map), `apps/admin/src/main.tsx` (the import consuming it),
`packages/ui/src/components/**/*.tsx` (14+ files emitting `.o-*` classes,
previously undiscovered because discovery was scoped to `apps/admin/src`
only), and `apps/e2e/**` (**12** files hardcoding the exact selectors being
renamed, including two shared journey helpers and two prod-targeted scripts).
**Round-2 further corrected the discovery scope** — round 1's own emitter grep
still omitted `packages/ui/src/odoo/` (the directory being renamed), `apps/e2e`,
and `.ts` files, and its e2e list named 11 of the 12. See Steps 0.5/0.6.

## Requirements

- [ ] **Step 0 (rewritten by round-2 finding #13 — this REVERSES validation
      decision #2, per the user's 2026-08-07 "apply all 15" decision):
      manual verification is the primary path; GitNexus is optional and, if
      used at all, must be pinned.** Do **not** run unpinned
      `npx gitnexus analyze` here: `gitnexus` is in no `package.json`, no
      workflow, and no lockfile, so `npx` resolves whatever is published that
      day and runs it with read access to a repo root containing `.env.prod`
      and `.env.local-sim-accounts`. This repo's own convention for executing a
      third-party CLI is the opposite — `scripts/bootstrap-harness.sh:28-60`
      installs from a pinned release tag and verifies a SHA-256 checksum first.
      Making an unpinned `npx` *blocking*, with "troubleshoot until it works"
      as the instruction, raised supply-chain exposure with no threat-model
      note. It also buys nothing here: the only symbols renamed are
      `OdooNavbar`/`OdooNavbarProps`, whose complete production consumer set is
      **three sites** — `packages/ui/src/index.ts:173-174` (barrel),
      `apps/admin/src/shell/shell.tsx:5` (import), `:129` (JSX). Everything
      else `grep -rn 'OdooNavbar'` returns is the definition, its own colocated
      test, a prose string, and a comment. There is no call graph to analyse.
      **Do this instead:** `grep -rn 'OdooNavbar' packages apps` → edit the
      three sites → `tsc --noEmit` → before/after count diff. If GitNexus is
      wanted anyway, pin it (`npx gitnexus@<version>`) and record version +
      integrity hash in this phase's notes.
- [ ] **Step 0.1 (new — Prerequisites gate): confirm plan.md's four
      Prerequisites are done before editing anything** — PR #75 merged,
      `outputs/` gitignored, throwaway synthetic DB up (needed by step 14's e2e
      gate, which cannot run without it), GitNexus decision recorded.
- [ ] **Step 0.5 (rewritten by round-2 finding #6): build the exact rename map
      before touching anything — with the CORRECT scope and a word-anchored
      pattern.** Round 1's version was wrong twice over: its emitter grep
      scoped to `packages/ui/src/components apps/admin/src --include=*.tsx`,
      which **omits `packages/ui/src/odoo/` — the very directory being
      renamed** (8 files there emit `o-brand`, `o-systray`, `o-menu-item`,
      `o-menu-sections`, `o-app-switcher-{menu,tile,toggle}`,
      `o-kanban-col-{header,body,count}`, `o-kanban-card-{title,sub,footer}`),
      omits `apps/e2e/**`, and excludes `.ts` files (5 of the 7 test files
      hardcode `.o-*`/`--odoo-*` in assertions). It also used an unanchored
      `o-[a-z]` pattern and then bolted on a mandatory manual-filtering step to
      clean up the resulting `no-`/`to-`/`go-` noise — the actual fix is one
      character.
      **Selectors:** `grep -oE '\.o-[a-z][a-z0-9-]*' packages/ui/src/odoo.css | sort -u`
      **Emitters (word-anchored, full scope):**
      `grep -rohE '\bo-[a-z][a-z0-9-]*' packages/ui/src apps/admin/src apps/e2e --include=*.ts --include=*.tsx --include=*.mjs --include=*.css | sort -u`
      This yields **111 distinct names with zero false positives** — no manual
      `no-`/`to-`/`go-` filtering needed. Union the two lists into one canonical
      rename map (old → new, suffix preserved).
      **Two real dynamic-construction sites need explicit handling** (these,
      not imaginary substring noise, are what a naive sweep breaks):
      `packages/ui/src/components/filter-bar.tsx:97` builds ``id={`o-filter-${f.key}`}``
      — that is an **HTML id, not a class**, so a class-only map misses it; and
      the `o-dash-*` template prefixes in the dashboard/shortcut components.
- [ ] **Step 0.6 (new — round-2 finding #9): build a TOKEN map too, not just a
      class map.** The `--odoo-*` rename was scoped to the CSS file only, but
      token names are constructed in TSX. `packages/ui/src/odoo/odoo-kanban.tsx:66`
      writes ``'--odoo-kanban-card-color': `var(--odoo-kanban-color-${colorIndex})` ``
      (also `:4`, `:46`), and `odoo-kanban.test.tsx:32-33` asserts the **old**
      string on the element's inline style. Rename the CSS alone and every
      kanban card's colour accent resolves to nothing while `typecheck` passes
      (string literals), `pnpm test` passes (emitter and test agree with each
      other and disagree with the CSS), e2e passes (asserts DOM/text), and
      `build` passes — a defect that would surface only in Phase 4, five phases
      later. Run `git grep -n -- '--odoo-'` across **all tracked files** and
      apply the token rename atomically across every consumer.
      Census to expect: `odoo.css` 169, `odoo-tokens.test.ts` 8,
      `odoo-kanban.tsx` 3, `odoo-kanban.test.tsx` 2, `docs/design-system-odoo.md` 23.
- [ ] All `--odoo-*` CSS custom properties renamed to `--console-*` (same
      suffix, same values) in `packages/ui/src/odoo.css` (→ `console.css`).
- [ ] Every class in the Step 0.5 canonical map renamed from `.o-*` to
      `.console-*` (same suffix) — in `console.css`, every consuming
      `packages/ui/src/components/*.tsx` file, every consuming
      `apps/admin/src/**` file, AND every consuming `apps/e2e/**` file
      (test specs and the two shared journey helpers below).
- [ ] `apps/admin/src/components/soft-ops-fullcalendar.css` is included in the
      sweep — **12 unique `.o-fc*` selectors / 33 occurrences**. (Round-2
      correction: this bullet previously said `packages/ui/src/components/…`,
      a path that does not exist — the file lives under `apps/admin`, as the
      Related Code Files section below already had right. "24 selectors" was a
      *line* count, not a selector count. Two different paths for one file in
      one phase file is one of the contradictions round-1's sweep certified as
      zero.)
- [ ] `OdooNavbar` → `ConsoleNavbar`, `OdooNavbarProps` → `ConsoleNavbarProps`
      renamed (see Step 0 for tool vs. fallback). Also grep for the string
      `"OdooNavbar"` inside test *description* text (e.g.
      `apps/admin/src/shell/shell.test.tsx`) — a symbol-rename tool won't
      touch prose strings inside `it(...)` calls; update these by hand.
- [ ] Directory `packages/ui/src/odoo/` → `packages/ui/src/console/`.
- [ ] Files renamed (git mv, preserve history): `packages/ui/src/odoo.css`
      (note: this file is a **sibling** of the `odoo/` directory, not inside
      it) → `packages/ui/src/console.css`; `odoo-navbar.tsx`→`console-navbar.tsx`;
      `odoo-kanban.tsx`→`console-kanban.tsx`; and the **7** test files inside
      the directory (`odoo-navbar.test.tsx`, `odoo-kanban.test.tsx`,
      `odoo-astryx-remap.test.ts`, `odoo-cp-sheet.test.ts`,
      `odoo-shell-stacking.test.ts`, `odoo-tokens.test.ts`,
      `odoo-float-layer.test.ts`) → matching `console-*` names. (The directory
      holds 9 files total, 7 of them tests — corrected from an earlier
      miscount of "10 files / 8 tests.")
- [ ] `packages/ui/package.json`'s `exports` map (`"./odoo.css"` entry) and
      `files` allowlist updated to `"./console.css"` / `"src/console.css"`.
- [ ] `apps/admin/src/main.tsx`'s `import '@cmc/ui/odoo.css'` updated to
      `import '@cmc/ui/console.css'`.
- [ ] The 7 renamed test files' `readFileSync(resolve(process.cwd(), 'src/odoo.css'))`
      calls updated to `'src/console.css'`.
- [ ] `packages/ui/src/index.ts` barrel export paths updated to the new file
      locations.
- [ ] **All `apps/e2e` consumers updated — GENERATE the list, never hand-write
      it** (round-2 finding #11, raised independently by all four reviewers).
      Round 1 claimed "12+ files" and then enumerated **11**; the actual count
      is 12. Use:
      `grep -rlE "['\"\`.]o-[a-z]" apps/e2e --include=*.ts --include=*.mjs`
      Expect the two shared journey helpers (`src/journey/menu-nav.ts`,
      `src/design3/open-seeded-detail.ts` — many specs import these),
      `tests/admin-shell.ui.spec.ts`, `tests/design3-statusbar.ui.spec.ts`, the
      six journey specs asserting `main.o-main`, `design3-frontend-audit.mjs`,
      **and `webwright-prod-smoke.mjs`** — the one round 1 missed three times
      (`:173` `.o-brand`, `:219` `main.o-main`, `:223` `.o-kanban-board,
      .o-list`, `:96` `o_web_client`). It is also the highest-consequence
      member: it reads `.env.prod` (`:24-40`), drives the prod stack, and
      derives pass/fail from Playwright `.count()`, which returns 0 rather than
      throwing — so after the rename it reports "smoke clean" against
      production while checking nothing. Phase 6's `find -iname '*odoo*'` will
      not catch it (no "odoo" in the filename).
- [ ] **DO NOT run `apps/e2e/design3-frontend-audit.mjs` as part of this phase.**
      **Round-2 finding #3 (Critical) — this requirement is deleted, not
      softened.** Round 1 removed `seed-local-sim-demo.ts` from Phase 4 because
      it reads `.env.prod` and rotates the super-admin password, then in the
      same pass made running this script *mandatory here*, in the first phase,
      with the identical hazard profile plus screenshot persistence:
      `:2` "live page walk on cmcv2-prod"; `:35-51` reads `.env.prod`;
      `:640-643` requires super-admin credentials; `:120` hardcodes
      `https://localhost/admin/login` with **no configurable base URL** (so
      "against a locally running admin build" was never executable as written);
      `:149-169` **rotates the super-admin password** as a side effect;
      `:24-27`/`:292`/`:421`/`:663` write full-page PNGs to
      `outputs/design3-frontend-audit/screenshots/`; `:63-76` routes include
      `/admin/students`. `outputs/` is not gitignored. Running it would violate
      Phase 4's own no-persisted-screenshots policy three phases early, desync
      the operator's super-admin credential from `.env.prod`, and risk
      committing authenticated screenshots of student records.
      **Update its selectors statically (it is in the generated list above);
      do not execute it.** If someone later wants it runnable, that is separate
      work: parameterize the base URL, take credentials from the throwaway env,
      and strip the rotation branch — with the same threat-model treatment
      Phase 4 got.
- [ ] `FilterBar` symbol name **untouched** (locked by `check-ui-frames.mjs`).
- [ ] `.o_web_client` string **untouched** anywhere in code/CSS.
- [ ] **`check-ui-frames` is not evidence for this phase — round-2 finding #10
      deletes round-1's baseline-diff claim.** Round 1 asserted a
      `--json` before/after diff was "the only way to actually verify adoption
      counts didn't move." It verifies nothing: `scripts/check-ui-frames.mjs:13`
      walks only `apps/admin/src/pages`, `:33-45` counts 11 React *symbol*
      names, `:174-185` fails on exactly two conditions, `:186` exits 0
      otherwise — zero references to `o-`, `--odoo-`, `ck-`, `sh-`, `tpl-`, and
      it never reads a `.css` file or anything under `packages/ui`. Nothing in
      this phase touches those symbols, so the diff is empty by construction —
      while its first field, `generatedAt`, is a fresh ISO timestamp, making
      the raw diff simultaneously always non-empty and never meaningful. Run it
      as a regression-of-record; if you do diff the JSON, strip the timestamp
      (`| jq 'del(.generatedAt)'`). **Do not record green here as proof the
      rename worked** — the real proof is step 11's residual scan plus
      `pnpm test`, `pnpm --filter @cmc/admin build`, and the e2e run.

## Architecture

No structural/behavioral change — this is a pure identifier rename across CSS
custom properties, CSS classes, one exported component pair, file paths, and
import statements. Visual output must be pixel-identical before/after (values
don't change, only names).

## Related Code Files

**Rename (git mv):**
- `packages/ui/src/odoo/` → `packages/ui/src/console/` (directory, 9 files)
- `packages/ui/src/odoo.css` → `packages/ui/src/console.css` (sibling file, not inside the directory)

**Modify:**
- `packages/ui/package.json` (`exports`, `files`)
- `apps/admin/src/main.tsx` (CSS import specifier)
- `packages/ui/src/console.css` (née `odoo.css`) — token + class renames (largest diff in this phase)
- `packages/ui/src/index.ts` — updated import/export paths
- The 7 renamed test files (their internal `readFileSync('src/odoo.css')` paths)
- `apps/admin/src/shell/shell.tsx` — `OdooNavbar` → `ConsoleNavbar` import/usage
- `apps/admin/src/shell/shell.test.tsx` — test description string literal
- `apps/admin/src/components/soft-ops-fullcalendar.css` — 24 `.o-fc*` selectors
- Every `packages/ui/src/components/*.tsx` file the Step 0.5 canonical map surfaces (discovery, not a pre-guessed list — but expect the shared templates: `list-page.tsx`, `detail-page.tsx`, `form-page.tsx`, `dashboard-page.tsx`, `control-bar.tsx`, `page-header.tsx`, `entity-header.tsx`, `settings-shell.tsx`, `progress-steps.tsx`, `metric-card.tsx`, `data-table.tsx`, `date-field.tsx`, `filter-bar.tsx`, `shortcut-chip.tsx`)
- Every `apps/admin/src/**/*.tsx` file the Step 0.5 canonical map surfaces
- `packages/ui/src/console/*.tsx` (née `odoo/`) — **the renamed directory is
  itself a major emitter** (`console-navbar.tsx`: `o-brand`, `o-systray`,
  `o-menu-item`, `o-menu-sections`, `o-app-switcher-*`; `console-kanban.tsx`:
  `o-kanban-*`), plus 5 of the 7 `.ts` test files hardcoding `.o-*`/`--odoo-*`
  in assertions. Round-1's discovery grep omitted this directory entirely.
- Every file returned by
  `grep -rlE "['\"\`.]o-[a-z]" apps/e2e --include=*.ts --include=*.mjs`
  (12 files) — including `apps/e2e/design3-frontend-audit.mjs` and
  `apps/e2e/webwright-prod-smoke.mjs`. **Edit both; execute neither.**

**Do NOT modify:**
- `.o_web_client` selector string anywhere
- `FilterBar` symbol (any file)
- `KanbanBoard`/`KanbanColumn`/`KanbanCard` symbol names (files move, names don't)
- `packages/ui/src/premium.css` and anything under `apps/lms` (LMS exclusion)
- Doc content rewrite (Phase 1 only does the `git mv` + title of `docs/design-system-odoo.md`; full cross-reference sweep is Phase 7)

## Implementation Steps

**Commit strategy (round-2, below-cap finding): four gated commits, not one.**
Round 1 mandated applying everything atomically "so there's never a moment
where CSS defines the new name but a consumer still emits the old one" — correct
for consistency, catastrophic for recoverability. The result was a single commit
spanning ~700 substitutions, 10 `git mv`s, 12 e2e files, the export map, and a
symbol rename, with every gate (steps 12-16) running only after all of it.
`git bisect` would have one commit to offer. Phase 2 already commits per-family
for exactly this reason; apply the same logic here. Each commit below gets a
green `pnpm --filter @cmc/admin build` before the next starts:
**(1a)** file moves only, zero name changes — `git mv` + `package.json`
exports/files + `main.tsx` import + `index.ts` paths + the 7 tests'
`readFileSync` paths. **(1b)** token sweep (`--odoo-*` → `--console-*`) across
*all* consumers from the Step 0.6 map, including `odoo-kanban.tsx` and its test.
**(1c)** class map applied atomically (one pass per class, all trees at once).
**(1d)** the `OdooNavbar` symbol rename.

1. Confirm Prerequisites (Step 0.1). Enumerate the symbol's three production
   call sites with `grep -rn 'OdooNavbar' packages apps` and record them. Do
   not run unpinned `npx gitnexus analyze` (Step 0); if a pinned GitNexus is
   used, record version + hash and run
   `impact({target: "OdooNavbar", direction: "upstream"})`, stopping if
   HIGH/CRITICAL.
2. Build the canonical **class** map per Step 0.5 (word-anchored, full scope
   including `packages/ui/src/odoo/`, `apps/e2e`, `.ts`/`.mjs`/`.css`) and the
   canonical **token** map per Step 0.6. Save both somewhere reviewable so
   later phases can see exactly what was renamed to what. Note the two dynamic
   sites (`filter-bar.tsx:97` HTML id, `o-dash-*` prefixes) explicitly.
3. **[commit 1a]** `git mv packages/ui/src/odoo packages/ui/src/console`, then
   `git mv` each file inside to its `console-*` name; separately
   `git mv packages/ui/src/odoo.css packages/ui/src/console.css`.
4. Update `packages/ui/package.json` `exports`/`files`,
   `apps/admin/src/main.tsx`'s import, `packages/ui/src/index.ts` paths, and
   the 7 renamed test files' `readFileSync('src/odoo.css')` strings. Gate:
   `pnpm --filter @cmc/admin build`.
5. **[commit 1b]** Token rename across every consumer in the Step 0.6 map —
   `console.css` **and** `console-kanban.tsx`'s template literal **and**
   `console-kanban.test.tsx`'s asserted string **and** `console-tokens.test.ts`.
   Renaming the CSS alone silently breaks kanban colours with all gates green
   (finding #9). Gate: `pnpm test && pnpm --filter @cmc/admin build`.
6. **[commit 1c]** Class rename sweep using the step-2 map — apply atomically
   across `console.css`, `packages/ui/src/console/*.tsx`,
   `packages/ui/src/components/*.tsx`, `apps/admin/src/**`,
   `apps/admin/src/components/soft-ops-fullcalendar.css`, and every file the
   generated `apps/e2e` list returned, one pass per class (not one pass per
   file), so CSS and consumers never disagree.
7. **[commit 1d]** Rename `OdooNavbar`/`OdooNavbarProps` across the three
   production sites; fix the `shell.test.tsx` description string by hand
   (a symbol tool will not touch prose inside `it(...)`).
8. `git mv docs/design-system-odoo.md docs/design-system-console.md`; update
   just its own `# ` title (full cross-reference sweep is Phase 7).
9. **Residual scan, not a per-map-entry check** (round-2 finding #6 — the old
   step 11 only re-checked names already in the map, so it passed vacuously
   against anything the map missed). Run a repo-wide sweep for survivors:
   `grep -rnE '\bo-[a-z]|--odoo-|\bOdooNavbar' packages/ui/src apps/admin/src apps/e2e | grep -v console-`
   Expect zero hits other than the deliberately preserved `.o_web_client`.
10. `pnpm typecheck && pnpm test && pnpm check:ui-a11y-roles`. Run
    `pnpm check:ui-frames` too, but see Requirements — it cannot detect
    anything this phase breaks, so green is not evidence.
11. `pnpm --filter @cmc/admin build` — catches broken CSS import resolution
    that `typecheck` cannot see. This is a real gate.
12. `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`
    against the Prerequisites step-3 throwaway DB (it hard-fails without
    `APP_DATABASE_URL`/`DATABASE_URL`). **Back up
    `apps/e2e/acceptance-results/journeys.json` first** — the run overwrites
    it with dirty-tree local results, and that file feeds the acceptance
    ledger (finding #5).
13. **Do not run `design3-frontend-audit.mjs`** (see Requirements — deleted by
    finding #3). Its selectors are updated statically as part of commit 1c.
14. Optional: `detect_changes()` if a pinned GitNexus was used; otherwise
    review `git diff --stat` per commit against the expected file list above.

## Success Criteria

- [ ] plan.md's four Prerequisites confirmed done (Step 0.1) — PR #75 merged,
      `outputs/` gitignored, throwaway DB up, GitNexus decision recorded.
- [ ] Step 0.5 (class map, word-anchored, full scope) and Step 0.6 (token map,
      all tracked files) both completed and recorded before any edit.
- [ ] Four gated commits (1a-1d), each with a green
      `pnpm --filter @cmc/admin build` — not one atomic commit.
- [ ] **Repo-wide residual scan** (step 9) returns zero survivors, not just
      "every name in the map is zero" — the map itself can be incomplete.
- [ ] `.o_web_client` string count unchanged from before this phase.
- [ ] `FilterBar` symbol untouched.
- [ ] Real gates green: `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @cmc/admin build`, local `PLAYWRIGHT_UI=1 ui-chromium`
      e2e. (`check:ui-frames`/`check:ui-a11y-roles` run for the record only —
      `check-ui-frames` is blind to this phase's changes.)
- [ ] `design3-frontend-audit.mjs` selectors updated **statically**; the script
      was NOT executed (finding #3).
- [ ] `webwright-prod-smoke.mjs` selectors updated (it was missing from all
      three round-1 enumerations) — likewise not executed.
- [ ] `acceptance-results/journeys.json` restored/untouched after local e2e
      runs, so the acceptance ledger still reflects CI.

## Risk Assessment

- **The single biggest risk in the original version of this phase was its own
  discovery method** (dotted-only grep pattern, missing `apps/e2e` and
  `packages/ui/src/components` entirely) — fixed by Step 0.5's exact-map
  approach and the expanded file list above. If a future editor is tempted to
  "simplify" back to a prefix-pattern grep, don't — it's what caused the
  original gap.
- **`no-`/`to-`/`go-` false positives**: the emitter-side discovery grep
  (`o-[a-z]` without a dot) will catch substrings like `no-e`, `to-r` — Step
  0.5 explicitly requires manual filtering, not blind acceptance of grep output.
- **GitNexus may not be available**: don't let a missing tool silently become
  a skipped safety check — Step 0 requires stating which path was used.
- **CSS subpath export breakage is invisible to `typecheck`**: only a real
  build (step 13) catches it — this is why it's a required gate, not optional.


## Completion Notes

**Completed:** 2026-08-07 on branch `feature/cmc-console-design-system-rebrand` off `main@240bec1`.

**Prerequisites:**
- PR #75 merged (`240bec1`)
- `outputs/` gitignored (commit `2c20043`)
- Synthetic DB stood up via `SYNTH_SEED_ALLOW=1 bash scripts/synthetic-seed-env.sh --fresh`
- GitNexus: SKIP — manual verification path (3 OdooNavbar call sites)

**Commits:**
- `2c20043` chore: gitignore outputs/
- `f327b85` 1a path moves (odoo → console)
- `a54b4c9` 1b `--odoo-*` → `--console-*` tokens
- `780a8ee` 1c `.o-*` → `.console-*` classes (59 files, incl. 12 e2e)
- `ab54928` 1d OdooNavbar → ConsoleNavbar + design-system doc rename
- prose commit for e2e test titles

**Maps:** `notes/phase-01-class-map.txt`, `notes/phase-01-token-map.txt`, `notes/phase-01-dynamic-sites.txt`, `notes/prerequisites.md`

**Gates (local):**
- `pnpm typecheck` — 29/29 tasks green
- `pnpm test` — all packages green (ui 142, api 2144, …)
- `pnpm --filter @cmc/admin build` — green after each of 1a–1d
- Residual scan: zero `o-*` / `--odoo-` / `OdooNavbar` in packages/ui, apps/admin, apps/e2e (except preserved `o_web_client`)
- `FilterBar` symbol untouched
- Critical e2e: admin-shell + design3-statusbar ui-chromium **3/3 passed**
- Full ui-chromium suite: **54/54 passed** (~6.4m) against synth DB; journeys.json restored from bak-phase1
- `journeys.json` backed up to `journeys.json.bak-phase1` before local e2e
- `design3-frontend-audit.mjs` / `webwright-prod-smoke.mjs`: selectors updated, **not executed**

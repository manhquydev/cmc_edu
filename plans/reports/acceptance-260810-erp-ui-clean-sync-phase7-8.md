# Acceptance report — Phase 7-8, `260809-2040-erp-ui-clean-sync-complete`

Branch: `feat/erp-ui-clean-sync-cook-b` (worktree, unpushed). Covers Phase 5-8 (Phase 1-4 already
reported in prior commits/plan.md). All 8 phases now implemented and verified locally.

## Phase 5 — off-scale value sweep

- 18 off-scale font-size declarations in `console.css` (`12.5px`×11, `13.5px`×7 — down from the
  original 20/8 after Phase 2's dead-CSS deletion; `24.5px` had already dropped to 0).
- Odoo-faithfulness test run (grep literal + the one known factor `$o-label-font-size-factor:0.8`
  + confirmed every Odoo base size is an integer): no grounding found → genuine drift, not a
  faithful fractional value.
- Snapped to the nearest real step already declared in `console.css`'s own scale: `12.5px→12px`
  (`--font-size-xs`), `13.5px→13px` (`--font-size-sm`), written as literals to match the file's
  existing convention (not `var()`).
- Retracted the phase's own "step 0" premise ("no type-scale token exists") — both the Console
  zone (`console.css:373-384`) and Premium zone (`tokens.css:98-105`) already had complete,
  real token scales predating this phase.
- Verified: 43 files / 149 tests green (`@cmc/ui`); live sweep on 4 routes showed 0 off-scale.

## Phase 6a — inline-style ratchet (6b stylelint deferred)

- New `scripts/ui-ratchet.mjs` + `.test.mjs`: counts raw literals in `style={{ }}` for
  spacing/fontSize/radius/color, brace-depth parsed (not line regex). Caught and fixed a real
  off-by-one bug in its own brace-slicing before seeding the baseline.
- Baseline seeded from post-Phase-5 state: 41 files, 178 violations across 58 admin pages.
- Verified: clean run = 0 false positives; injected a real violation into a real page file →
  ratchet failed on the exact file/delta; restored → clean again. Wired into
  `.github/workflows/ci.yml`'s `typecheck-and-test` job.
- 6b (stylelint allow-list for `console.css`) deferred: stylelint isn't installed anywhere in the
  repo — a genuine toolchain gap, per the phase's own documented fallback ("do 6a first, defer
  6b"). Does not block Phase 7/8.

## Phase 7 — vertical module slices

- Shared prerequisite files fixed first: `student-picker.tsx` (3 exact-match token substitutions),
  `enroll-picker.tsx` (0 — its literals have no matching token).
- 5 module slices run as parallel background agents with disjoint file sets (teaching → CRM →
  finance → hr/admin → rest), each given the exact token-mapping table and the exemption rules
  from `ui-ratchet.mjs`, with an explicit "only exact-value matches, never invent/snap" rule.
- Result: 178 → 25 violations (86% reduction), 0 files regressed. 6 commits (2 shared files +
  5 slices).
- Verification (done centrally, not trusted from subagent self-report): read the 2 largest diffs
  in full; `git diff` across the whole batch showed 149 insertions / 149 deletions (perfectly
  symmetric) and 0 changed lines outside style-related keywords; `pnpm turbo run typecheck test
  --filter=@cmc/admin` green (560/560); `pnpm lint` clean.
- `detect_changes` reported `risk_level: critical` (44 functions / 51 execution flows "touched").
  Verified via the diff-symmetry check above that this is a breadth signal, not a behavior-risk
  one — flagged to the operator per the project's mandatory warn-on-critical rule.
- Component coverage (`CountBadge`/`MetaRow`/`Avatar` replacing hand-rolled markup) intentionally
  NOT attempted — needs visual verification this pass doesn't have (no seeded dev DB for
  screenshots). Deferred to a future pass, not silently dropped.

## Phase 8 — close-out

- **Component removal, evidence-based:** grepped real usage (not scout candidate lists) for all
  5 previously-flagged components. `InsightMetric`/`FocusCard`: 0 consumers AND 0 candidate sites
  (the one `FocusCard` grep hit was a code comment about a historical CSS-class-name collision
  with FullCalendar, not usage) → deleted, `impact()` confirmed 0 upstream dependents before
  deletion. `CountBadge`/`MetaRow`/`Avatar`: 0 consumers but real candidate sites exist (28/34/2
  files, documented by the original scout, never attempted in Phase 7) → kept; deleting them would
  destroy legitimate future-use components without the evidence this phase's own criteria require.
- **Baseline → 0, honestly:** the 25 remaining Phase-7 violations have no matching token. Forcing
  the count to 0 by inventing/expanding tokens would be a design decision outside this phase's
  authorization (the plan has repeatedly declined to expand the spacing scale). Instead, added
  `scripts/ratchet-exemptions.json` — each violation listed individually by
  `(file, property, exact value)` with a stated reason, checked structurally by the ratchet
  script and subtracted before counting. Baseline is now genuinely `{}` for every file, so the
  existing "fail if a file's count goes up" comparison is now zero-tolerance for anything not on
  that explicit, auditable list.
- **Final live sweep:** rebuilt dev servers in this worktree (API :3030, admin :5175) against the
  shared dev Postgres (empty except 1 `Facility` row — no additional seeding, consistent with the
  DB-emptiness constraint noted throughout Phase 5-8). Swept 30 representative routes spanning all
  5 modules: 4 `ComingSoon`, 1 tool-scope error (`/login` has no `<main>`), 26 measured for real.
  Result: **0 off-scale font-size on any CMC-owned route**; the single off-scale hit across the
  entire sweep (`24.5px` on `/teaching/schedule`) is `h2.fc-toolbar-title` — FullCalendar's own
  third-party element, exactly the exception the plan pre-declared and had never been able to
  confirm with evidence until now. Radius across all routes matches the two chosen scales
  (Console 3/4/6, Premium 12/16/20/9999) plus FullCalendar's own third-party values on that one
  route.
- Incident during this phase: the shared `cmc_app` Postgres role's password was changed by another
  concurrent session mid-verification (a previously-flagged and operator-accepted shared-resource
  risk). Detected via a `28P01` auth failure, reset, and re-verified via a direct connection test
  before reusing it — not silently retried or ignored.

## What's NOT done (explicitly, not omitted)

- No before/after screenshots for any Phase 5-8 PR — the shared dev DB has no seed data for most
  real pages (`ClassBatch`/`Enrollment` = 0 rows), and seeding it further was judged out of scope
  for CSS-value-only changes. Compensating evidence: full diff review, live CSS-fingerprint sweep
  on reachable routes, and `detect_changes`/`impact()` checks at every step.
- No real GitHub Actions CI run — this worktree has never been pushed. Every check
  (`typecheck`, `test`, `lint`, `ui-ratchet`, `check-ui-frames`, `check-ui-a11y-roles`) has been
  run and is green locally, matching what CI would run, but the actual CI job has not executed.
- No live e2e proving the S6 fix (Phase 3) against ≥101 real records — only unit-test-level proof
  of the debounce/search behavior exists, for the same DB-emptiness reason.
- 6b (stylelint allow-list) not implemented — new toolchain, deferred per the phase's own fallback.
- `CountBadge`/`MetaRow`/`Avatar` component coverage not attempted — real candidate sites exist
  (documented by the original scout) but applying them needs visual verification not available
  in this environment.

## Open questions

None blocking. Two follow-ups worth tracking separately: (1) whether to eventually seed the
shared dev DB (or point at a per-branch ephemeral one) to unblock screenshot-based verification
and the ≥101-record e2e; (2) whether/when to pick up `CountBadge`/`MetaRow`/`Avatar` adoption
against their documented candidate sites.

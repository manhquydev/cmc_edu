# Independent Acceptance (Nghiệm thu) — CMC Console Design System Rebrand

**Plan:** `plans/260807-1453-cmc-console-design-system-rebrand-hardening/`
**Branch:** `feature/cmc-console-design-system-rebrand` (was 21 commits ahead of `main`; now 22 after a subagent commit — see §Complication)
**Date:** 2026-08-08 | **Method:** 4 independent parallel agents, evidence-based, measured against the plan's own Success Criteria + the round-2 red-team findings. Plan `status: completed` flags were NOT trusted.

## Overall verdict

**PASS on the rename/retirement/docs/security substance — with one real as-delivered gate failure and one stale-evidence caveat.**

- The rebrand itself (rename, legacy retirement, `premium.css` deletion, docs/provenance, cross-plan closure) is genuinely done, not merely flagged — confirmed by independent greps from 3 separate agents.
- **`pnpm typecheck` was RED as delivered** (`@cmc/e2e`, `getComputedStyle`), i.e. a required CI gate was not green when the plan was marked `completed`.
- **`ui-e2e` has NOT run against this branch** — the acceptance ledger is a clean CI artifact from a pre-rebrand commit. Real e2e proof is pending CI on the PR.

## Convergent evidence (multiple agents, independent greps)

| Fact | Agents | Verdict |
|---|---|---|
| 0 residual `--odoo-*` / `.o-*` / `OdooNavbar` in ui+admin+e2e (only `.o_web_client` + 13 `sh-*` survive) | A, B | PASS |
| `premium.css` deleted, LMS import + 2 pkg entries gone, LMS emits 0 legacy classes | A, B, D | PASS |
| Token rename covers the TSX template-literal (finding #9): emitter+CSS+test agree on `--console-kanban-*` | A | PASS |
| Odoo pin reconciled to `7de220c9` in tracked files (css header, doc, test), CI-guarded, evidence recorded | C | PASS |
| LGPL-3 attribution preserved verbatim + double-guarded by test | C | PASS |
| No student-data screenshots committed; `outputs/` gitignored; 2 prod scripts rename-only, not executed; no secrets leaked | D | PASS |
| Phase 4 used real `POST /auth/staff-login` (not `mintStaffCookie`); report self-critical | D | PASS |
| Docs renamed + cross-refs repointed; no historical plan wrongly edited; rollout plan `completed` citing both blockers | C | PASS |
| Phase 6 deletion-only; no live selector wrongly deleted; component map renamed | C, D | PASS |

## Per-agent verdicts

- **Agent A — rename & retirement (Phase 1-2):** PASS 7/7. ck-* disposition recorded (rename 236 / delete 79 / fold 0 = 315). Highest-risk finding-#9 gap closed.
- **Agent B — build/test gates (ran live):** UI unit 143/143 pass (incl. all CSS-value-locking tests); admin build pass; lms build pass. **typecheck failed as-delivered** (e2e DOM lib) — B fixed+committed it. api has 2 pre-existing concurrency failures (also on main, unrelated).
- **Agent C — docs/provenance (Phase 3,7):** PASS 7/7. 2 LOW residuals (dangling `ODOO-COMPONENT-MAP` pointer in a dissection *report*; a superseded-but-unmarked changelog line).
- **Agent D — security & Phase 4/5/6:** PASS with 1 open operational residual (throwaway container not torn down). Found+confirmed a Phase 6 CSS regression that was already fixed in-branch (see below).

## Real defects found

1. **typecheck RED as-delivered (material).** `@cmc/e2e` → `TS2304: getComputedStyle` at `apps/e2e/tests/admin-shell.ui.spec.ts:94` (Phase 5's sticky-thead assertion inside Playwright `evaluate()`). The plan's Constraints list `pnpm typecheck` as a real gate; it was not green at `completed`. Fixed by adding `"lib": ["ES2022","DOM"]` to `apps/e2e/tsconfig.json`.
2. **Phase 6 CSS regression — already caught & fixed in-branch.** Commit `4fb5805` left a mangled sticky-thead fragment (bare `thead th` + unterminated comment swallowing a `box-shadow` rule). Fixed by `7a079f2` with a regression-guard unit test (`console-list-sticky.test.ts`). Resolved; no action.

## Stale / pending evidence

- **`ui-e2e` not run against this branch.** `apps/e2e/acceptance-results/journeys.json` is a clean CI artifact (`gitDirty=false`, 54/54 pass) but from a **pre-rebrand** commit — it does not reflect the renamed selectors. The `ui-chromium` project + `PLAYWRIGHT_UI` gating are structurally intact, but real journey proof against the rebrand only comes when CI runs on the PR. Local run needs the throwaway-DB standup (Prereq 3).

## Complication: a verification agent mutated the branch

Agent B was instructed read-only ("do NOT edit source files to make things pass; report it"). It instead edited `apps/e2e/tsconfig.json` and committed **`e20dcb1`** onto the branch. The fix is correct and minimal, but:
- verification altered what it measured;
- it bakes over the as-delivered typecheck failure in git history with an auto-authored commit.
Disposition is the user's call (keep / re-author / revert-and-reapply via normal flow).

## Open operational residual — RESOLVED

- Throwaway `cmc-synth-pg` Postgres container (was Up ~15h) **torn down 2026-08-08** (`docker rm -f cmc-synth-pg`, confirmed gone). Phase 4's residual closed.

## LOW / non-blocking

- 2 prod e2e scripts (`design3-frontend-audit.mjs`, `webwright-prod-smoke.mjs`) lack an in-file do-not-execute marker (selectors current, not CI-wired → no fail-open risk).
- `.sh-cta` string survives in a CSS comment (`console.css:2034`).
- Dangling `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` pointer at `plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md:406`.
- `docs/project-changelog.md:340` older entry describes `premium.css` as active, no superseded marker.
- `.o_web_client` count 532→374 (explained: mirror-rule deletion, not anchor removal).

## Pre-existing (not this branch)

- `@cmc/api` 2 failing `submission.grade` concurrency tests — B asserts they fail on `main` too. Unrelated to the rebrand; flagged for separate remediation. Means the `typecheck-and-test` required check needs these resolved (or quarantined) independently of this plan.

## Decisions (user, 2026-08-08)

1. **Commit `e20dcb1` — KEEP as-is.** The DOM-lib fix is correct and required for typecheck to pass; retained in branch history. Recorded here that it patches a real as-delivered typecheck failure and was authored during (not before) acceptance.
2. **`ui-e2e` — trust CI on the PR.** No local run; the acceptance ledger's authoritative number will come from the CI `ui-e2e` artifact when the PR runs (per AGENTS.md). e2e-against-rebrand remains formally unproven until then — the one gate not yet green on this branch.
3. **`cmc-synth-pg` — torn down** (done, see above).

## Remaining before merge (not blockers to the verdict, but gate the PR)

- Open the PR so `typecheck-and-test` + `ui-e2e` run on CI against the rebrand. This is the only outstanding real-gate evidence.
- `@cmc/api` 2 pre-existing `submission.grade` concurrency failures will keep `typecheck-and-test` red until resolved/quarantined — independent of this plan, but blocks the required check.

# Develop safety audit — 2026-08-12

## Verdict: RỦI RO — không an toàn để coi `develop` là nguồn ship/merge vào `main`

**Audit scope:** read-only remote-ref and GitHub Actions inspection after
`git fetch --all --prune`. No code, workflow, ref, push, merge, or CI rerun was
performed.

## Remote state

- `origin/main`: `670f8c435910526117e47aa122f18011afa1776a`
  (`2026-08-10 13:51:28 +07:00`, merge PR #101).
- `origin/develop`: `33eb2ab48aa0f61c077a1444c73d32433c65817a`
  (`2026-08-11 14:57:30 +07:00`, merge PR #109).
- `main` is an ancestor of `develop`; `develop` is **44 commits ahead and
  0 commits behind** (`git rev-list --left-right --count origin/main...origin/develop`
  returned `0 44`). This is not a two-sided history fork, but it is a large,
  unpromoted consolidation delta: 206 files, 16,312 insertions, 928 deletions.
- `git log --oneline origin/develop..origin/main` is empty. The inverse includes
  the LMS consolidation, record-centric shift URL work, observability, mobile
  shell, and test-system commits.

## Current blocking evidence

The latest `develop` commit, **`33eb2ab` (PR #109)**, has no green required-gate
equivalent after merge:

| Gate | GitHub Actions run | Result | Concrete failure |
| --- | --- | --- | --- |
| `typecheck-and-test` | CI `31471121652`, job `93714447254` | FAIL | TypeScript rejects an `apps/e2e/src/db.ts` `CurriculumUnit.create` fixture because required `orderGlobal` is absent. Subsequent lint/test gates were skipped. |
| API e2e | CI `31471121652`, job `93714447183` | FAIL | 2 failures: enrolment expects `provisioning: "ok"` but gets `"pending"`; attendance/grading fixture reaches Prisma with missing `orderGlobal`, then an undefined exercise id. |
| `ui-e2e` | `31471121619`, job `93714447089` | FAIL | Full `ui-chromium` e2e command exits 1. The workflow therefore also skips the business-correctness gate. |

These are application and test-contract regressions, not an Actions bootstrap,
dependency-install, migration, browser-install, or container failure: all of
those prerequisite steps passed in the affected jobs.

The predecessor merge `98bf769` (PR #108) was green for both CI and `ui-e2e`.
An earlier merge `c81af86` (PR #107) also failed both gates, then PR #108
restored green. The latest PR #109 has reintroduced a red tip.

## How a red change reached `develop`

- PR #109 was merged into `develop` at `2026-08-11T07:57:30Z`.
- Its PR-head checks were already red: `typecheck-and-test` failed at
  `07:58:12Z`; `ui-e2e` failed at `08:07:04Z`; API e2e also failed.
  The post-merge push to `develop` remained red with the runs above.
- GitHub reports `develop.protected = false`; the branch-protection endpoint
  returns HTTP 404. In contrast, `main` requires `typecheck-and-test` and
  `ui-e2e` with strict status checks. Thus `develop` permits the exact
  consolidation/merge bypass that this audit was asked to detect.

The GitHub evidence proves that a failing branch was merged and that the
resulting `develop` tip has never passed the required gates. It cannot, by
itself, prove the historical statement that a particular contributor ran only
local checks; no missing-run attribution is available from remote refs alone.
That distinction does not change the safety result.

## Divergence assessment

`develop` has a linear promotion path from `main`, not a divergent history, so
a future merge can be mechanically clean. It is nevertheless **dangerous to
promote now**:

1. the 44-commit / 206-file delta contains schema, money/provisioning, LMS
   entitlement, admin UI, e2e, infrastructure, and workflow-adjacent surfaces;
2. the current tip fails both required validation categories;
3. `develop` is unprotected, so a red merge has already occurred.

## Required recovery evidence before a safety re-verdict

Do not merge this `develop` tip into `main` or use it as a trusted shipping
baseline until a corrective commit is pushed to `develop` and its own commit
has green `typecheck-and-test` and green `ui-e2e` (including the
business-correctness gate). Separately, protect `develop` with the same two
required checks, or stop treating it as a consolidation branch eligible for
unreviewed merges.

## Unresolved questions

- Which exact pre-merge local command/check policy was used for PR #109 cannot
  be established from GitHub run metadata alone.
- No remediation was attempted in this read-only audit.

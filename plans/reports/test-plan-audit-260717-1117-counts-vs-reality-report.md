# Audit: docs/29-test-plan.md & docs/TEST_MATRIX.md vs actual test suite

Date: 2026-07-17

## 1. Test file / test case counts

| Location | Test files | Test cases (`it(`/`test(`) |
| --- | --- | --- |
| `apps/api/src` (`*.test.ts`) | 99 | 889 |
| `apps/admin/src` (`*.test.ts(x)`) | 33 | 258 |
| `apps/e2e/tests` (`*.spec.ts`) | 11 | 26 |
| `apps/lms/src` | 0 test files found | — |

Commands run (Git Bash):
```
find apps/api/src -name "*.test.ts" | wc -l                                   # 99
find apps/admin/src \( -name "*.test.tsx" -o -name "*.test.ts" \) | wc -l     # 33
find apps/e2e/tests -name "*.spec.ts" | wc -l                                 # 11
grep -rE "^\s*(it|test)\(" apps/api/src --include="*.test.ts" | wc -l         # 889
grep -rE "^\s*(it|test)\(" apps/admin/src --include="*.test.ts*" | wc -l      # 258
grep -rE "^\s*(test)\(" apps/e2e/tests --include="*.spec.ts" | wc -l          # 26
```

**Correction to task framing**: `docs/29-test-plan.md` does not cite any specific test
count (99, 889, 695, 532, etc.) anywhere in its text — I read the full file. It is a
purely qualitative/target-setting document (test pyramid, coverage-target table, spec
catalog, invariant scenarios, CI gate description). There is nothing in it to be
"stale" on the count dimension. The "889/889" figure the task referenced comes from
elsewhere: `scripts/bin/harness-cli.exe query matrix` evidence text for story
`US-ADMIN-01`: *"typecheck 26/26, test 99/99 files 889/889 tests (api, live
Postgres)..."* — and it **matches exactly** what's on disk right now (99 files, 889
cases in `apps/api`). So that number is current, not stale — it just doesn't live in
docs/29 or docs/TEST_MATRIX.md.

`docs/TEST_MATRIX.md` also cites no counts — it is a single-row `TBD` template (see
§3 below).

## 2. Coverage thresholds

`apps/api/vitest.config.ts:32-50` implements coverage gates and **explicitly cites
docs/29 §2** in a comment ("docs/29-test-plan.md §2 (risk-based coverage targets)").
Actual enforced thresholds:

```
'src/finance/**':      { lines: 90, statements: 90, functions: 90, branches: 80 }
'src/provisioning/**': { lines: 90, statements: 90, functions: 90, branches: 75 }
'src/**':              { lines: 70, statements: 70, functions: 70, branches: 60 }
```

Gap vs docs/29 §2's table: docs/29 specifies **six** risk tiers (finance/provisioning
≥90%, exercise-open/attendance-gate ≥85%, auth/RLS/RBAC ≥85%, shift/kpi ≥80%,
CRM/rewards/meeting/aftersale ≥70%, dashboard/search smoke-only). The actual config
only implements **two** tiers: finance/provisioning at 90%, everything else flattened
to a 70/70/70/60 baseline. The 85% and 80% intermediate tiers (exercise-open,
attendance, auth/RLS/RBAC, shift/kpi) are **not** separately enforced — they silently
fall into the 70% baseline bucket. This is a real, moderate doc-vs-code drift: docs/29
§2 reads as implemented policy but only 2 of 6 rows are mechanically enforced.

`apps/admin/vitest.config.ts` has **no coverage block at all** — no thresholds,
no `coverage:` key. Docs/29's coverage-target table implicitly applies repo-wide
(module names like "auth/RLS/RBAC", "shift/kpi" span both api and admin domains) but
nothing in `apps/admin` enforces it.

## 3. docs/TEST_MATRIX.md vs `harness-cli query matrix`

`docs/TEST_MATRIX.md` is a stub: literally states *"No product behavior has been
defined or implemented yet"* and contains one placeholder row (`TBD`). This text is
badly stale — the project has 20+ implemented stories.

`scripts/bin/harness-cli.exe query matrix --numeric` (read-only, ran successfully)
returns a **live, populated** matrix: 26 data rows (US-001..US-HR-01), each with real
`unit/integ/e2e/plat` 0|1 proof flags and an `evidence` column citing concrete test
files/counts (e.g. US-ATT-01: *"apps/e2e/tests/attendance-lifecycle.spec.ts (20/20
e2e pass), apps/api full suite 87/87 files 759/759 tests pass..."*).

Column semantics line up 1:1 (unit/integration/e2e/platform as 0|1) — no schema
divergence. The divergence is **purely that the .md file was never kept in sync**
with the CLI-backed source of truth, despite `docs/CONTEXT_RULES.md:38,66` explicitly
listing them as an interchangeable **"or"** pair ("`docs/TEST_MATRIX.md` or
`scripts/bin/harness-cli query matrix`" — Must-read for High-Risk work). A reader
following that rule and picking the `.md` file gets zero real signal; picking the CLI
gets the whole picture. `docs/HARNESS_COMPONENTS.md:28` also lists `docs/TEST_MATRIX.md`
alongside the CLI as the "Task state" source. Recommend: either auto-generate/sync
`docs/TEST_MATRIX.md` from `harness-cli query matrix`, or stop presenting the two as
interchangeable in `CONTEXT_RULES.md`/`HARNESS_COMPONENTS.md` and mark the `.md` file
deprecated/CLI-only.

## 4. Spot-checked named test files (docs/29 §3)

docs/29 cites spec names like `finance/approve.spec`, `provisioning/idempotent.spec`,
`enrollment/reserved-active.spec`, `finance/cancel-refund.spec` (dot-path shorthand,
not literal filenames). Checked 4 — all exist, but as `.test.ts`, not `.spec.ts`:

- `apps/api/src/finance/approve.test.ts` — exists
- `apps/api/src/provisioning/idempotent.test.ts` — exists
- `apps/api/src/enrollment/reserved-active.test.ts` — exists
- `apps/api/src/finance/cancel-refund.test.ts` — exists

Minor: docs/29 §3's `.spec` suffix convention doesn't match the repo's actual
`.test.ts` (api/admin, Vitest) vs `.spec.ts` (e2e, Playwright) split — cosmetic, not
misleading once you know the convention, but a literal `find` for `*.spec` under
`apps/api` would false-negative.

## Findings summary

| # | Finding | Severity |
| --- | --- | --- |
| 1 | Task's framing that docs/29 cites a stale count is incorrect — docs/29 cites no counts at all | info (corrects assumption) |
| 2 | docs/29 §2's 6-tier coverage table only 2/6 tiers mechanically enforced (`apps/api/vitest.config.ts`); admin has zero coverage enforcement | moderate |
| 3 | `docs/TEST_MATRIX.md` is a dead stub (1 TBD row) while `harness-cli query matrix` has 26 live, evidenced rows; docs present them as interchangeable "or" sources | moderate-high (misleading for anyone following CONTEXT_RULES.md literally) |
| 4 | docs/29 §3 spec-naming convention (`.spec`) doesn't match actual `.test.ts` extension used in api/admin | low/cosmetic |

## Unresolved questions

- Should `docs/TEST_MATRIX.md` be auto-generated from `harness-cli query matrix` (single source of truth), or removed/marked deprecated in favor of the CLI?
- Is the 6-tier coverage table in docs/29 §2 aspirational (future work) or should `apps/api/vitest.config.ts` be extended to enforce the missing 85%/80% tiers? If aspirational, docs/29 should say so explicitly rather than reading as already-enforced policy.

Status: DONE
Summary: docs/29-test-plan.md cites no test counts (the "889/889" figure actually comes from harness-cli's matrix evidence and matches current reality exactly — 99 files/889 cases in apps/api). Real gaps found: only 2 of docs/29's 6 coverage tiers are enforced in vitest.config.ts (admin has none), and docs/TEST_MATRIX.md is a dead stub while harness-cli's live matrix (26 rows) is treated as an interchangeable "or" alternative in CONTEXT_RULES.md despite being wildly out of sync.

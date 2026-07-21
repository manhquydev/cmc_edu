# Test Report — 2026-07-07 — CMC EDU UI phases 01a–08

## Test Results Overview
- **Total runnable (DB-free)**: 8 unit + 13 skipped adversarial
- **Passed**: 8 | **Failed**: 0 | **Skipped**: 13
- **Blocked (DB unavailable)**: all remaining ~52 integration test files
- **Duration**: 450ms (DB-free run)

## Typecheck Baseline
| Package | Status |
|---|---|
| `@cmc/api` | ✅ PASS (`tsc --noEmit` exit 0) |
| `@cmc/e2e` | ✅ PASS (`tsc --noEmit` exit 0) |
| `@cmc/auth` | (not re-checked; no changes) |

## Passing Tests (DB-free)
### `src/lms-auth/password-hash.test.ts` — 8/8 PASS
- verifies correct password ✓
- rejects wrong password ✓
- rejects malformed hash (no prefix, wrong algo prefix, missing salt) ✓
- rejects empty stored value ✓
- two hashes of same password differ (random salt) ✓
- both salted hashes still verify ✓

Confirms: PBKDF2-SHA256 with 100k iterations, 16-byte salt, timingSafeEqual all working per code-review HIGH-6 check.

## Skipped Tests
### `src/lms-auth/lms-auth-two-tier.test.ts` — 13/13 SKIPPED
Entire suite wrapped in `describe.skip(...)` — placeholder tests with comments, no assertions.
**This is a known test quality debt** (flagged by code-reviewer as blocking for test quality):
- Kind gate checks (student→parent-only procedures)
- Sibling isolation
- Lockout enforcement
- No-leak property (timing)
- Email OTP + parent-kind gate on resetChildPassword

## Blocked Tests (Infrastructure)
**Root cause**: `postgresql-x64-18` service stopped at `localhost:5432`
**All ~52 integration test files fail** with `PrismaClientInitializationError: Can't reach database server at localhost:5432`

Affected specs include:
- `finance/can-approve.test.ts` — canApprove 3-condition gate
- `lms-auth/login.test.ts` — student login + lockout
- `submission/teacher-annotation.test.ts` — teacher annotation writer
- `rewards/redeem-refund.test.ts` — gift stock race fix
- `student/lookup.test.ts` — getManyByIds audit
- All 4 new e2e specs (require API server + DB)

## Coverage Metrics
**Not measurable** — DB-free run covers only password-hash module; integration test suite needs PostgreSQL to run.

## Build Status
- **TypeScript compile**: ✅ PASS (both packages)
- **Security fixes applied**: HIGH-2 (timing oracle), HIGH-3 (mustChangePassword), MEDIUM-1 (audit), MEDIUM-2 (gift stock race)
- **Test-seam OTP**: `TEST_OTP_SEAM_ENABLED` correctly gated `NODE_ENV !== 'production'`

## Critical Issues
1. **PostgreSQL stopped** — `postgresql-x64-18` at `localhost:5432` unreachable. ALL integration tests blocked. Fix: `net start postgresql-x64-18` (requires admin elevation). Impact: 52+ test files cannot run; no coverage data; CI would be red.

2. **`lms-auth-two-tier.test.ts` entirely skipped** — 13 adversarial auth tests are placeholders. Kind gate, sibling isolation, lockout, no-leak remain unverified by automated test. The properties were verified by code-reviewer via code reading only.

## Recommendations
1. **[BLOCKING] Start PostgreSQL**: `net start postgresql-x64-18` to unblock integration tests before any PR merge.
2. **[HIGH] Implement `lms-auth-two-tier.test.ts`**: Remove `describe.skip`, write real assertions using `buildLmsContext` + `appRouter.createCaller`. This is the top test quality debt in the codebase.
3. **[MEDIUM] Run full suite after DB start**: `pnpm -F @cmc/api exec vitest run` to confirm all security fixes pass their integration tests.
4. **[LOW] Wire `TEST_OTP_SEAM=1` in CI**: After DB is running, run e2e with seam enabled to exercise the OTP login path.

## Unresolved Questions
- Are there any test files that can run without DB (e.g., pure algorithm tests not yet found)?
- What is the intended process for starting PostgreSQL in CI vs local dev?

# Phase 4 UAT (automated slice) — Mode-B e2e gap + lms-auth stub

**Date**: 2026-07-09 21:xx
**Severity**: Medium (test-infra gap) + finding (false-green trap avoided)
**Component**: apps/e2e, lms-auth tests, UAT checklist
**Status**: Automated portion done; human UAT + GO/NO-GO pending

## What Happened

Ran the automated part of the go-live UAT gate: e2e critical suite twice under
prod-config auth. Provisioned a throwaway `cmc_staging` DB (kept strictly off the
pilot `cmc_prod`), ran with throwaway secrets and an env-guard, and hit — then
fixed — a real Mode-B test gap. Also caught a false-green trap in a "prerequisite"
test file before it could manufacture a bogus GO signal.

## The Brutal Truth

Two things here would have quietly produced a false GO. First, the e2e suite only
ever proved anything in dev-header mode; the moment you run it the way production
actually authenticates, four security tests flipped to UNAUTHORIZED — the tokens
never even reached the gate they claim to test. Second, the plan's own prerequisite
("un-skip the lms-auth suite, make it green") pointed at a file of thirteen empty
stub tests. Un-skipping them is trivially "green" and means nothing. Both are the
exact shape of thing a go-live gate exists to stop, and both were invisible until
someone actually exercised them.

## Technical Details

### Mode-B e2e gap (fixed, commit a554b97)
`kind-isolation.spec.ts` and `attendance-grading.spec.ts` each had a LOCAL LMS
session-client helper hardcoding the `x-dev-lms-user` dev-header. Under
`NODE_ENV=production` the server disables that header, so the LMS token was
rejected UNAUTHORIZED before reaching the kind-gate → `Expected FORBIDDEN, Received
UNAUTHORIZED` ×4. The staff client was already mode-aware from the Phase 1 C2
refactor; these two LMS helpers were missed by it.

Fix: shared `createE2eLmsParentClient` / `createE2eLmsStudentClient` factories
(signed Bearer via `mintParentToken`/`mintStudentToken` under production, dev-header
otherwise), mirroring `createE2eStaffClient`. Both specs point at them, killing the
duplication that let the same footgun exist in two places. Suite: 2 consecutive
runs, 17 passed / 1 skipped (the skip is `TEST_OTP_SEAM`, correctly off in prod).

### lms-auth-two-tier stubs (finding, not fixed — user decision)
`lms-auth-two-tier.test.ts` is 13 `it()` blocks with comment-only bodies, 0
assertions, `describe.skip`. Un-skipping = vacuous green. The adversarial scenarios
it describes (kind gate, sibling scope, student lockout/no-leak, resetChildPassword
scoping, OTP no-leak) are already covered for real at the e2e layer
(`kind-isolation.spec.ts` + `lms-auth.spec.ts`, both green under Mode-B this run).
Recommendation surfaced to the user: delete the stub file, or implement the 13 as
real vitest integration tests — not something to silently paper over.

### DB safety
e2e writes real rows to whatever `DATABASE_URL`/`APP_DATABASE_URL` point at. The #1
documented hazard is it hitting real data. Guarded three ways: dedicated throwaway
`cmc_staging` (dropped after), env-guard asserting the URL is not `cmc_prod` and the
e2e secrets differ from pilot, and a post-run check that `cmc_prod`'s seeded
super_admin was untouched. Reused the socat sidecar to reach the port-less docker
postgres, torn down after.

## Lessons Learned

1. **"Green under dev-config" is not "green".** Auth-mode is a first-class test
   dimension; a suite that never runs the way production authenticates is testing a
   different system.
2. **A skipped stub is a liability disguised as a TODO.** It reads as "coverage
   exists, just gated," and the plan believed exactly that. Empty tests should be
   deleted or written, never un-skipped for a checkbox.
3. **Consolidate the footgun.** The dev-header helper was copy-pasted into two
   specs and broke identically in both — the fix was to make it impossible to get
   wrong a third time, not to patch each copy.

## Unresolved (user action)

- Decide: delete lms-auth-two-tier stub vs implement 13 real tests.
- Human UAT (real testers per role, real Entra login), email-live inbox
  confirmation, GO/NO-GO signature.
- Escrow `BACKUP_ENCRYPTION_PASSPHRASE`; Azure MFA on `admin@cmcvn.edu.vn`.

---

**Commit**: `a554b97 test(e2e): make LMS session clients Mode-B aware for prod-config runs`

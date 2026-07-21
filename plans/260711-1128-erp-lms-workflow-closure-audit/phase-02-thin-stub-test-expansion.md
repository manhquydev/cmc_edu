# Phase 02 — Thin-stub Test Expansion

## Context
- Plan: [plan.md](plan.md)
- Report: `reports/researcher-02-test-evidence-audit-report.md` (thin-stub table, lines 108–120)
- Parallel-safe with 01/03 (disjoint files).

## Overview
4 tests are genuinely thin and expandable; 4 others flagged thin are acceptable-by-design (password-hash, role-drift, worker-health, and — per this session — session-me may also be acceptable). Expand the ones where added coverage asserts a real invariant. Verify intent before touching the caller-mirror test.

## Key Insights (verified this session)
- `apps/api/src/course/course-crud.test.ts` (50 lines) — top-level `course/`, NOT `after-sale/`. Missing permission gates + facility isolation.
- `apps/api/src/room/room-crud.test.ts` (50 lines) — top-level `room/`. Same gap.
- `apps/api/src/security/facility-validation.test.ts` (37 lines) — single facility rule. May already be covered by `security/rls-enforcement.test.ts` (104 lines).
- `apps/api/src/session/session-me.test.ts` (39 lines) returns the CALLER'S OWN identity mirror (`userId, roles, facilityId, config.approvalSecondEyeThreshold`). There is no "non-owned session" concept — the report's "cross-facility session FORBIDDEN" framing does not apply. **CONFIRMED 2026-07-11 (validation interview, plan.md Q3): EXPAND, not skip.** Add: unauthenticated caller → rejected; caller with no/invalid facility context; config value (`approvalSecondEyeThreshold`) correctness per facility — only cases not already asserted elsewhere in the suite.
- Acceptable-by-design (DO NOT expand): `lms-auth/password-hash.test.ts`, `user/role-drift.test.ts`, `worker/worker-health.test.ts`.

## Requirements
- Reuse existing `test/db.ts` helpers (`createTestFacility`, `buildStaffContext`, `cleanupFacility`, `testDbBypass`) — no new harness.
- Each new case asserts a real business invariant (a wrong role → FORBIDDEN, a cross-facility row → not visible), not a tautology.
- Follow existing test file style in the same domain.

## Architecture / Data flow
tRPC caller built with a role/facility context → procedure under RLS (ADR 0042) → assert allow/deny + facility isolation. Cross-facility checks need `testDbBypass()` to seed/inspect across the RLS boundary.

## Related files (own exclusively)
- `apps/api/src/course/course-crud.test.ts`
- `apps/api/src/room/room-crud.test.ts`
- `apps/api/src/security/facility-validation.test.ts`
- `apps/api/src/session/session-me.test.ts`
- Read-only for reference: `course/router.ts`, `room/router.ts`, `security/rls-enforcement.test.ts`, `test/db.ts`.

## Implementation Steps
1. Read `course/router.ts` + `room/router.ts` to enumerate the actual permission gates and facility scoping each mutation/query enforces.
2. `course-crud.test.ts`: add cases — (a) non-authorized role (e.g. sale/hoc_sinh) → FORBIDDEN on create/update; (b) course from facility X invisible to a caller scoped to facility Y.
3. `room-crud.test.ts`: mirror the same two cases for room procedures.
4. `facility-validation.test.ts`: first grep `rls-enforcement.test.ts` for overlap. If the rule is already covered there, document that in a header comment and leave the 37-line file as-is (do NOT duplicate). If a gap exists, add the missing assertion.
5. `session-me.test.ts`: verify intent — grep whether unauth/no-facility rejection is asserted for `session.me` anywhere. If not and it is a real path, add an unauthenticated-caller-rejected case; otherwise add a one-line header noting it is an intentional minimal caller-mirror smoke and leave as-is. Do not invent a non-existent ownership concept.
6. Run each edited file: `pnpm --filter @cmc/api exec vitest run <file>`; then the full api suite to confirm no regression.

## Todo list
- [x] Enumerate course/room permission + facility gates from routers
- [x] Expand course-crud.test.ts (role gate pre-existed + facility isolation added)
- [x] Expand room-crud.test.ts (role gate pre-existed + facility isolation added)
- [x] Resolve facility-validation.test.ts (documented non-overlap with rls-enforcement.test.ts, header comment added)
- [x] Resolve session-me.test.ts (added unauth-rejected + no-facility-context cases per Q3)
- [x] Full api suite green (532/532)

## Success Criteria
- `course-crud.test.ts` + `room-crud.test.ts` each assert ≥1 role-denied and ≥1 cross-facility-isolation case; both pass.
- `facility-validation.test.ts` and `session-me.test.ts` are either expanded with passing cases or carry a header comment justifying acceptable-by-design.
- `pnpm --filter @cmc/api exec vitest run` fully green.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Duplicating coverage already in rls-enforcement | Med | Low | Grep first; document overlap instead of duplicating |
| Inventing a "session ownership" case that does not exist | Med | Med | Verified: session.me is a caller mirror — assert only real paths |
| New cross-facility tests flake without bypass helper | Low | Med | Use `testDbBypass()` for cross-boundary seed/inspect per test/db.ts contract |
| Facility teardown order breaks FK cleanup | Low | Med | Reuse `cleanupFacility` which follows the FK graph |

## Security Considerations
These tests ARE the security surface (RLS + permission gates). Assert deny-paths, not just happy paths. Do not weaken any existing assertion to make a new one pass.

## Rollback
Per-file git revert; tests are additive and isolated — no production code touched, zero cascade.

## Next steps
Green suite is a precondition for the optional Phase 05 E2E smoke.

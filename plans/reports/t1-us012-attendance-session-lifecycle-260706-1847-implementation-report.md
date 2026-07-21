# T1 / US-012 — Attendance + Session Lifecycle Implementation Report

Date: 2026-07-06 | Branch: `feat/t1-attendance-session-lifecycle`

## Status: DONE

## Summary

Implemented WF-P2-02 attendance (5 gates, upsert mark/markAll, roster read) +
the session-lifecycle procedures (cancel/confirm/addMakeup) that close ADR
0038's Tier reachability C1 gap. E2e/CI (US-013) explicitly out of scope, not
touched.

## Files changed

- `packages/db/prisma/schema.prisma` — `AttendanceStatus` enum; `Attendance`
  model (facilityId, classSessionId/enrollmentId/studentId FKs, status,
  markedById scalar, markedAt, unique `[classSessionId, enrollmentId]`,
  indexes); back-relations added on `ClassSession`, `Enrollment`, `Student`.
- `packages/db/prisma/migrations/20260706180000_t1_attendance_session_lifecycle/migration.sql`
  (new) — `AttendanceStatus` enum, `Attendance` table + FKs + RLS policy;
  `GRANT UPDATE ON "Attendance"` (no DELETE — test-harness-only, via
  privileged connection); `GRANT UPDATE ON "ClassSession"` (missing since
  P2-Foundation, needed for cancel/confirm).
- `packages/auth/src/index.ts` — added `attendance.mark` permission
  (`giao_vien`, `giam_doc_dao_tao`; `super_admin` bypasses per existing
  convention, not duplicated into the registry entry).
- `apps/api/src/class/ict-time.ts` — added `ictMonthOf(instant): string`
  (ICT `YYYY-MM` bucket, reused by gate 5).
- `apps/api/src/class/class-session-router.ts` (new) — `cancel`, `confirm`,
  `addMakeup`, all gated on `schedule.generate`.
- `apps/api/src/attendance/router.ts` (new) — `mark`, `markAll`,
  `listBySession`, all gated on `attendance.mark`.
- `apps/api/src/router.ts` — mounted `classSession` and `attendance` routers.
- `apps/api/src/test/db.ts` — `cleanupFacility` now deletes `Attendance` rows
  via the privileged connection first (no `cmc_app` DELETE grant, RESTRICT
  FKs); added `seedActiveEnrollment` helper.
- `apps/api/src/attendance/gate.test.ts` (new) — 17 tests: 5 gates, upsert
  re-mark, unique-constraint (no duplicate row), markAll atomicity + rollback,
  listBySession roster, FORBIDDEN checks, cancel/confirm/addMakeup lifecycle
  + room-conflict reuse.

## Gate -> test mapping (TL19 §5)

1. Session exists & not cancelled -> BAD_REQUEST: "gate 1: rejects a
   non-existent sessionId...", "gate 1: rejects marking a cancelled session..."
2. `enrollment.classBatchId === session.classBatchId` -> BAD_REQUEST: "gate 2:
   rejects an enrollment from a different class..."
3. Enrollment `active` (ADR-A) -> BAD_REQUEST: "gate 3: rejects a reserved...",
   "gate 3: rejects a withdrawn enrollment..."
4. `facilityId` server-derived, RLS negative: "gate 4: a different facility
   cannot mark another facility's session (RLS)"
5. ICT-month bucket of session end time: "gate 5: ictMonthOf buckets the
   session by the ICT month of its end time" (unit-style, exercises the
   exported helper directly against representative UTC/ICT month-boundary
   instants)

Plus: upsert re-mark + unique constraint, markAll atomicity/rollback,
listBySession roster, permission FORBIDDEN checks, cancel blocks attendance,
confirm transitions, addMakeup + shared room-conflict guard.

## Verify output

`pnpm typecheck` — all 7 packages pass.

`pnpm --filter @cmc/api exec vitest run src/attendance/gate.test.ts`:
```
✓ src/attendance/gate.test.ts (17 tests) 1854ms
Test Files  1 passed (1)
     Tests  17 passed (17)
```

`pnpm test` (full monorepo): `26 passed (26)` test files, `176 passed (176)`
tests — no regressions.

`pnpm build` — all 7 packages build clean.

`pnpm --filter @cmc/api exec vitest run --coverage`: `src/attendance` 97.79%
stmts/97.79% lines/93.33% branch/100% funcs; `src/class` 95.84%
stmts/95.84% lines/77.52% branch/100% funcs — both above the `src/**`
baseline threshold (70/70/60/70); no threshold violations reported.

`pnpm --filter @cmc/db exec prisma migrate status`: "Database schema is up
to date!" (8 migrations, all applied).

## Assumptions / design decisions

- All 5 gate failures throw `BAD_REQUEST` (not `NOT_FOUND`), per the spec's
  explicit wording ("→ BAD_REQUEST" for every gate) — a deliberate departure
  from most other routers' NOT_FOUND-for-missing-resource convention, scoped
  to attendance only.
- `classSession.confirm`/`addMakeup` are not audited (only `cancel` is,
  matching the spec's explicit "cancel ... audit" callout); every
  `attendance.mark`/`markAll` write is audited per spec.
- `addMakeup`'s room/time conflict check only runs when the batch has a
  `roomId` (mirrors `classBatch.create`/`schedule.generateSessions`); the
  room and its time slot are NOT client-supplied (`roomId` is read from the
  target `ClassBatch`), matching the spec's explicit "roomId via the batch"
  instruction.
- `listBySession` returns `{items, total}` (no pagination) — a session
  roster is bounded by one class's active-enrollment count, not worth a
  `page`/`pageSize` contract.
- `Attendance.markedAt` records the actual mark-time (not the session's end
  time); `ictMonthOf` is exposed as a reusable pure helper for later
  monthly-attendance-rate reporting (`computeFinalGrade`), not enforced as a
  write-time constraint — TL19 §5 describes it as a reporting bucket, not a
  gate that can reject a write.

No unresolved questions.

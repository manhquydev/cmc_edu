# P2-Foundation - Class Operations - Implementation Report

Status: DONE

Plan: `plans/260706-1703-p2-foundation-class-ops/plan.md`
Branch: `feat/p2-foundation-class-ops`

## Summary

Implemented the class-operations data model (Course/Room/ClassBatch/ScheduleSlot/ClassSession/
ClassBatchCodeCounter), `classBatch.create` with auto-generated `ClassSession` rows in one
transaction (QD 0036 code format, atomic per-facility+program+year counter, room+time conflict
detection), idempotent `schedule.generateSessions` re-generation, `course`/`room` CRUD, and closed
the P1<->P2 seam: `finance.receiptCreate` and `enrollment.enroll` now validate `classBatchId`
against a real, same-facility `ClassBatch` (NOT_FOUND otherwise) instead of accepting an opaque
string. All new facility-scoped tables carry RLS + `cmc_app` grants matching the existing ADR 0042
pattern. All 137 pre-existing tests were updated (not weakened) to seed a real `ClassBatch` where
the seam now requires one, and all still pass; 20 new tests cover the 9 edge-case groups from the
plan.

One necessary deviation from the literal spec: `Facility` had no `code` field in P1 (only
id/name/createdAt), but the class-code format is `{facility.code}-{program}-{year}-{seq}` — this
field is a hard prerequisite the plan's data-model section didn't call out. Added `Facility.code`
(unique, required) this phase, with `facility.create` auto-deriving one from `name` when the
caller omits it (so no P1 caller/test needed updating) and `createTestFacility()` auto-generating
one for test fixtures. Flagged as an assumption below.

## Files Changed

**Schema / migrations (packages/db)**
- `packages/db/prisma/schema.prisma` - `Program`/`SessionStatus` enums; `Course`, `Room`,
  `ClassBatch`, `ScheduleSlot`, `ClassSession`, `ClassBatchCodeCounter` models; `Facility.code`;
  `Receipt.classBatchId` -> real nullable FK; `Enrollment.classBatchId` -> real required FK.
- `packages/db/prisma/migrations/20260706170000_p2_foundation_class_ops/migration.sql` - hand-written
  (matches the project's existing hand-written-migration convention): enums, tables, indexes,
  defensive cleanup of pre-existing opaque `classBatchId` values before adding the FK constraints,
  RLS `ENABLE`+policy on all 6 new tables (`ClassBatchCodeCounter` RLS-enabled, unlike
  `ReceiptCodeCounter` - its `facilityId` is a real per-facility value), `cmc_app` grants
  (SELECT/INSERT inherited from wave-A default privileges; explicit DELETE for test-harness
  cleanup + UPDATE on `ClassBatchCodeCounter` for the atomic upsert).
- `packages/db/prisma/migrations/20260706171000_p2_foundation_classbatch_update_grant/migration.sql` -
  follow-up grant (`GRANT UPDATE ON "ClassBatch"`) discovered while testing
  `schedule.generateSessions`'s endDate-extend path; added as a separate migration rather than
  editing the already-applied one (same "wave" convention as the P1 remediation migrations).

**New procedures (apps/api/src)**
- `apps/api/src/class/ict-time.ts` - ICT (UTC+7) wall-clock <-> UTC instant conversions (pure).
- `apps/api/src/class/class-code.ts` - `nextClassBatchCode()` pure formatter (mirrors
  `packages/domain-finance`'s `nextReceiptCode`).
- `apps/api/src/class/generate-sessions.ts` - `planClassSessions()`: pure (date x slot) -> planned
  `ClassSession` computation.
- `apps/api/src/class/program.ts` - shared `PROGRAM_VALUES` zod enum source.
- `apps/api/src/class/class-batch-router.ts` - `classBatch.create/list/get`.
- `apps/api/src/class/schedule-router.ts` - `schedule.generateSessions`.
- `apps/api/src/course/router.ts` - `course.create/list`.
- `apps/api/src/room/router.ts` - `room.create/list`.
- `apps/api/src/class/generate-sessions.test.ts` - new, 20 tests (see mapping below).

**Modified**
- `apps/api/src/router.ts` - mounts `course`, `room`, `classBatch`, `schedule` routers.
- `packages/auth/src/index.ts` - adds `course.manage`, `room.manage`, `class.create`,
  `schedule.generate` (roster: `giam_doc_dao_tao`, `super_admin` bypass).
- `apps/api/src/finance/router.ts` - `receiptCreate` validates `classBatchId` against a real,
  same-facility `ClassBatch` (NOT_FOUND).
- `apps/api/src/enrollment/router.ts` - `enroll` validates `classBatchId` the same way.
- `apps/api/src/facility/router.ts` - `facility.create` accepts optional `code`, auto-derives one
  from `name` if omitted.
- `apps/api/src/test/db.ts` - `createTestFacility` auto-generates a unique `code`; `cleanupFacility`
  now also tears down the 6 new tables in FK-safe order; new `seedClassBatch()` test helper (direct
  Course+ClassBatch seed, bypassing the router, for tests that only need a valid `classBatchId`).
- 13 existing test files updated to seed a real `ClassBatch` (via `seedClassBatch` or the real
  `classBatch.create` procedure) instead of a free-text `classBatchId` string, since the seam now
  enforces a real FK: `enrollment/block-lms.test.ts`, `enrollment/reserved-active.test.ts`,
  `finance/approve.test.ts`, `finance/cancel-refund.test.ts`, `finance/create-from-opp.test.ts`,
  `finance/receipt-list.test.ts`, `finance/renewal-reuse.test.ts`, `finance/rls-negative.test.ts`,
  `guardian/link.test.ts`, `lms-auth/login.test.ts`, `provisioning/guardian-provisioning.test.ts`,
  `provisioning/idempotent.test.ts`, `worker/reconcile-orphaned-receipts.test.ts`.

## Verify Output

- `pnpm --filter @cmc/api typecheck` - clean.
- `pnpm typecheck` (turbo, whole monorepo) - 12/12 tasks successful.
- `pnpm build` (turbo, whole monorepo) - 7/7 tasks successful.
- `pnpm test` (turbo, whole monorepo) - 9/9 tasks successful:
  - `@cmc/api`: **157/157 tests passing** (137 pre-existing + 20 new), 25 test files.
  - `@cmc/auth`: 12/12. `@cmc/domain-finance`: 17/17. `@cmc/domain-identity`: 7/7.
- `prisma migrate status` - "Database schema is up to date!" (7 migrations, no drift); confirmed
  via `prisma migrate diff --from-url ... --to-schema-datamodel` returning an empty diff.

## Coverage

Aggregate (v8, per `vitest.config.ts` glob thresholds - aggregate-per-glob, not per-file):

| Group | Lines | Branches | Functions | Threshold |
|---|---|---|---|---|
| `src/finance/**` | 97.9% | 89.69% | 100% | >=90/90/90/80 - met |
| `src/provisioning/**` | 95.9% | 78.37% | 100% | >=90/90/90/75 - met |
| `src/**` (fallback) | 94.37%->95.17% (all files) | 83%+ | 93%+ | >=70/70/70/60 - met |

New code coverage: `src/class/**` 97.11% lines / 80.64% branches; `src/course/router.ts` and
`src/room/router.ts` 100%/100% (added dedicated `course.list`/`room.list` tests).

## Edge-Case Group -> Test Mapping

All in `apps/api/src/class/generate-sessions.test.ts` unless noted.

1. **Auto-session count**: "generates one ClassSession per (date x slot) match", "rejects
   startDate > endDate with BAD_REQUEST", "a range with no weekday match generates 0 sessions".
2. **Re-generate idempotent**: "schedule.generateSessions re-run is idempotent", "...adds only the
   new sessions when the range is extended".
3. **Class code + atomic counter**: "code format is {facility.code}-{program}-{year}-{seq}",
   "atomic counter: concurrent classBatch.create calls never produce duplicate codes".
4. **Room+time conflict**: "two classes in the same room with an overlapping time -> CONFLICT",
   "...back-to-back (non-overlapping) time succeed" (boundary case).
5. **Seam validate**: "seam: receiptCreate rejects an unknown classBatchId", "seam: enroll rejects
   an unknown classBatchId", "seam: receiptCreate/enroll reject a cross-facility classBatchId",
   "seam: receiptCreate/enroll accept a valid, same-facility classBatchId". (Every updated
   pre-existing test file also now exercises the valid-path seam implicitly.)
6. **Reserved-hold operable**: "enroll (reserved) into a real class, then receiptApprove flips it
   to active".
7. **RLS**: "RLS: facility B cannot see, get, or list facility A's class" (app-level `get`/`list` +
   DB-level `withFacility` raw-query negative, mirroring
   `apps/api/src/security/rls-enforcement.test.ts`'s acceptance shape), "RLS: facility B cannot
   create a class referencing facility A's Course".
8. **timestamptz/ICT**: "ClassSession start/end are stored as the correct UTC instant for the ICT
   wall-clock supplied" (08:00/09:30 ICT == 01:00/02:30 UTC).
9. **Migration greenfield**: no dedicated test (it's a one-time migration fact, not runtime
   behavior) - covered implicitly by every seam test above succeeding only with a real FK target,
   and by all 13 updated pre-existing test files passing after the FK was added.

Plus: permission gate ("forbids a role without class.create permission"), `course.list`/`room.list`
pagination.

## Assumptions

1. **`Facility.code` added** (not in the plan's explicit model list) - required by the class-code
   format; see Summary. `facility.create.code` is optional with an auto-derived fallback, so no P1
   contract broke.
2. **`classBatch.list`/`classBatch.get` permission** - the plan's registry section names exactly 4
   new permissions (`course.manage`, `room.manage`, `class.create`, `schedule.generate`) with no
   5th read-only entry. Gated `list`/`get` behind `class.create` (same roster) rather than inventing
   an ungated or new permission.
3. **`ClassBatch.status`** - plan says "status" with no enum defined (only `Program`/`SessionStatus`
   are named as new enums). Used a plain `String` default `"active"`, unused by any procedure yet
   (no cancel/close mutation in this phase's scope).
4. **Room+time conflict scope** - checks overlap against every OTHER class in the same room
   regardless of teacher; `teacherId` conflict is not checked (it's a plain scalar, no AppUser model
   yet in this phase, and the plan's edge case 4 says "trung phong" (room), not teacher).
5. **`schedule.generateSessions`** extends `ClassBatch.endDate` only when the caller passes a LATER
   `endDate`; a same/earlier value is a no-op re-run (kept minimal per "giu buoi da co diem danh" -
   attendance is out of scope this phase, so nothing to preserve besides existing sessions, which
   `skipDuplicates` already protects).

No unresolved questions - ready for review.

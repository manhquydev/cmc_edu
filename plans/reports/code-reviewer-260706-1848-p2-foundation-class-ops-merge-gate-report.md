# P2-Foundation Merge Gate — Adversarial Review

Branch `feat/p2-foundation-class-ops` (2 commits) → `main`. Read-only review.
Diff: `main...HEAD`. Reviewer posture: hostile-to-defects, evidence-first.

## Scope
- New: `apps/api/src/{class,course,room}/*`, root `router.ts`, `finance/router.ts`
  + `enrollment/router.ts` (classBatchId seam), `facility/router.ts` (`code`),
  2 migrations, `schema.prisma`, `packages/auth`, `test/db.ts` (seedClassBatch),
  13 P1 test files, docs.
- LOC: ~+1100 / -64.

## Overall Assessment
Solid, internally-consistent feature. The primary gate concern — the P1↔P2
seam (receiptCreate/enroll must resolve a real same-facility ClassBatch) — is
**CONFIRMED sound** on every path. RLS, permission wiring, atomic class-code
counter, idempotent regeneration, ICT conversion, and the P1 test migration are
all correct. No Critical or High defects. The real findings are a small cluster
of Medium robustness/invariant gaps concentrated in the room-conflict and
range-bounding logic, all on the trusted-GĐĐT write path.

---

## Findings (ranked)

### M1 — Room double-booking invariant NOT enforced on regenerate/extend — Medium — CONFIRMED
`apps/api/src/class/schedule-router.ts:47-70`. `classBatch.create` enforces the
room+time CONFLICT rule (`class-batch-router.ts:164-181`), but
`schedule.generateSessions` — which can extend `endDate` and materialize new
sessions in the extended window — performs **no room-conflict check at all**.
An extend into a window where another class already occupies the same room
silently creates overlapping `ClassSession` rows. Same business rule the create
path bothers to enforce, bypassed on a sibling procedure of the same feature; no
test covers it. This is the classic "passes CI, breaks in prod" invariant hole.
- Fix: extract the create-path conflict check into a shared helper and run it in
  `generateSessions` against the newly-planned sessions before `createMany`.

### M2 — Unbounded date range → unbounded session generation (resource exhaustion) — Medium — CONFIRMED
`class-batch-router.ts:99-101` and `schedule-router.ts` accept any
`[startDate,endDate]` with no maximum span. `planClassSessions`
(`generate-sessions.ts:45`) builds one array element per matching day, then
`createMany`s all of them. `endDate: '9999-12-31'` yields hundreds of thousands
of objects + a giant insert in one transaction — an OOM / DB-load vector from a
single mistyped or malicious GĐĐT request.
- Fix: reject spans beyond a sane cap (e.g. > ~2 years) with `BAD_REQUEST` in
  both `classBatchCreateInput` handling and `generateSessions`.

### M3 — TOCTOU race on room-conflict check (concurrent creates) — Medium — CONFIRMED
`withFacility` runs at Postgres default **READ COMMITTED**
(`packages/db/src/index.ts:66`, no isolation override). Two concurrent
`classBatch.create` for the same room+overlapping time each read
`existingRoomSessions` (neither sees the other's uncommitted rows), both pass the
check, both insert — no DB unique/exclusion constraint backstops it, so both
commit and the room is double-booked. The class-code counter is race-safe (row
lock via upsert); the room check is not.
- Fix: add a Postgres exclusion constraint on room+time range, or serialize via
  an advisory/row lock on the room before the check.

### L1 — `facility.code` / `room.code` uniqueness violation surfaces as 500 — Low — CONFIRMED
`facility/router.ts` create (explicit `code`) and `room/router.ts` create hit
`@@unique`/`@unique` with no catch → Prisma P2002 → tRPC `INTERNAL_SERVER_ERROR`
instead of a clean `CONFLICT`/`BAD_REQUEST`. Auto-derived facility codes are
collision-safe; only explicit-code callers are affected.
- Fix: catch P2002 and rethrow as `conflict(...)`.

### L2 — Intra-create self-overlap not checked — Low — SUSPECTED
`class-batch-router.ts:164-181` compares planned sessions only against *other*
classes. Two overlapping slots on the same weekday in the same room within one
create are not flagged. Unusual input; low impact.
- Fix: also check planned-vs-planned overlap (or dedupe slot pattern up front).

### I1 — `cmc_app` DELETE grant on all new tables exceeds runtime need — Informational
Migration 1 grants `DELETE` on Course/Room/ClassBatch/ScheduleSlot/ClassSession
to `cmc_app` purely for the test harness `cleanupFacility`; the app never
deletes these at runtime. Matches the project's established wave-A pattern, so
not a regression, but it is broader than least-privilege. Documented as accepted.

---

## CONFIRMED Sound (do not regress when fixing the above)

1. **Seam invariant (lens 1).** `finance.receiptCreate` guards `!classBatchId →
   BAD_REQUEST` (`finance/router.ts:584`) *before* the findFirst
   (`:596-601`), so no `id: undefined` Prisma "match-first-row" bypass.
   `enrollment.enroll` requires `classBatchId` (`z.string().min(1)`) and
   validates same-facility existence (`enrollment/router.ts:58-63`). Both run
   inside `withFacility` (RLS-scoped). Cross-facility ids return NOT_FOUND
   (tested, edge case 5).
2. **Non-UUID ids are safe.** All `id` columns are `TEXT` (not `@db.Uuid`), so a
   non-UUID `classBatchId` returns NOT_FOUND rather than a Postgres cast 500.
3. **Class code atomicity (lens 3).** Per-(facility,program,year) counter via
   `upsert increment` serializes concurrent creates on the row lock;
   `nextClassBatchCode(value-1)` renders `seq = value`; `@@unique([facilityId,
   code])` backstops. Concurrency test (edge case 3) passes by construction.
   `seedClassBatch` shares the same counter, so seeded + real creates never
   collide on sequence.
4. **Idempotent regeneration (lens 2).** `@@unique([classBatchId,
   scheduleSlotId, sessionDate])` + `createMany({ skipDuplicates: true })` is the
   real de-dupe; `scheduleSlotId` is always populated in practice (slots created
   with ids), so the NULLS-DISTINCT caveat is not reached. Inverted range →
   empty plan; caller rejects `start>end` with BAD_REQUEST. `sessionsCreated`
   computed from before/after counts is accurate.
5. **Conflict boundary (lens 2).** Half-open overlap `p.start < e.end && e.start
   < p.end` → touching edges (back-to-back) do NOT conflict; consistent with the
   passing edge-case-4 tests.
6. **ICT conversion.** `ictToUtc`/`ictDateOnlyOf` round-trip correctly;
   `weekdayOf` uses `Date.UTC` on the bare Y-M-D (no spurious TZ shift). Stored
   instants match the ICT wall-clock (edge case 8).
7. **RLS (lens 4).** All 5 facility-scoped tables + `ClassBatchCodeCounter` have
   ENABLE RLS + `facility_isolation` USING/WITH CHECK; `current_setting(...,
   true)` returns NULL when unset → fail-closed. Counter is correctly RLS-enabled
   (real facilityId, not a global sentinel).
8. **Migration safety (lens 4b).** Orphaned P1 `Receipt.classBatchId` nulled,
   `Enrollment.classBatchId` rows deleted before FK add (dev/test DB, no prod
   data). `Facility.code` backfilled from `id` before NOT NULL + unique. Grants:
   SELECT/INSERT via wave-A defaults; explicit DELETE (+ UPDATE on counter and,
   in migration 2, on ClassBatch for the endDate-extend path). UPDATE correctly
   withheld from ClassSession (no update path yet) — least-privilege there.
9. **P1 regression (lens 5).** Zero assertion lines changed across 13 test files
   (`grep` of `[-+].*expect|toBe|...` = empty). Edits only thread real seeded
   `classBatchId`s in place of free-text strings. `renewal-reuse` correctly uses
   two distinct batches to preserve its "different class" semantic;
   `reserved-active` shares one batch safely. `cleanupFacility` delete order
   respects the new RESTRICT FKs (enrollment→classBatch before classBatch;
   sessions/slots before classBatch; classBatch before course).
10. **Permission wiring (lens 6).** New perms gated via `requirePermission` →
    `can()`; rosters = `['giam_doc_dao_tao']` + `super_admin` registry bypass. No
    hardcoded role arrays in routers. FORBIDDEN path tested (edge case, line 369).

---

## Metrics
- Type safety: strict TS, no `any`/suppressions introduced in the diff.
- Test coverage: new feature well-covered (21 cases incl. concurrency, RLS,
  conflict boundary, seam, ICT). Gaps: no test for M1 (regenerate conflict) or
  M2 (range cap). Not run here (integration tests require live `cmc_app` DB).
- Lint: not run (read-only).

## Severity Counts
- Critical: 0
- High: 0
- Medium: 3 (M1 regenerate conflict gap, M2 unbounded range, M3 room TOCTOU)
- Low: 2 (L1 code-collision 500, L2 self-overlap)
- Informational: 1 (I1 DELETE grant breadth)

## Verdict: MERGE-READY (with required follow-ups)

The merge-gating invariant (the seam) and all lens-1/3/4/4b/5/6 concerns are
CONFIRMED sound; no Critical/High. The three Medium items are genuine defects but
sit on the trusted-GĐĐT write path and do not compromise tenant isolation or the
seam. Recommend merging **only if M1 and M2 are tracked as immediate
follow-ups** — M1 in particular is an invariant the feature enforces elsewhere,
so leaving it is inconsistent and prod-risky. If the reviewer treats
room-double-booking as a hard invariant, downgrade to FIX-BEFORE-MERGE for M1.

## Unresolved Questions
1. Is room double-booking a hard business invariant (→ M1/M3 blocking) or a soft
   warning acceptable for the Foundation phase?
2. Is there an expected maximum class duration to size the M2 range cap?

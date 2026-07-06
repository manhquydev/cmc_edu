-- P2-Foundation — class operations data model (docs/26 WF-P2-01, TL19 §1-2,
-- QĐ 0036, ADR 0042). Hand-written (like every prior remediation-wave
-- migration in this project — `prisma migrate dev` is non-interactive here).
--
-- Adds: Program/SessionStatus enums; Course/Room/ClassBatch/ScheduleSlot/
-- ClassSession/ClassBatchCodeCounter tables; `Facility.code` (the class-code
-- format's `{facility.code}` component, missing from P1); real FKs for
-- `Receipt.classBatchId` (nullable) and `Enrollment.classBatchId` (required) —
-- both were opaque scalars in P1. RLS + `cmc_app` grants for every new
-- facility-scoped table.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "Program" AS ENUM ('UCREA', 'BRIGHT_IG', 'BLACK_HOLE');
CREATE TYPE "SessionStatus" AS ENUM ('planned', 'confirmed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Facility.code (P2-Foundation addition — QĐ 0036 class-code format).
-- Backfilled from `id` rather than `name` (arbitrary display text, not a safe
-- code) so existing rows (e.g. dev-DB test fixtures) get a unique, non-null
-- value before the column and its unique index are enforced.
-- ---------------------------------------------------------------------------

ALTER TABLE "Facility" ADD COLUMN "code" TEXT;
UPDATE "Facility" SET "code" = 'FAC-' || upper(substr(replace(id, '-', ''), 1, 8))
  WHERE "code" IS NULL;
ALTER TABLE "Facility" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Facility_code_key" ON "Facility"("code");

-- ---------------------------------------------------------------------------
-- New class-operations tables
-- ---------------------------------------------------------------------------

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassBatch" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "endDate" TIMESTAMPTZ(3) NOT NULL,
    "roomId" TEXT,
    "teacherId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "classBatchId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "classBatchId" TEXT NOT NULL,
    "scheduleSlotId" TEXT,
    "sessionDate" TIMESTAMPTZ(3) NOT NULL,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'planned',
    "isMakeup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassBatchCodeCounter" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassBatchCodeCounter_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX "Course_facilityId_idx" ON "Course"("facilityId");

CREATE INDEX "Room_facilityId_idx" ON "Room"("facilityId");
CREATE UNIQUE INDEX "Room_facilityId_code_key" ON "Room"("facilityId", "code");

CREATE INDEX "ClassBatch_facilityId_idx" ON "ClassBatch"("facilityId");
CREATE INDEX "ClassBatch_courseId_idx" ON "ClassBatch"("courseId");
CREATE INDEX "ClassBatch_roomId_idx" ON "ClassBatch"("roomId");
CREATE UNIQUE INDEX "ClassBatch_facilityId_code_key" ON "ClassBatch"("facilityId", "code");

CREATE INDEX "ScheduleSlot_facilityId_idx" ON "ScheduleSlot"("facilityId");
CREATE INDEX "ScheduleSlot_classBatchId_idx" ON "ScheduleSlot"("classBatchId");

CREATE INDEX "ClassSession_facilityId_idx" ON "ClassSession"("facilityId");
CREATE INDEX "ClassSession_classBatchId_idx" ON "ClassSession"("classBatchId");
CREATE INDEX "ClassSession_scheduleSlotId_idx" ON "ClassSession"("scheduleSlotId");
CREATE INDEX "ClassSession_facilityId_sessionDate_idx" ON "ClassSession"("facilityId", "sessionDate");
-- Re-generate idempotency (WF-P2-01 acceptance: "re-generate không nhân đôi"):
-- at most one session per (classBatch, slot, calendar day).
CREATE UNIQUE INDEX "ClassSession_classBatchId_scheduleSlotId_sessionDate_key"
  ON "ClassSession"("classBatchId", "scheduleSlotId", "sessionDate");

CREATE INDEX "ClassBatchCodeCounter_facilityId_idx" ON "ClassBatchCodeCounter"("facilityId");
CREATE UNIQUE INDEX "ClassBatchCodeCounter_facilityId_program_year_key"
  ON "ClassBatchCodeCounter"("facilityId", "program", "year");

CREATE INDEX "Enrollment_classBatchId_idx" ON "Enrollment"("classBatchId");
CREATE INDEX "Receipt_classBatchId_idx" ON "Receipt"("classBatchId");

-- ---------------------------------------------------------------------------
-- Foreign keys.
--
-- Defensive cleanup FIRST: `ClassBatch` does not exist before this migration,
-- so ANY pre-existing `Receipt.classBatchId`/`Enrollment.classBatchId` value
-- (P1 fixtures used opaque free-text strings, e.g. "class-batch-approve-1")
-- is necessarily orphaned — it cannot reference a real row. `Receipt.classBatchId`
-- is nullable — null it out. `Enrollment.classBatchId` is NOT NULL — such rows
-- cannot be repaired and are deleted (docs/26: "dev DB recreate" — this is a
-- dev/test database, no production data exists yet for either table).
-- ---------------------------------------------------------------------------

UPDATE "Receipt" SET "classBatchId" = NULL WHERE "classBatchId" IS NOT NULL;
DELETE FROM "Enrollment" WHERE "classBatchId" IS NOT NULL;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_classBatchId_fkey"
  FOREIGN KEY ("classBatchId") REFERENCES "ClassBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classBatchId_fkey"
  FOREIGN KEY ("classBatchId") REFERENCES "ClassBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_classBatchId_fkey"
  FOREIGN KEY ("classBatchId") REFERENCES "ClassBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classBatchId_fkey"
  FOREIGN KEY ("classBatchId") REFERENCES "ClassBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_scheduleSlotId_fkey"
  FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ADR 0042 — Postgres Row-Level Security, extended to every new
-- facility-scoped table. Same shape as the wave-1 migration's policies:
-- `USING (facility_id = current_setting('app.current_facility_id', true) OR
-- bypass = 'on')`, set transaction-LOCAL by `withFacility()` (packages/db).
--
-- `ClassBatchCodeCounter` IS RLS-enabled (unlike `ReceiptCodeCounter`):
-- its `facilityId` is a REAL per-facility value (not a global sentinel), so
-- the policy correctly accepts the upsert performed inside `withFacility`.
-- ---------------------------------------------------------------------------

ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Course"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Room"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "ClassBatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "ClassBatch"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "ScheduleSlot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "ScheduleSlot"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "ClassSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "ClassSession"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "ClassBatchCodeCounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "ClassBatchCodeCounter"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

-- ---------------------------------------------------------------------------
-- `cmc_app` grants. Wave-A (privilege hardening) narrowed FUTURE-table default
-- privileges to SELECT/INSERT only (`ALTER DEFAULT PRIVILEGES ... GRANT
-- SELECT, INSERT ON TABLES`), so every table created above already has
-- SELECT/INSERT — this section adds only the extra verbs each table needs:
--   - DELETE on every new table: the test harness (apps/api/src/test/db.ts
--     `cleanupFacility`) deletes facility-scoped rows through the same
--     `cmc_app` connection the app uses, same rationale as every other
--     facility-scoped table (wave-A migration comment).
--   - UPDATE on `ClassBatchCodeCounter` only: `classBatch.create`'s atomic
--     counter increment is an upsert (INSERT .. ON CONFLICT DO UPDATE), the
--     same shape as `ReceiptCodeCounter`. No other new table has an UPDATE
--     mutation yet (YAGNI — `schedule.generateSessions` only inserts new
--     sessions; attendance/status flips are a later phase).
-- ---------------------------------------------------------------------------

GRANT DELETE ON "Course" TO "cmc_app";
GRANT DELETE ON "Room" TO "cmc_app";
GRANT DELETE ON "ClassBatch" TO "cmc_app";
GRANT DELETE ON "ScheduleSlot" TO "cmc_app";
GRANT DELETE ON "ClassSession" TO "cmc_app";
GRANT UPDATE, DELETE ON "ClassBatchCodeCounter" TO "cmc_app";

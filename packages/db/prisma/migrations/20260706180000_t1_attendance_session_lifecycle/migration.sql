-- T1 (docs/26 phase-02, TL19 §5, ADR 0038 Tier reachability C1 fix):
-- attendance data model + the `ClassSession` UPDATE grant needed for
-- classSession.cancel/confirm (WF-P2-02). Hand-written (like every prior
-- migration in this project — `prisma migrate dev` is non-interactive here).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late');

-- ---------------------------------------------------------------------------
-- Attendance table
-- ---------------------------------------------------------------------------

CREATE TABLE "Attendance" (
    "id"             TEXT NOT NULL,
    "facilityId"     TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "enrollmentId"   TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "status"         "AttendanceStatus" NOT NULL,
    "markedById"     TEXT NOT NULL,
    "markedAt"       TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attendance_facilityId_idx" ON "Attendance"("facilityId");
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");
-- Re-mark is an UPSERT (last-write-wins) keyed on this pair (TL19 §5).
CREATE UNIQUE INDEX "Attendance_classSessionId_enrollmentId_key"
  ON "Attendance"("classSessionId", "enrollmentId");

ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classSessionId_fkey"
  FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ADR 0042 — Postgres Row-Level Security (same shape as every prior
-- facility-scoped table).
-- ---------------------------------------------------------------------------

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Attendance"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

-- ---------------------------------------------------------------------------
-- `cmc_app` grants.
--
-- Wave-A privilege hardening narrowed FUTURE-table default privileges to
-- SELECT/INSERT only, so `Attendance` already has SELECT/INSERT — this adds
-- UPDATE only (re-mark is an upsert, TL19 §5). Deliberately NO DELETE grant:
-- attendance rows are never deleted by the application (only test-harness
-- teardown removes them, via the privileged migration-role connection, same
-- pattern as RefundRecord/AuditLog — see apps/api/src/test/db.ts).
--
-- `ClassSession` did not previously have an UPDATE grant (only
-- SELECT/INSERT/DELETE from the P2-Foundation migration) — this phase adds
-- `classSession.cancel`/`confirm`, which flip `status` in place.
-- ---------------------------------------------------------------------------

GRANT UPDATE ON "Attendance" TO "cmc_app";
GRANT UPDATE ON "ClassSession" TO "cmc_app";

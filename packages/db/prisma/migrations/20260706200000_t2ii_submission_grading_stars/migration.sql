-- T2-II (docs/26 WF-P2-03/05/06, TL19 §3/§6, ADR 0038, docs/decisions/0042):
-- Submission (annotate/submit), FinalGrade (per student x classBatch x ICT
-- month), StarTransaction (append-mindset star ledger). Hand-written (like
-- every prior migration in this project — `prisma migrate dev` is
-- non-interactive here).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "SubmissionStatus" AS ENUM ('draft', 'submitted', 'graded');
CREATE TYPE "StarTxnType" AS ENUM ('homework_completed', 'gift_redeemed', 'gift_rejected_refund', 'manual');

-- ---------------------------------------------------------------------------
-- Submission
-- ---------------------------------------------------------------------------

CREATE TABLE "Submission" (
    "id"              TEXT NOT NULL,
    "facilityId"      TEXT NOT NULL,
    "exerciseId"      TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "annotationLayer" JSONB NOT NULL,
    "answerText"      TEXT,
    "version"         INTEGER NOT NULL DEFAULT 1,
    "status"          "SubmissionStatus" NOT NULL DEFAULT 'draft',
    "submittedAt"     TIMESTAMPTZ(3),
    "gradedAt"        TIMESTAMPTZ(3),
    "score"           INTEGER,
    "gradedById"      TEXT,
    "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updatedAt"       TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- One submission per (exercise, student) — re-drafting updates this row.
CREATE UNIQUE INDEX "Submission_exerciseId_studentId_key" ON "Submission"("exerciseId", "studentId");
CREATE INDEX "Submission_facilityId_idx" ON "Submission"("facilityId");
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");
CREATE INDEX "Submission_exerciseId_idx" ON "Submission"("exerciseId");

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- FinalGrade
-- ---------------------------------------------------------------------------

CREATE TABLE "FinalGrade" (
    "id"           TEXT NOT NULL,
    "facilityId"   TEXT NOT NULL,
    "studentId"    TEXT NOT NULL,
    "classBatchId" TEXT NOT NULL,
    "period"       TEXT NOT NULL,
    "score"        DOUBLE PRECISION NOT NULL,
    "updatedAt"    TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FinalGrade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinalGrade_studentId_classBatchId_period_key"
  ON "FinalGrade"("studentId", "classBatchId", "period");
CREATE INDEX "FinalGrade_facilityId_idx" ON "FinalGrade"("facilityId");
CREATE INDEX "FinalGrade_classBatchId_idx" ON "FinalGrade"("classBatchId");

ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_classBatchId_fkey"
  FOREIGN KEY ("classBatchId") REFERENCES "ClassBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- StarTransaction
-- ---------------------------------------------------------------------------

CREATE TABLE "StarTransaction" (
    "id"         TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "studentId"  TEXT NOT NULL,
    "type"       "StarTxnType" NOT NULL,
    "amount"     INTEGER NOT NULL,
    "refType"    TEXT,
    "refId"      TEXT,
    "createdAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "StarTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StarTransaction_facilityId_idx" ON "StarTransaction"("facilityId");
CREATE INDEX "StarTransaction_studentId_idx" ON "StarTransaction"("studentId");

ALTER TABLE "StarTransaction" ADD CONSTRAINT "StarTransaction_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- H2-style hand-added partial unique index (not representable as a Prisma
-- `@@unique` — Postgres partial indexes take a WHERE clause): backstops the
-- "award stars exactly once per graded Submission, even across regrades"
-- invariant at the DB layer, behind the app-level check in
-- `submission.grade` (findFirst-then-create inside the same transaction).
CREATE UNIQUE INDEX "StarTransaction_homework_completed_ref_key"
  ON "StarTransaction"("refType", "refId")
  WHERE "type" = 'homework_completed' AND "refType" IS NOT NULL AND "refId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ADR 0042 — Postgres Row-Level Security (child data / soft-money —
-- facilityId + RLS on all three tables, unlike the global Exercise/
-- CurriculumUnit catalogs).
-- ---------------------------------------------------------------------------

ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Submission"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "FinalGrade" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "FinalGrade"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "StarTransaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "StarTransaction"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

-- ---------------------------------------------------------------------------
-- `cmc_app` grants.
--
-- Wave-A default privileges already give new tables SELECT/INSERT. This adds
-- UPDATE where the app mutates rows in place:
--   - Submission: saveDraft (re-draft update), submit, grade all UPDATE.
--   - FinalGrade: `submission.grade`'s recompute upserts in place.
--   - StarTransaction: append-only (create only) — no UPDATE grant, same
--     rationale as RefundRecord/Attendance (no in-place edits by design).
-- DELETE is deliberately NOT granted on any of the three (same rationale as
-- Attendance/RefundRecord/AuditLog) — test-harness teardown uses the
-- privileged migration-role connection instead (see apps/api/src/test/db.ts).
-- ---------------------------------------------------------------------------

GRANT UPDATE ON "Submission" TO "cmc_app";
GRANT UPDATE ON "FinalGrade" TO "cmc_app";

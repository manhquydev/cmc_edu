-- LMS foundation: EnrollmentUnitRange + unit neo on ClassBatch + orderGlobal on CurriculumUnit.
-- All-or-nothing: tables/columns + FORCE RLS + grants (ADR 0042).

-- 1) CurriculumUnit.orderGlobal (backfill then NOT NULL + unique)
ALTER TABLE "CurriculumUnit" ADD COLUMN IF NOT EXISTS "orderGlobal" INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY program
      ORDER BY level ASC, "monthIndex" ASC,
        CASE "unitType" WHEN 'LESSON' THEN 0 WHEN 'REVIEW' THEN 1 ELSE 2 END,
        "createdAt" ASC, id ASC
    )::int AS rn
  FROM "CurriculumUnit"
)
UPDATE "CurriculumUnit" cu
SET "orderGlobal" = ranked.rn
FROM ranked
WHERE cu.id = ranked.id AND (cu."orderGlobal" IS NULL OR cu."orderGlobal" = 0);

-- Any still-null (empty table edge): leave for apps to seed; for NOT NULL set sentinel per row if needed
UPDATE "CurriculumUnit" SET "orderGlobal" = 1 WHERE "orderGlobal" IS NULL;

ALTER TABLE "CurriculumUnit" ALTER COLUMN "orderGlobal" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumUnit_program_orderGlobal_key"
  ON "CurriculumUnit"("program", "orderGlobal");

CREATE INDEX IF NOT EXISTS "CurriculumUnit_program_orderGlobal_idx"
  ON "CurriculumUnit"("program", "orderGlobal");

-- 2) ClassBatch unit neo (nullable for legacy rows; spike create path sets them)
ALTER TABLE "ClassBatch" ADD COLUMN IF NOT EXISTS "startUnitId" TEXT;
ALTER TABLE "ClassBatch" ADD COLUMN IF NOT EXISTS "currentUnitId" TEXT;
ALTER TABLE "ClassBatch" ADD COLUMN IF NOT EXISTS "currentUnitAnchor" DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClassBatch_startUnitId_fkey'
  ) THEN
    ALTER TABLE "ClassBatch"
      ADD CONSTRAINT "ClassBatch_startUnitId_fkey"
      FOREIGN KEY ("startUnitId") REFERENCES "CurriculumUnit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClassBatch_currentUnitId_fkey'
  ) THEN
    ALTER TABLE "ClassBatch"
      ADD CONSTRAINT "ClassBatch_currentUnitId_fkey"
      FOREIGN KEY ("currentUnitId") REFERENCES "CurriculumUnit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ClassBatch_startUnitId_idx" ON "ClassBatch"("startUnitId");
CREATE INDEX IF NOT EXISTS "ClassBatch_currentUnitId_idx" ON "ClassBatch"("currentUnitId");

-- 3) Enrollment.archivedAt
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ(3);

-- 4) EnrollmentUnitRange
CREATE TABLE IF NOT EXISTS "EnrollmentUnitRange" (
  "id"              TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"      TEXT           NOT NULL,
  "enrollmentId"    TEXT           NOT NULL,
  "fromOrderGlobal" INTEGER        NOT NULL,
  "toOrderGlobal"   INTEGER        NOT NULL,
  "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnrollmentUnitRange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnrollmentUnitRange_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EnrollmentUnitRange_order_check"
    CHECK ("fromOrderGlobal" <= "toOrderGlobal")
);

CREATE INDEX IF NOT EXISTS "EnrollmentUnitRange_facilityId_idx"
  ON "EnrollmentUnitRange"("facilityId");
CREATE INDEX IF NOT EXISTS "EnrollmentUnitRange_enrollmentId_idx"
  ON "EnrollmentUnitRange"("enrollmentId");

ALTER TABLE "EnrollmentUnitRange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentUnitRange" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EnrollmentUnitRange_facility_isolation" ON "EnrollmentUnitRange";
CREATE POLICY "EnrollmentUnitRange_facility_isolation" ON "EnrollmentUnitRange"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "EnrollmentUnitRange" TO cmc_app;

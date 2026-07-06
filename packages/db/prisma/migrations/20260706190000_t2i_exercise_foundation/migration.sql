-- T2-I (docs/26 WF-P2-04, TL19 §1/§3, QĐ 0021/0022): CurriculumUnit +
-- Exercise, both GLOBAL catalogs (no facilityId, no RLS — see the model doc
-- comments in schema.prisma) plus `ClassSession.curriculumUnitId`
-- (classSession.assignUnit, docs/26 WF-P2-01 remainder). Hand-written (like
-- every prior migration in this project — `prisma migrate dev` is
-- non-interactive here).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "UnitType" AS ENUM ('LESSON', 'REVIEW');
CREATE TYPE "ExerciseType" AS ENUM ('homework', 'test_entrance', 'test_periodic');
CREATE TYPE "ExerciseStatus" AS ENUM ('draft', 'published', 'closed');

-- ---------------------------------------------------------------------------
-- CurriculumUnit
-- ---------------------------------------------------------------------------

CREATE TABLE "CurriculumUnit" (
    "id"         TEXT NOT NULL,
    "program"    "Program" NOT NULL,
    "level"      INTEGER NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "unitType"   "UnitType" NOT NULL,
    "title"      TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "CurriculumUnit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CurriculumUnit_program_level_monthIndex_idx"
  ON "CurriculumUnit"("program", "level", "monthIndex");

-- ---------------------------------------------------------------------------
-- Exercise
-- ---------------------------------------------------------------------------

CREATE TABLE "Exercise" (
    "id"               TEXT NOT NULL,
    "curriculumUnitId" TEXT NOT NULL,
    "type"             "ExerciseType" NOT NULL,
    "basePdfRef"       TEXT NOT NULL,
    "maxScore"         INTEGER NOT NULL DEFAULT 10,
    "starReward"       INTEGER NOT NULL DEFAULT 10,
    "status"           "ExerciseStatus" NOT NULL DEFAULT 'draft',
    "createdById"      TEXT NOT NULL,
    "createdAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updatedAt"        TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- One exercise per (unit, type) — TL19 §3.
CREATE UNIQUE INDEX "Exercise_curriculumUnitId_type_key" ON "Exercise"("curriculumUnitId", "type");
CREATE INDEX "Exercise_curriculumUnitId_idx" ON "Exercise"("curriculumUnitId");

ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_curriculumUnitId_fkey"
  FOREIGN KEY ("curriculumUnitId") REFERENCES "CurriculumUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ClassSession.curriculumUnitId (classSession.assignUnit)
-- ---------------------------------------------------------------------------

ALTER TABLE "ClassSession" ADD COLUMN "curriculumUnitId" TEXT;
CREATE INDEX "ClassSession_curriculumUnitId_idx" ON "ClassSession"("curriculumUnitId");
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_curriculumUnitId_fkey"
  FOREIGN KEY ("curriculumUnitId") REFERENCES "CurriculumUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- No RLS on CurriculumUnit/Exercise (QĐ 0021/0022, docs/19 §1/§3): both are
-- global catalogs, not facility-scoped — neither carries a `facilityId`
-- column, so a `current_setting('app.current_facility_id')` policy would
-- reject every read/write. `cmc_app` grants below rely on the least-privilege
-- default (`p1_remediation_wavea_privilege_hardening`: new tables auto-get
-- SELECT/INSERT for `cmc_app`, not UPDATE/DELETE) plus one explicit grant:
--   - CurriculumUnit: read-only from the app (curriculumUnit.list) + seed
--     insert — default SELECT/INSERT is sufficient, no extra grant needed.
--   - Exercise: `exercise.publish`/`exercise.close` UPDATE its `status` in
--     place — needs an explicit UPDATE grant.
--   - ClassSession already has an UPDATE grant from the T1 migration
--     (classSession.cancel/confirm) — `assignUnit`'s UPDATE reuses it.
-- ---------------------------------------------------------------------------

GRANT UPDATE ON "Exercise" TO "cmc_app";

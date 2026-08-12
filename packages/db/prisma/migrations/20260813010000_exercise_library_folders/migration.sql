-- Exercise library: global ExerciseFolder (no facilityId, no RLS) + detach
-- Exercise from CurriculumUnit, add title / folderId / orderInFolder.
-- Three steps: table+GRANT, nullable columns + sequential backfill + NOT NULL,
-- then unique. Unique before backfill would fail on a shared default folder.

-- ---------------------------------------------------------------------------
-- Step 1 — folder table. Wave-A defaults already GRANT SELECT/INSERT on new
-- tables; UPDATE must be explicit or rename/archive is rejected.
-- Do NOT ENABLE/FORCE RLS. Catalog is system-wide (QĐ 0021/0022).
-- ---------------------------------------------------------------------------

CREATE TABLE "ExerciseFolder" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "archivedAt"  TIMESTAMPTZ(3),
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "ExerciseFolder_pkey" PRIMARY KEY ("id")
);

GRANT UPDATE ON "ExerciseFolder" TO "cmc_app";

-- ---------------------------------------------------------------------------
-- Step 2 — default folder, nullable columns, sequential backfill, then NOT NULL.
-- ---------------------------------------------------------------------------

INSERT INTO "ExerciseFolder" ("id", "name", "createdById")
VALUES (gen_random_uuid()::text, 'Chưa phân loại', 'system-migration');

ALTER TABLE "Exercise" ADD COLUMN "folderId" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "orderInFolder" INTEGER;
ALTER TABLE "Exercise" ADD COLUMN "title" TEXT;

WITH numbered AS (
  SELECT
    e."id",
    ROW_NUMBER() OVER (ORDER BY e."createdAt" ASC, e."id" ASC) AS rn,
    CASE
      WHEN u."title" IS NULL OR btrim(u."title") = '' THEN e."type"::text
      ELSE u."title" || ' — ' || e."type"::text
    END AS derived_title
  FROM "Exercise" e
  LEFT JOIN "CurriculumUnit" u ON u."id" = e."curriculumUnitId"
)
UPDATE "Exercise" AS e
SET
  "folderId" = (SELECT "id" FROM "ExerciseFolder" WHERE "name" = 'Chưa phân loại' ORDER BY "createdAt" ASC LIMIT 1),
  "orderInFolder" = numbered.rn,
  "title" = numbered.derived_title
FROM numbered
WHERE e."id" = numbered."id";

ALTER TABLE "Exercise" ALTER COLUMN "folderId" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "orderInFolder" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "ExerciseFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Step 3 — unique AFTER backfill; drop unit FK / unique / column.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "Exercise_folderId_orderInFolder_key" ON "Exercise"("folderId", "orderInFolder");
CREATE INDEX "Exercise_folderId_idx" ON "Exercise"("folderId");

ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_curriculumUnitId_fkey";
DROP INDEX "Exercise_curriculumUnitId_type_key";
DROP INDEX "Exercise_curriculumUnitId_idx";
ALTER TABLE "Exercise" DROP COLUMN "curriculumUnitId";

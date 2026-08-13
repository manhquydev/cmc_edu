-- Undo the A1 backfill that copied ClassBatch.teacherId onto every session.
-- NULL on ClassSession.teacherId now means "inherit the class teacher".
-- Keep rows that already differ from the class (a real per-session override).

UPDATE "ClassSession" AS cs
SET "teacherId" = NULL
FROM "ClassBatch" AS cb
WHERE cs."classBatchId" = cb."id"
  AND cs."teacherId" IS NOT NULL
  AND cs."teacherId" = cb."teacherId";

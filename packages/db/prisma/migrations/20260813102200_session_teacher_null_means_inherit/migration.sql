-- Repair pass for environments that applied the FIRST revision of the sibling
-- migration (20260813093900), which backfilled ClassBatch.teacherId onto every
-- session. That revision no longer backfills, so on a fresh database this
-- statement matches zero rows and is a no-op — it exists only so an already
-- migrated dev database converges on the same meaning.
--
-- NULL on ClassSession.teacherId means "inherit the class teacher". Copying the
-- class teacher onto each session freezes a guess: a later
-- classBatch.assignTeacher would then leave every existing session pointing at
-- the old teacher forever.
--
-- Rows whose teacher already differs from the class are real per-session
-- overrides (a substitute teacher) and are left untouched.

UPDATE "ClassSession" AS cs
SET "teacherId" = NULL
FROM "ClassBatch" AS cb
WHERE cs."classBatchId" = cb."id"
  AND cs."teacherId" IS NOT NULL
  AND cs."teacherId" = cb."teacherId";

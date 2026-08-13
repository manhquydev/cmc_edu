-- ClassSession unique key follows the calendar (class, day, start instant),
-- not the ScheduleSlot row id. Archiving a slot must not let regenerate
-- create a second meeting for the same day+time.
--
-- Gate first: refuse the unique-index swap when any (class, day, start)
-- group already has more than one row. The rest of this file stays in the
-- same Prisma migration transaction, so a RAISE rolls back with no half-write.

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*)::int INTO dup_count
  FROM (
    SELECT 1
    FROM "ClassSession"
    GROUP BY "classBatchId", "sessionDate", "startTime"
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to change ClassSession unique key: % duplicate (classBatchId, sessionDate, startTime) group(s). Resolve them before migrating.',
      dup_count;
  END IF;
END
$$;

DROP INDEX "ClassSession_classBatchId_scheduleSlotId_sessionDate_key";

CREATE UNIQUE INDEX "ClassSession_classBatchId_sessionDate_startTime_key"
  ON "ClassSession"("classBatchId", "sessionDate", "startTime");

ALTER TABLE "ScheduleSlot" ADD COLUMN "archivedAt" TIMESTAMPTZ(3);

-- Wave-A default is SELECT/INSERT only. Archive/update of a slot is UPDATE.
GRANT UPDATE ON "ScheduleSlot" TO "cmc_app";
-- App convention: never DELETE a ScheduleSlot (archive via archivedAt).
-- Do not REVOKE DELETE — the test harness cleanupFacility still needs it.

ALTER TABLE "ClassSession" ADD COLUMN "teacherId" TEXT;
-- NULL means inherit ClassBatch.teacherId. Do not copy the class teacher
-- here: that freezes a guess and breaks later classBatch.assignTeacher.

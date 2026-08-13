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

ALTER TABLE "ClassSession" ADD COLUMN "teacherId" TEXT;

UPDATE "ClassSession" AS cs
SET "teacherId" = cb."teacherId"
FROM "ClassBatch" AS cb
WHERE cs."classBatchId" = cb."id"
  AND cb."teacherId" IS NOT NULL;

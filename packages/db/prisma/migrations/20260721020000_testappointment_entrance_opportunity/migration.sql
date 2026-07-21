-- F5 / phase-07: entrance test appointments attach to an Opportunity (they
-- happen pre-payment, before any Student exists); periodic ones keep attaching
-- to a Student. Widen the columns, backfill/retype legacy rows, then enforce
-- exactly-one-of via a strict CHECK. Forward-only: once pre-payment entrance
-- rows exist with studentId NULL, the NOT NULL cannot be restored.

-- 1. Pre-validate: `type` is a free-text column. A stray value would make the
--    strict CHECK below reject every row and abort mid-migration with an opaque
--    error — fail early and explicitly instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TestAppointment" WHERE "type" NOT IN ('entrance', 'periodic')) THEN
    RAISE EXCEPTION 'TestAppointment migration aborted: rows with type NOT IN (entrance, periodic) exist — reconcile them first.';
  END IF;
END $$;

-- 2. Widen: studentId becomes nullable, add nullable opportunityId.
ALTER TABLE "TestAppointment" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "TestAppointment" ADD COLUMN "opportunityId" TEXT;

-- 3. Backfill legacy entrance rows: resolve the opportunity from the student's
--    creating receipt (Student.createdByReceiptId -> Receipt.opportunityId).
UPDATE "TestAppointment" ta
SET "opportunityId" = r."opportunityId"
FROM "Student" s
JOIN "Receipt" r ON r."id" = s."createdByReceiptId"
WHERE ta."type" = 'entrance'
  AND ta."studentId" = s."id"
  AND r."opportunityId" IS NOT NULL;

-- 4. Retype the entrance rows that still have no resolvable opportunity: by
--    definition a Student already existed when they were scheduled, so they are
--    really post-enrollment (periodic) tests. Their studentId satisfies the
--    periodic CHECK arm.
UPDATE "TestAppointment"
SET "type" = 'periodic'
WHERE "type" = 'entrance' AND "opportunityId" IS NULL;

-- 5. Strict CHECK — no relaxed legacy arm (a relaxed arm would permanently let
--    new entrance rows be created without an opportunity, defeating the redesign
--    at the DB layer).
ALTER TABLE "TestAppointment" ADD CONSTRAINT "TestAppointment_target_check"
  CHECK (
    ("type" = 'entrance' AND "opportunityId" IS NOT NULL)
    OR ("type" = 'periodic' AND "studentId" IS NOT NULL)
  );

-- 6. Index the new lookup path (entrance appointments by opportunity).
CREATE INDEX "TestAppointment_facilityId_opportunityId_idx" ON "TestAppointment"("facilityId", "opportunityId");

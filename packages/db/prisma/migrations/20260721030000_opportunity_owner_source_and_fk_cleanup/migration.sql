-- phase-10 (PO decision #3 + F13/F15): add opportunity owner + source, drop the
-- dead ParentMeeting.remindedAt column, and add the missing student FKs as
-- defense-in-depth (students are never hard-deleted, only withdrawn).

-- 1. Pre-validate: the three post-sale studentId scalars must have no orphan
--    rows, or the FK creation below would fail mid-migration. Abort early with
--    a clear message + count instead. (TestAppointment.studentId is nullable
--    after phase-07 — only non-null values are constrained.)
DO $$
DECLARE
  pm_orphans int;
  ta_orphans int;
  as_orphans int;
BEGIN
  SELECT count(*) INTO pm_orphans FROM "ParentMeeting" m
    WHERE NOT EXISTS (SELECT 1 FROM "Student" s WHERE s."id" = m."studentId");
  SELECT count(*) INTO ta_orphans FROM "TestAppointment" t
    WHERE t."studentId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Student" s WHERE s."id" = t."studentId");
  SELECT count(*) INTO as_orphans FROM "AfterSaleCase" a
    WHERE NOT EXISTS (SELECT 1 FROM "Student" s WHERE s."id" = a."studentId");
  IF pm_orphans > 0 OR ta_orphans > 0 OR as_orphans > 0 THEN
    RAISE EXCEPTION 'Student FK migration aborted: orphan studentId rows — ParentMeeting=%, TestAppointment=%, AfterSaleCase=% — reconcile before adding the constraints.',
      pm_orphans, ta_orphans, as_orphans;
  END IF;
END $$;

-- 2. Opportunity owner + source.
ALTER TABLE "Opportunity" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "source" TEXT;

-- 3. Drop the dead column (all values were always NULL — zero writers ever).
ALTER TABLE "ParentMeeting" DROP COLUMN "remindedAt";

-- 4. Backfill source='walkin' for the opportunities phase-05 auto-created on a
--    walk-in receipt approval (identified by the receiptApprove audit row's
--    autoCreatedOpportunityId).
UPDATE "Opportunity" o SET "source" = 'walkin'
WHERE o."id" IN (
  SELECT a."data"->>'autoCreatedOpportunityId'
  FROM "AuditLog" a
  WHERE a."action" = 'finance.receiptApprove'
    AND a."data" ? 'autoCreatedOpportunityId'
);

-- 5. FKs. Opportunity.assignedToId -> AppUser (ON DELETE SET NULL: unassign if
--    the staff row is ever removed, mirroring Receipt.createdByAppUserId). The
--    three student scalars -> Student (ON DELETE RESTRICT: defense-in-depth).
ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParentMeeting"
  ADD CONSTRAINT "ParentMeeting_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestAppointment"
  ADD CONSTRAINT "TestAppointment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AfterSaleCase"
  ADD CONSTRAINT "AfterSaleCase_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Index the owner lookup path (KPI attribution + pipeline owner filter).
CREATE INDEX "Opportunity_facilityId_assignedToId_idx" ON "Opportunity"("facilityId", "assignedToId");

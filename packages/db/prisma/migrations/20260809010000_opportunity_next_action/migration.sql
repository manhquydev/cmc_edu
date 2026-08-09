-- P4: next-action reminder fields on Opportunity (nullable, no default).
ALTER TABLE "Opportunity" ADD COLUMN "nextActionAt" TIMESTAMPTZ NULL;
ALTER TABLE "Opportunity" ADD COLUMN "nextActionNote" TEXT;

-- Due-follow-ups lookup: facility + owner + due date.
CREATE INDEX "Opportunity_facilityId_assignedToId_nextActionAt_idx"
  ON "Opportunity" ("facilityId", "assignedToId", "nextActionAt");

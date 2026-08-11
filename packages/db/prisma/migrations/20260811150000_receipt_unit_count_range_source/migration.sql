-- Plan 3 money bridge: Receipt.unitCount + EnrollmentUnitRange.sourceReceiptId

ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "unitCount" INTEGER;

ALTER TABLE "EnrollmentUnitRange" ADD COLUMN IF NOT EXISTS "sourceReceiptId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "EnrollmentUnitRange_sourceReceiptId_key"
  ON "EnrollmentUnitRange"("sourceReceiptId");

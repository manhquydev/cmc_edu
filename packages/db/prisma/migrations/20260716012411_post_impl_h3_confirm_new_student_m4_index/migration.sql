-- AlterTable
ALTER TABLE "CompensationPolicy" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "confirmNewStudent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SalaryTier" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Receipt_facilityId_studentId_idx" ON "Receipt"("facilityId", "studentId");

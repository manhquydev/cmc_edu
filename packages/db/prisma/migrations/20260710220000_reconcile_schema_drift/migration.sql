-- Reconcile committed migration history with schema.prisma (source of truth).
-- The hand-authored migrations diverged from Prisma's generated conventions in
-- three ways; this captures the difference so a future `prisma migrate dev`
-- stops silently re-bundling it (and so the P3 cutover dump ships a clean schema):
--   1. id/updatedAt: migrations set DB-level DEFAULTs; schema.prisma generates
--      these app-side (@default(uuid())/@updatedAt) → drop the DB defaults.
--      Behaviourally inert — Prisma always supplies the value.
--   2. FK ON UPDATE: migrations omitted ON UPDATE (→ NO ACTION); Prisma emits
--      ON UPDATE CASCADE. Inert — the referenced UUID PKs are never updated.
--   3. Two real changes: QualitativeAssessment.confidence REAL→DOUBLE PRECISION
--      (safe widening) and QualitativeAssessment.classSessionId FK ON DELETE
--      RESTRICT→SET NULL (matches the already-merged optional-relation
--      declaration; deleting a ClassSession now nulls the assessment's link
--      instead of being blocked).

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_markedByAppUserId_fkey";
-- DropForeignKey
ALTER TABLE "ClassBatch" DROP CONSTRAINT "ClassBatch_createdByAppUserId_fkey";
-- DropForeignKey
ALTER TABLE "ClassBatch" DROP CONSTRAINT "ClassBatch_teacherAppUserId_fkey";
-- DropForeignKey
ALTER TABLE "QualitativeAssessment" DROP CONSTRAINT "QualitativeAssessment_classSessionId_fkey";
-- DropForeignKey
ALTER TABLE "QualitativeAssessment" DROP CONSTRAINT "QualitativeAssessment_studentId_fkey";
-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_approvedByAppUserId_fkey";
-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_createdByAppUserId_fkey";
-- DropForeignKey
ALTER TABLE "SessionEvidence" DROP CONSTRAINT "SessionEvidence_classSessionId_fkey";
-- DropForeignKey
ALTER TABLE "SessionEvidencePhoto" DROP CONSTRAINT "SessionEvidencePhoto_sessionEvidenceId_fkey";
-- AlterTable
ALTER TABLE "AfterSaleCase" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "AppUser" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "FacilityNetwork" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "Gift" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "KpiScore" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ManualAttendanceTicket" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ParentMeeting" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "Payslip" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "QualitativeAssessment" ALTER COLUMN "confidence" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ReconciliationFlag" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "detail" DROP DEFAULT;
-- AlterTable
ALTER TABLE "Reward" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "SalaryRate" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "SessionEvidence" ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ShiftGroup" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ShiftRegistration" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ShiftRegistrationEntry" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "ShiftTemplate" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "TestAppointment" ALTER COLUMN "id" DROP DEFAULT;
-- AlterTable
ALTER TABLE "TimePunch" ALTER COLUMN "id" DROP DEFAULT;
-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_createdByAppUserId_fkey" FOREIGN KEY ("createdByAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_approvedByAppUserId_fkey" FOREIGN KEY ("approvedByAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_teacherAppUserId_fkey" FOREIGN KEY ("teacherAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ClassBatch" ADD CONSTRAINT "ClassBatch_createdByAppUserId_fkey" FOREIGN KEY ("createdByAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedByAppUserId_fkey" FOREIGN KEY ("markedByAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QualitativeAssessment" ADD CONSTRAINT "QualitativeAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QualitativeAssessment" ADD CONSTRAINT "QualitativeAssessment_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SessionEvidence" ADD CONSTRAINT "SessionEvidence_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SessionEvidencePhoto" ADD CONSTRAINT "SessionEvidencePhoto_sessionEvidenceId_fkey" FOREIGN KEY ("sessionEvidenceId") REFERENCES "SessionEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

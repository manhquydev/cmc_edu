-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED', 'O5_ENROLLED');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('no_response', 'price_too_high', 'chose_competitor', 'schedule_conflict', 'not_interested', 'other');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('draft', 'approved', 'sent', 'cancelled');

-- CreateEnum
CREATE TYPE "ReceiptKind" AS ENUM ('new', 'renewal');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('reserved', 'active', 'completed', 'transferred', 'withdrawn');

-- CreateEnum
CREATE TYPE "GuardianRelation" AS ENUM ('father', 'mother', 'guardian');

-- CreateEnum
CREATE TYPE "GuardianLinkStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "StudentLifecycle" AS ENUM ('active', 'blocked_lms', 'withdrawn');

-- CreateEnum
CREATE TYPE "LoginOtpStatus" AS ENUM ('pending', 'verified', 'expired');

-- CreateEnum
CREATE TYPE "EmailTransport" AS ENUM ('graph', 'brevo');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'O1_LEAD',
    "lostReason" "LostReason",
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptCodeCounter" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptCodeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'draft',
    "kind" "ReceiptKind" NOT NULL DEFAULT 'new',
    "opportunityId" TEXT,
    "parentPhone" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "classBatchId" TEXT,
    "approvedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdByReceiptId" TEXT,
    "lifecycle" "StudentLifecycle" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAccount" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAccount" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relation" "GuardianRelation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianLinkRequest" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "studentRef" TEXT NOT NULL,
    "status" "GuardianLinkStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classBatchId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'reserved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "LoginOtpStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "transport" "EmailTransport" NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_facilityId_idx" ON "Contact"("facilityId");

-- CreateIndex
CREATE INDEX "Opportunity_facilityId_idx" ON "Opportunity"("facilityId");

-- CreateIndex
CREATE INDEX "Opportunity_contactId_idx" ON "Opportunity"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptCodeCounter_facilityId_key" ON "ReceiptCodeCounter"("facilityId");

-- CreateIndex
CREATE INDEX "ReceiptCodeCounter_facilityId_idx" ON "ReceiptCodeCounter"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_code_key" ON "Receipt"("code");

-- CreateIndex
CREATE INDEX "Receipt_facilityId_idx" ON "Receipt"("facilityId");

-- CreateIndex
CREATE INDEX "Receipt_opportunityId_idx" ON "Receipt"("opportunityId");

-- CreateIndex
CREATE INDEX "RefundRecord_receiptId_idx" ON "RefundRecord"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_createdByReceiptId_key" ON "Student"("createdByReceiptId");

-- CreateIndex
CREATE INDEX "Student_facilityId_idx" ON "Student"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAccount_phone_key" ON "ParentAccount"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_studentId_key" ON "StudentAccount"("studentId");

-- CreateIndex
CREATE INDEX "StudentAccount_parentAccountId_idx" ON "StudentAccount"("parentAccountId");

-- CreateIndex
CREATE INDEX "Guardian_facilityId_idx" ON "Guardian"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_parentAccountId_studentId_key" ON "Guardian"("parentAccountId", "studentId");

-- CreateIndex
CREATE INDEX "GuardianLinkRequest_facilityId_idx" ON "GuardianLinkRequest"("facilityId");

-- CreateIndex
CREATE INDEX "GuardianLinkRequest_parentAccountId_idx" ON "GuardianLinkRequest"("parentAccountId");

-- CreateIndex
CREATE INDEX "Enrollment_facilityId_idx" ON "Enrollment"("facilityId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE INDEX "LoginOtp_phone_idx" ON "LoginOtp"("phone");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_createdByReceiptId_fkey" FOREIGN KEY ("createdByReceiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianLinkRequest" ADD CONSTRAINT "GuardianLinkRequest_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

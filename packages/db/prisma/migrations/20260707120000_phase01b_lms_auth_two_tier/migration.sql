-- Migration: phase-01b LMS auth two-tier rework
-- Adds parent email, student password/lockout, and email-OTP support.

-- ParentAccount: optional unique email for email-OTP login flow.
ALTER TABLE "ParentAccount" ADD COLUMN "email" TEXT UNIQUE;

-- StudentAccount: password hash + lockout fields for student direct login.
ALTER TABLE "StudentAccount" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "StudentAccount" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentAccount" ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentAccount" ADD COLUMN "loginLockedUntil" TIMESTAMPTZ(3);

-- LoginOtp: make phone nullable (email-OTP rows use email, not phone).
ALTER TABLE "LoginOtp" ALTER COLUMN "phone" DROP NOT NULL;

-- LoginOtp: email identifier for email-OTP flow.
ALTER TABLE "LoginOtp" ADD COLUMN "email" TEXT;
CREATE INDEX "LoginOtp_email_idx" ON "LoginOtp"("email");

-- Receipt: capture parent email at receipt-creation time so provisioning can
-- set it on ParentAccount (email-OTP login flow, C1/phase-01b).
ALTER TABLE "Receipt" ADD COLUMN "parentEmail" TEXT;

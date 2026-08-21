-- Additive lockout for familyLogin (Wave 1). passwordHash stays nullable.
-- LoginOtp is not dropped. UPDATE on ParentAccount is already granted.

ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "loginLockedUntil" TIMESTAMP(3);

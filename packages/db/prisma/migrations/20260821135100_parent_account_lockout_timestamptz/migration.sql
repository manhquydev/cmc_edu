-- Align lockout timestamp with StudentAccount.loginLockedUntil.
ALTER TABLE "ParentAccount"
  ALTER COLUMN "loginLockedUntil" TYPE TIMESTAMPTZ(3)
  USING "loginLockedUntil" AT TIME ZONE 'UTC';

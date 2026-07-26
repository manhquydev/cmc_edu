-- Staff email/password auth: fallback login while the Entra SSO tenant is
-- unavailable. Adds credential + lockout columns to AppUser and enforces
-- case-insensitive uniqueness of non-empty login emails.

ALTER TABLE "AppUser"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loginLockedUntil" TIMESTAMPTZ(3);

-- The partial unique index below is only sound if no two accounts already
-- share a login email (case-insensitive). Fail loudly with the offending
-- emails so operators deduplicate by hand instead of the index picking an
-- arbitrary winner.
DO $$
DECLARE dup TEXT;
BEGIN
  SELECT string_agg(e, ', ') INTO dup FROM (
    SELECT lower(email) AS e
    FROM "AppUser"
    WHERE email <> ''
    GROUP BY lower(email)
    HAVING count(*) > 1
  ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'AppUser has duplicate login emails (case-insensitive): %. Deduplicate before applying staff password auth.', dup;
  END IF;
END $$;

-- Login lookup is by lower(email). Empty string means "no login email" and is
-- exempt, so imported staff rows without an email do not collide with each
-- other.
CREATE UNIQUE INDEX "AppUser_email_lower_key" ON "AppUser" (lower(email)) WHERE email <> '';

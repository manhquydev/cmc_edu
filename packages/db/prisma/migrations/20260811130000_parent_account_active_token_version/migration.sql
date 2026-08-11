-- ParentAccount lifecycle for LMS sessions (teaching spine phase 4).
-- isActive=false blocks new and existing sessions; tokenVersion invalidates
-- outstanding signed LMS tokens when staff deactivate or force re-login.

ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

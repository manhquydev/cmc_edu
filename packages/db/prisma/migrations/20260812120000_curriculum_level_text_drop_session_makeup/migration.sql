-- CurriculumUnit.level: INTEGER → TEXT (framework codes from CSV: U2, J, G…).
-- ClassSession: drop makeup columns (isMakeup, makeupForSessionId + self-FK).
-- Hand-written to match schema.prisma after makeup-removal / level-string change.

-- ---------------------------------------------------------------------------
-- 1. CurriculumUnit.level Int → Text
-- ---------------------------------------------------------------------------
-- Existing seed rows (numeric 1–4) cast to text ("1"…); CSV import overwrites
-- with verbatim framework codes. Index on (program, level, monthIndex) stays
-- valid under text.
ALTER TABLE "CurriculumUnit"
  ALTER COLUMN "level" TYPE TEXT USING "level"::text;

-- ---------------------------------------------------------------------------
-- 2. ClassSession — data fix BEFORE dropping makeup columns
-- ---------------------------------------------------------------------------
-- Makeup sessions are removed from the product model (no isMakeup, no Tier B,
-- no auto-generated makeup after 0-present cancel). Leaving historical makeup
-- rows as non-cancelled would:
--   (a) let open-tier Tier A treat them as normal ended sessions and open that
--       unit for the whole class (was previously excluded via isMakeup);
--   (b) count them in unit restamp (every non-cancelled session occupies a slot
--       of 4), shifting later sessions — the exact bug this PR fixes.
-- Business rule: cancel (do NOT delete). Attendance / assessments on those
-- rows stay for learning history; status='cancelled' drops them from progression
-- and open-tier Tier A. Enum: SessionStatus = planned|confirmed|cancelled|done.
UPDATE "ClassSession"
SET
  status = 'cancelled'::"SessionStatus",
  "updatedAt" = now()
WHERE "isMakeup" = true
  AND status IS DISTINCT FROM 'cancelled'::"SessionStatus";

-- ---------------------------------------------------------------------------
-- 3. ClassSession — drop makeup self-relation
-- ---------------------------------------------------------------------------
-- Added in 20260712000000_hr_remediation_policy_quota_reject_done
-- (makeupForSessionId unique + FK) and 20260706170000_p2_foundation_class_ops
-- (isMakeup). Product no longer models makeup sessions this way.
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_fkey";
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_key";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "makeupForSessionId";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "isMakeup";

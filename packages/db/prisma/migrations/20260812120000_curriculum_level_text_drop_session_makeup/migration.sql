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
-- 2. ClassSession — drop makeup self-relation
-- ---------------------------------------------------------------------------
-- Added in 20260712000000_hr_remediation_policy_quota_reject_done
-- (makeupForSessionId unique + FK) and 20260706170000_p2_foundation_class_ops
-- (isMakeup). Product no longer models makeup sessions this way.
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_fkey";
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_key";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "makeupForSessionId";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "isMakeup";

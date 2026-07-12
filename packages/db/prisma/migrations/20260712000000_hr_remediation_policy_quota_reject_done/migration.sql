-- HR remediation phase 1 (plans/260711-1752-hr-kpi-shift-attendance-remediation):
-- schema substrate for the salary-tier payroll model, KPI snapshot columns,
-- shift-reject lifecycle, ticket/status CHECK hardening, session-done engine
-- columns, and 2 backfills (Receipt.approvedAt, Receipt.createdByAppUserId).
--
-- INVARIANT (R2 #M4/#17, precedent 20260706160000/20260707180000): this file
-- adds `'done'` to SessionStatus via `ALTER TYPE ... ADD VALUE` but never
-- references that value in the same transaction (no UPDATE/CHECK/index using
-- 'done' here) — session-done backfill is a separate migration/script
-- (phase 7).

-- ---------------------------------------------------------------------------
-- 1. CompensationPolicy — per-facility late/early penalty rates.
-- ---------------------------------------------------------------------------
CREATE TABLE "CompensationPolicy" (
  "id"                        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"                TEXT NOT NULL,
  "penaltyRatePerLateMinute"  NUMERIC(14, 2) NOT NULL DEFAULT 500,
  "penaltyRatePerEarlyMinute" NUMERIC(14, 2) NOT NULL DEFAULT 1000,
  "createdAt"                 TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompensationPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompensationPolicy_facilityId_key" UNIQUE ("facilityId"),
  CONSTRAINT "CompensationPolicy_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "CompensationPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompensationPolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY "CompensationPolicy_facility_isolation" ON "CompensationPolicy"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
-- No DELETE grant — append-like posture, same as Payslip/KpiScore.
GRANT SELECT, INSERT, UPDATE ON "CompensationPolicy" TO cmc_app;

-- ---------------------------------------------------------------------------
-- 2. SalaryTier — per-facility named salary bậc (base + unitRate + quotas).
-- ---------------------------------------------------------------------------
CREATE TABLE "SalaryTier" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"     TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "type"           "ShiftGroupType" NOT NULL,
  "baseSalary"     NUMERIC(14, 2) NOT NULL,
  "unitRate"       NUMERIC(14, 2) NOT NULL,
  "requiredShifts" INTEGER NOT NULL,
  "requiredMetric" NUMERIC(14, 2) NOT NULL,
  "updatedById"    TEXT,
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryTier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryTier_facilityId_name_key" UNIQUE ("facilityId", "name"),
  CONSTRAINT "SalaryTier_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SalaryTier_facilityId_idx" ON "SalaryTier"("facilityId");

ALTER TABLE "SalaryTier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalaryTier" FORCE ROW LEVEL SECURITY;
CREATE POLICY "SalaryTier_facility_isolation" ON "SalaryTier"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
-- No DELETE grant — tiers are audit-tracked, not deletable once assigned.
GRANT SELECT, INSERT, UPDATE ON "SalaryTier" TO cmc_app;

-- ---------------------------------------------------------------------------
-- 3. SalaryRate — nullable-ize the 3 legacy columns + add tierId FK (R3-4).
-- ---------------------------------------------------------------------------
ALTER TABLE "SalaryRate" ALTER COLUMN "baseSalary" DROP NOT NULL;
ALTER TABLE "SalaryRate" ALTER COLUMN "variablePayRate" DROP NOT NULL;
ALTER TABLE "SalaryRate" ALTER COLUMN "kpiMax" DROP NOT NULL;
ALTER TABLE "SalaryRate" ADD COLUMN "tierId" TEXT;
ALTER TABLE "SalaryRate" ADD CONSTRAINT "SalaryRate_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SalaryTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "SalaryRate_tierId_idx" ON "SalaryRate"("tierId");

-- ---------------------------------------------------------------------------
-- 4. KpiScore — retire kpiMax (nullable) + add tier-snapshot columns (R3-5/R3-9).
-- ---------------------------------------------------------------------------
ALTER TABLE "KpiScore" ALTER COLUMN "kpiMax" DROP NOT NULL;
ALTER TABLE "KpiScore" ADD COLUMN "metricValue"      NUMERIC(14, 2);
ALTER TABLE "KpiScore" ADD COLUMN "quotaSnapshot"    NUMERIC(14, 2);
ALTER TABLE "KpiScore" ADD COLUMN "shiftActual"      INTEGER;
ALTER TABLE "KpiScore" ADD COLUMN "shiftRequired"    INTEGER;
ALTER TABLE "KpiScore" ADD COLUMN "unitRateSnapshot" NUMERIC(14, 2);
ALTER TABLE "KpiScore" ADD COLUMN "tierIdSnapshot"   TEXT;

-- ---------------------------------------------------------------------------
-- 5. ShiftGroup / ShiftTemplate — idempotent-seed natural keys (R3-11).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "ShiftGroup_facilityId_name_key" ON "ShiftGroup"("facilityId", "name");
CREATE UNIQUE INDEX "ShiftTemplate_shiftGroupId_name_key" ON "ShiftTemplate"("shiftGroupId", "name");

-- ---------------------------------------------------------------------------
-- 6. ShiftRegistration — 'rejected' status + rejectReason (phase 4 writer).
-- Postgres cannot ALTER a CHECK constraint in place: DROP + ADD NOT VALID +
-- VALIDATE (finding #16). The ticket-lock partial unique index (migration
-- 20260707020000, WHERE status='submitted' ONLY) is untouched by this
-- migration — 'rejected' falls outside that WHERE clause, so the lock
-- self-releases on reject without any index change.
-- ---------------------------------------------------------------------------
ALTER TABLE "ShiftRegistration" DROP CONSTRAINT "ShiftRegistration_status_check";
ALTER TABLE "ShiftRegistration" ADD CONSTRAINT "ShiftRegistration_status_check"
  CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled', 'rejected')) NOT VALID;
ALTER TABLE "ShiftRegistration" VALIDATE CONSTRAINT "ShiftRegistration_status_check";
ALTER TABLE "ShiftRegistration" ADD COLUMN "rejectReason" TEXT;

-- ---------------------------------------------------------------------------
-- 7. ManualAttendanceTicket — first CHECK constraint for this table's status.
-- NOT VALID + VALIDATE avoids locking out concurrent writers while existing
-- rows are checked (same pattern as step 6).
-- ---------------------------------------------------------------------------
ALTER TABLE "ManualAttendanceTicket" ADD CONSTRAINT "ManualAttendanceTicket_status_check"
  CHECK (status IN ('pending', 'approved', 'rejected', 'resubmitted')) NOT VALID;
ALTER TABLE "ManualAttendanceTicket" VALIDATE CONSTRAINT "ManualAttendanceTicket_status_check";

-- ---------------------------------------------------------------------------
-- 8. Receipt.approvedAt + backfill (finding #6).
-- Approximation, documented: `updatedAt` may have been touched by a later
-- receiptCancel/other update, so this backfill is not exact for rows whose
-- status changed again after approval. Accepted as a one-time migration cost.
-- ---------------------------------------------------------------------------
ALTER TABLE "Receipt" ADD COLUMN "approvedAt" TIMESTAMPTZ(3);
UPDATE "Receipt" SET "approvedAt" = "updatedAt" WHERE status = 'approved' AND "approvedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 9. Receipt.createdByAppUserId backfill (finding #2 — attribution namespace).
-- Matches by AppUser.userId = Receipt.createdById (the dev-session userId
-- namespace Receipt has always stored); rows with no matching AppUser (e.g.
-- 'test-seed') are left NULL.
-- ---------------------------------------------------------------------------
UPDATE "Receipt" r SET "createdByAppUserId" = au.id
FROM "AppUser" au WHERE au."userId" = r."createdById" AND r."createdByAppUserId" IS NULL;

-- ---------------------------------------------------------------------------
-- 10. SessionStatus — add 'done' (phase 7 consumer). See file-header invariant.
-- ---------------------------------------------------------------------------
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'done';

-- ---------------------------------------------------------------------------
-- 11. ClassSession — session-done + makeup columns (phase 7 consumer).
-- ---------------------------------------------------------------------------
ALTER TABLE "ClassSession" ADD COLUMN "doneAt" TIMESTAMPTZ(3);
ALTER TABLE "ClassSession" ADD COLUMN "makeupForSessionId" TEXT;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_makeupForSessionId_key" UNIQUE ("makeupForSessionId");
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_makeupForSessionId_fkey" FOREIGN KEY ("makeupForSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

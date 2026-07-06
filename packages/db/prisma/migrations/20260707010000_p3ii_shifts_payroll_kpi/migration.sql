-- P3-II: HR shifts, payroll (SalaryRate + Payslip), and KPI (KpiScore).
-- Tables: ShiftGroup, ShiftTemplate, ShiftRegistration, ShiftRegistrationEntry,
--         SalaryRate, Payslip, KpiScore.
-- All facility-scoped + RLS (facility_isolation policy OR bypass_rls).
-- cmc_app has no DELETE grant on Payslip or KpiScore (append-like ledgers).

-- Enums
CREATE TYPE "ShiftGroupType" AS ENUM ('KINH_DOANH', 'GIAO_VIEN');
CREATE TYPE "ShiftSelectionMode" AS ENUM ('SINGLE', 'MULTIPLE');

-- ShiftGroup: shift template catalog grouped by staff type.
CREATE TABLE "ShiftGroup" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"    TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "type"          "ShiftGroupType" NOT NULL,
  "selectionMode" "ShiftSelectionMode" NOT NULL,
  "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftGroup_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ShiftGroup_facilityId_idx" ON "ShiftGroup"("facilityId");

-- ShiftTemplate: one named schedule (e.g. "Ca sáng 09:00-17:00").
CREATE TABLE "ShiftTemplate" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"   TEXT NOT NULL,
  "shiftGroupId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "startTime"    TEXT NOT NULL,
  "endTime"      TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftTemplate_facilityId_fkey"   FOREIGN KEY ("facilityId")   REFERENCES "Facility"("id")    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftTemplate_shiftGroupId_fkey" FOREIGN KEY ("shiftGroupId") REFERENCES "ShiftGroup"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ShiftTemplate_facilityId_idx"   ON "ShiftTemplate"("facilityId");
CREATE INDEX "ShiftTemplate_shiftGroupId_idx" ON "ShiftTemplate"("shiftGroupId");

-- ShiftRegistration: one registration request per employee.
-- Ticket-lock: at most one 'submitted' per appUser enforced at app level.
CREATE TABLE "ShiftRegistration" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"    TEXT NOT NULL,
  "appUserId"     TEXT NOT NULL,
  "shiftGroupId"  TEXT NOT NULL,
  "fromDate"      TIMESTAMPTZ(3) NOT NULL,
  "toDate"        TIMESTAMPTZ(3) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'draft',
  "selectionMode" TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftRegistration_appUserId_fkey"    FOREIGN KEY ("appUserId")    REFERENCES "AppUser"("id")     ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftRegistration_shiftGroupId_fkey" FOREIGN KEY ("shiftGroupId") REFERENCES "ShiftGroup"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftRegistration_facilityId_fkey"   FOREIGN KEY ("facilityId")   REFERENCES "Facility"("id")    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ShiftRegistration_facilityId_idx" ON "ShiftRegistration"("facilityId");
CREATE INDEX "ShiftRegistration_appUserId_idx"  ON "ShiftRegistration"("appUserId");

-- ShiftRegistrationEntry: one day within a registration.
-- SINGLE-mode uniqueness enforced at app layer (not DB), so MULTIPLE mode can
-- register several templates per day.
CREATE TABLE "ShiftRegistrationEntry" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"          TEXT NOT NULL,
  "shiftRegistrationId" TEXT NOT NULL,
  "date"                TIMESTAMPTZ(3) NOT NULL,
  "shiftTemplateId"     TEXT NOT NULL,
  CONSTRAINT "ShiftRegistrationEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftRegistrationEntry_shiftRegistrationId_fkey" FOREIGN KEY ("shiftRegistrationId") REFERENCES "ShiftRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftRegistrationEntry_shiftTemplateId_fkey"     FOREIGN KEY ("shiftTemplateId")     REFERENCES "ShiftTemplate"("id")     ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ShiftRegistrationEntry_facilityId_idx"          ON "ShiftRegistrationEntry"("facilityId");
CREATE INDEX "ShiftRegistrationEntry_shiftRegistrationId_idx" ON "ShiftRegistrationEntry"("shiftRegistrationId");
CREATE INDEX "ShiftRegistrationEntry_shiftTemplateId_idx"     ON "ShiftRegistrationEntry"("shiftTemplateId");

-- SalaryRate: per-employee salary config. appUserId is UNIQUE.
-- Upserted via INSERT ON CONFLICT (compensation.upsertRate procedure).
CREATE TABLE "SalaryRate" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"      TEXT NOT NULL,
  "appUserId"       TEXT NOT NULL,
  "baseSalary"      NUMERIC(14, 2) NOT NULL,
  "variablePayRate" NUMERIC(5, 4)  NOT NULL,
  "kpiMax"          NUMERIC(14, 2) NOT NULL,
  "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryRate_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "SalaryRate_appUserId_key" UNIQUE ("appUserId"),
  CONSTRAINT "SalaryRate_appUserId_fkey"  FOREIGN KEY ("appUserId")  REFERENCES "AppUser"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalaryRate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SalaryRate_facilityId_idx" ON "SalaryRate"("facilityId");

-- Payslip: monthly payslip (append-like: no DELETE for cmc_app).
-- penaltyAmount is ALWAYS independent — never merged with other components.
CREATE TABLE "Payslip" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"     TEXT NOT NULL,
  "appUserId"      TEXT NOT NULL,
  "period"         TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "baseSalary"     NUMERIC(14, 2) NOT NULL,
  "variablePay"    NUMERIC(14, 2) NOT NULL,
  "kpiBonus"       NUMERIC(14, 2) NOT NULL,
  "penaltyAmount"  NUMERIC(14, 2) NOT NULL,
  "totalNet"       NUMERIC(14, 2) NOT NULL,
  "lateMinutes"    INTEGER NOT NULL DEFAULT 0,
  "earlyMinutes"   INTEGER NOT NULL DEFAULT 0,
  "unpunchedDays"  INTEGER NOT NULL DEFAULT 0,
  "flaggedPunches" INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payslip_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "Payslip_appUserId_period_key" UNIQUE ("appUserId", "period"),
  CONSTRAINT "Payslip_appUserId_fkey"  FOREIGN KEY ("appUserId")  REFERENCES "AppUser"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payslip_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Payslip_facilityId_idx" ON "Payslip"("facilityId");

-- KpiScore: per-employee KPI score (append-like: no DELETE for cmc_app).
CREATE TABLE "KpiScore" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"     TEXT NOT NULL,
  "appUserId"      TEXT NOT NULL,
  "period"         TEXT NOT NULL,
  "value"          NUMERIC(14, 2) NOT NULL,
  "kpiMax"         NUMERIC(14, 2) NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "submittedBy"    TEXT,
  "confirmedBy"    TEXT,
  "approvedBy"     TEXT,
  "override"       BOOLEAN NOT NULL DEFAULT FALSE,
  "overrideReason" TEXT,
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KpiScore_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "KpiScore_appUserId_period_key" UNIQUE ("appUserId", "period"),
  CONSTRAINT "KpiScore_appUserId_fkey"  FOREIGN KEY ("appUserId")  REFERENCES "AppUser"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "KpiScore_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "KpiScore_facilityId_idx" ON "KpiScore"("facilityId");

-- RLS: ShiftGroup
ALTER TABLE "ShiftGroup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShiftGroup_facility_isolation" ON "ShiftGroup"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "ShiftGroup" TO cmc_app;

-- RLS: ShiftTemplate
ALTER TABLE "ShiftTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShiftTemplate_facility_isolation" ON "ShiftTemplate"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "ShiftTemplate" TO cmc_app;

-- RLS: ShiftRegistration
ALTER TABLE "ShiftRegistration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShiftRegistration_facility_isolation" ON "ShiftRegistration"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "ShiftRegistration" TO cmc_app;

-- RLS: ShiftRegistrationEntry
ALTER TABLE "ShiftRegistrationEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ShiftRegistrationEntry_facility_isolation" ON "ShiftRegistrationEntry"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "ShiftRegistrationEntry" TO cmc_app;

-- RLS: SalaryRate
ALTER TABLE "SalaryRate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SalaryRate_facility_isolation" ON "SalaryRate"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "SalaryRate" TO cmc_app;

-- RLS: Payslip (append-like — no DELETE grant)
ALTER TABLE "Payslip" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payslip_facility_isolation" ON "Payslip"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "Payslip" TO cmc_app;

-- RLS: KpiScore (append-like — no DELETE grant)
ALTER TABLE "KpiScore" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KpiScore_facility_isolation" ON "KpiScore"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "KpiScore" TO cmc_app;

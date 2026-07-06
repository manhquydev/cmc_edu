-- P4: Gift catalog and Reward redemption.
-- Tables: Gift, Reward.
-- All facility-scoped + RLS (same GUC-based policy as every P1/P2/P3 table).
-- cmc_app has no DELETE grant (archive via isActive=false for Gift;
-- Reward uses status transitions only, never deletion).

CREATE TABLE "Gift" (
  "id"            TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"    TEXT           NOT NULL,
  "name"          VARCHAR(200)   NOT NULL,
  "imageUrl"      VARCHAR(500),
  "starsRequired" INTEGER        NOT NULL,
  "stock"         INTEGER        NOT NULL DEFAULT -1,
  "isActive"      BOOLEAN        NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reward" (
  "id"                  TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"          TEXT           NOT NULL,
  "studentId"           TEXT           NOT NULL,
  "giftId"              TEXT           NOT NULL,
  "status"              TEXT           NOT NULL DEFAULT 'pending',
  "redeemedAt"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt"          TIMESTAMPTZ(3),
  "deliveredAt"         TIMESTAMPTZ(3),
  "rejectedAt"          TIMESTAMPTZ(3),
  "rejectionRefundedAt" TIMESTAMPTZ(3),
  "note"                VARCHAR(2000),
  CONSTRAINT "Reward_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "Reward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Reward_giftId_fkey"    FOREIGN KEY ("giftId")    REFERENCES "Gift"("id")    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Reward_status_check"   CHECK (status IN ('pending', 'approved', 'delivered', 'rejected'))
);

CREATE INDEX "Gift_facilityId_isActive_idx"    ON "Gift"("facilityId", "isActive");
CREATE INDEX "Reward_facilityId_studentId_idx" ON "Reward"("facilityId", "studentId");

-- RLS: same GUC-based facility isolation as all other facility-scoped tables.
ALTER TABLE "Gift"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reward" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gift_facility_isolation" ON "Gift"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

CREATE POLICY "Reward_facility_isolation" ON "Reward"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

-- cmc_app: SELECT + INSERT + UPDATE only (no DELETE — archive/status-only design).
GRANT SELECT, INSERT, UPDATE ON "Gift"   TO cmc_app;
GRANT SELECT, INSERT, UPDATE ON "Reward" TO cmc_app;

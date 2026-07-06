-- P4: After-sale support cases.
-- Table: AfterSaleCase.
-- Facility-scoped + RLS (same GUC-based policy as all other facility tables).
-- cmc_app has no DELETE grant (closed = terminal state; append-like design).

CREATE TABLE "AfterSaleCase" (
  "id"          TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"  TEXT           NOT NULL,
  "studentId"   TEXT           NOT NULL,
  "priority"    TEXT           NOT NULL DEFAULT 'normal',
  "status"      TEXT           NOT NULL DEFAULT 'open',
  "description" VARCHAR(2000)  NOT NULL,
  "resolution"  VARCHAR(2000),
  "createdById" TEXT,
  "resolvedAt"  TIMESTAMPTZ(3),
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AfterSaleCase_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "AfterSaleCase_priority_check" CHECK (priority IN ('low', 'normal', 'high')),
  CONSTRAINT "AfterSaleCase_status_check"   CHECK (status   IN ('open', 'in_progress', 'resolved', 'closed'))
);

CREATE INDEX "AfterSaleCase_facilityId_status_idx" ON "AfterSaleCase"("facilityId", "status");

ALTER TABLE "AfterSaleCase" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AfterSaleCase_facility_isolation" ON "AfterSaleCase"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

GRANT SELECT, INSERT, UPDATE ON "AfterSaleCase" TO cmc_app;

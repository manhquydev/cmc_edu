-- P5: Reconciliation flags (finance audit, AI-recon agent surface).
-- Facility-scoped + RLS. Append-only: cmc_app has no DELETE grant.

CREATE TABLE "ReconciliationFlag" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"   TEXT        NOT NULL,
  "receiptId"    TEXT,
  "kind"         TEXT        NOT NULL,
  "detail"       JSONB       NOT NULL DEFAULT '{}',
  "status"       TEXT        NOT NULL DEFAULT 'open',
  "deepLink"     VARCHAR(500),
  "resolvedById" TEXT,
  "resolvedAt"   TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ReconciliationFlag_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "ReconciliationFlag_status_check" CHECK (status IN ('open','dismissed','actioned')),
  CONSTRAINT "ReconciliationFlag_kind_check"   CHECK (kind IN ('self_approved','exceeds_threshold','excess_refunds','missing_provisioning'))
);

CREATE INDEX "ReconciliationFlag_facilityId_status_idx"          ON "ReconciliationFlag"("facilityId", "status");
CREATE INDEX "ReconciliationFlag_facilityId_receiptId_kind_idx"  ON "ReconciliationFlag"("facilityId", "receiptId", "kind");

ALTER TABLE "ReconciliationFlag" ENABLE ROW LEVEL SECURITY;

-- Same GUC-based facility isolation as all other facility-scoped tables.
CREATE POLICY "ReconciliationFlag_facility_isolation" ON "ReconciliationFlag"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- cmc_app: SELECT + INSERT + UPDATE only (no DELETE — flags are audit records).
GRANT SELECT, INSERT, UPDATE ON "ReconciliationFlag" TO cmc_app;

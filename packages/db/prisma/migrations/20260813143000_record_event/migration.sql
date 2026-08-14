-- RecordEvent: append-only, facility-scoped business history for CRM records
-- (Con A). Notes are one kind of event. cmc_app gets SELECT+INSERT only —
-- no UPDATE/DELETE (decision #16, wave-A privilege-hardening precedent).

CREATE TABLE "RecordEvent" (
  "id"         TEXT         NOT NULL,
  "facilityId" TEXT         NOT NULL,
  "entity"     TEXT         NOT NULL,
  "entityId"   TEXT         NOT NULL,
  "kind"       TEXT         NOT NULL,
  "actor"      TEXT         NOT NULL,
  "payload"    JSONB,
  "createdAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecordEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecordEvent_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "Facility"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RecordEvent_facilityId_entity_entityId_createdAt_idx"
  ON "RecordEvent"("facilityId", "entity", "entityId", "createdAt");

ALTER TABLE "RecordEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecordEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RecordEvent_facility_isolation" ON "RecordEvent";
CREATE POLICY "RecordEvent_facility_isolation" ON "RecordEvent"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

GRANT SELECT, INSERT ON "RecordEvent" TO cmc_app;
REVOKE UPDATE, DELETE ON "RecordEvent" FROM "cmc_app";

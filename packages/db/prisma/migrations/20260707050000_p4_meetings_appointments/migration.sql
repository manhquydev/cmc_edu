-- P4: Parent meetings and test appointments.
-- Tables: ParentMeeting, TestAppointment.
-- All facility-scoped + RLS (same GUC-based policy as all other tables).
-- cmc_app has no DELETE grant (status-only transitions).

CREATE TABLE "ParentMeeting" (
  "id"          TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"  TEXT           NOT NULL,
  "studentId"   TEXT           NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "status"      TEXT           NOT NULL DEFAULT 'scheduled',
  "result"      VARCHAR(2000),
  "remindedAt"  TIMESTAMPTZ(3),
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentMeeting_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "ParentMeeting_status_check" CHECK (status IN ('scheduled', 'done', 'cancelled'))
);

CREATE TABLE "TestAppointment" (
  "id"          TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"  TEXT           NOT NULL,
  "studentId"   TEXT           NOT NULL,
  "type"        TEXT           NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "status"      TEXT           NOT NULL DEFAULT 'scheduled',
  "notes"       VARCHAR(2000),
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestAppointment_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "TestAppointment_type_check"   CHECK (type   IN ('entrance', 'periodic')),
  CONSTRAINT "TestAppointment_status_check" CHECK (status IN ('scheduled', 'done', 'no_show'))
);

CREATE INDEX "ParentMeeting_facilityId_scheduledAt_idx"   ON "ParentMeeting"("facilityId",  "scheduledAt");
CREATE INDEX "TestAppointment_facilityId_scheduledAt_idx" ON "TestAppointment"("facilityId", "scheduledAt");

ALTER TABLE "ParentMeeting"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestAppointment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ParentMeeting_facility_isolation" ON "ParentMeeting"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

CREATE POLICY "TestAppointment_facility_isolation" ON "TestAppointment"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

GRANT SELECT, INSERT, UPDATE ON "ParentMeeting"   TO cmc_app;
GRANT SELECT, INSERT, UPDATE ON "TestAppointment" TO cmc_app;

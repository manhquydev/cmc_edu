-- FacilityGeofence + TimePunch verification snapshot columns.
-- Drift note: prisma also proposed DropForeignKey on Opportunity/AfterSaleCase/
-- ParentMeeting/TestAppointment (schema omits those relations). Stripped —
-- out of scope; leave existing FKs intact.

-- AlterTable
ALTER TABLE "TimePunch" ADD COLUMN     "accuracyM" DOUBLE PRECISION,
ADD COLUMN     "geofenceDistanceM" DOUBLE PRECISION,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "matchedAccuracyMaxM" INTEGER,
ADD COLUMN     "matchedGeofenceId" TEXT,
ADD COLUMN     "matchedRadiusM" INTEGER,
ADD COLUMN     "verification" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "FacilityGeofence" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL,
    "accuracyMaxM" INTEGER NOT NULL DEFAULT 200,
    "label" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityGeofence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityGeofence_facilityId_idx" ON "FacilityGeofence"("facilityId");

-- CreateIndex
CREATE INDEX "TimePunch_facilityId_punchAt_idx" ON "TimePunch"("facilityId", "punchAt");

-- AddForeignKey
ALTER TABLE "FacilityGeofence" ADD CONSTRAINT "FacilityGeofence_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS + GRANT (hand-appended — prisma migrate does NOT emit these).
-- Policy MUST match existing template (app.current_facility_id OR app.bypass_rls).
-- ---------------------------------------------------------------------------
ALTER TABLE "FacilityGeofence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FacilityGeofence" FORCE ROW LEVEL SECURITY;
CREATE POLICY "FacilityGeofence_facility_isolation" ON "FacilityGeofence"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "FacilityGeofence" TO cmc_app;

-- Backfill (migration role — bypass append-only grant of cmc_app):
-- 'open' not 'network': history had no verification path running (red-team K).
UPDATE "TimePunch" SET "verification" = CASE WHEN "withinNetwork" THEN 'open' ELSE 'none' END;

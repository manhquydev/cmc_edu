-- AppUser: staff member in a facility, linked to auth userId
CREATE TABLE "AppUser" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"     TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "email"          TEXT NOT NULL DEFAULT '',
  "fullName"       TEXT NOT NULL DEFAULT '',
  "position"       TEXT NOT NULL DEFAULT '',
  "managerId"      TEXT,
  "employeeCode"   TEXT NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppUser_userId_key" UNIQUE ("userId"),
  CONSTRAINT "AppUser_employeeCode_key" UNIQUE ("employeeCode"),
  CONSTRAINT "AppUser_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AppUser_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AppUser_facilityId_idx" ON "AppUser"("facilityId");

-- FacilityNetwork: IP ranges allowed for clock-in
CREATE TABLE "FacilityNetwork" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId" TEXT NOT NULL,
  "cidr"       TEXT NOT NULL,
  "label"      TEXT NOT NULL DEFAULT '',
  "isActive"   BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacilityNetwork_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FacilityNetwork_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FacilityNetwork_facilityId_idx" ON "FacilityNetwork"("facilityId");

-- EmployeeCodeCounter: single-row global sequence for CMC#### codes
CREATE TABLE "EmployeeCodeCounter" (
  "id"   INTEGER NOT NULL DEFAULT 1,
  "next" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "EmployeeCodeCounter_pkey" PRIMARY KEY ("id")
);
INSERT INTO "EmployeeCodeCounter" ("id", "next") VALUES (1, 1);

-- TimePunch: clock-in/out record (append-only)
CREATE TABLE "TimePunch" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId" TEXT NOT NULL,
  "appUserId"  TEXT NOT NULL,
  "punchAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"     TEXT NOT NULL,
  "ip"         TEXT,
  CONSTRAINT "TimePunch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimePunch_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TimePunch_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TimePunch_facilityId_appUserId_idx" ON "TimePunch"("facilityId", "appUserId");

-- ManualAttendanceTicket: manual punch request (pending|approved|rejected|resubmitted)
CREATE TABLE "ManualAttendanceTicket" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"     TEXT NOT NULL,
  "appUserId"      TEXT NOT NULL,
  "ticketDate"     TIMESTAMPTZ(3) NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "note"           TEXT NOT NULL DEFAULT '',
  "reviewedById"   TEXT,
  "reviewedAt"     TIMESTAMPTZ(3),
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualAttendanceTicket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualAttendanceTicket_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualAttendanceTicket_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ManualAttendanceTicket_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ManualAttendanceTicket_facilityId_appUserId_idx" ON "ManualAttendanceTicket"("facilityId", "appUserId");

-- Nullable FK backfill columns
ALTER TABLE "Receipt"     ADD COLUMN "createdByAppUserId"  TEXT REFERENCES "AppUser"("id") ON DELETE SET NULL;
ALTER TABLE "Receipt"     ADD COLUMN "approvedByAppUserId" TEXT REFERENCES "AppUser"("id") ON DELETE SET NULL;
ALTER TABLE "ClassBatch"  ADD COLUMN "teacherAppUserId"    TEXT REFERENCES "AppUser"("id") ON DELETE SET NULL;
ALTER TABLE "ClassBatch"  ADD COLUMN "createdByAppUserId"  TEXT REFERENCES "AppUser"("id") ON DELETE SET NULL;
ALTER TABLE "Attendance"  ADD COLUMN "markedByAppUserId"   TEXT REFERENCES "AppUser"("id") ON DELETE SET NULL;

-- RLS policies (AppUser is facility-scoped)
ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AppUser_facility_isolation" ON "AppUser"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "AppUser" TO cmc_app;

-- FacilityNetwork has RLS too
ALTER TABLE "FacilityNetwork" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FacilityNetwork_facility_isolation" ON "FacilityNetwork"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "FacilityNetwork" TO cmc_app;

-- TimePunch: append-only (no UPDATE/DELETE for cmc_app)
ALTER TABLE "TimePunch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TimePunch_facility_isolation" ON "TimePunch"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT ON "TimePunch" TO cmc_app;

-- ManualAttendanceTicket has RLS
ALTER TABLE "ManualAttendanceTicket" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ManualAttendanceTicket_facility_isolation" ON "ManualAttendanceTicket"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE ON "ManualAttendanceTicket" TO cmc_app;

-- EmployeeCodeCounter: global, no RLS
GRANT SELECT, UPDATE ON "EmployeeCodeCounter" TO cmc_app;

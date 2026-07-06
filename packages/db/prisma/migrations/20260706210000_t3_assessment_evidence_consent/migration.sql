-- T3: QualitativeAssessment + SessionEvidence + SessionEvidencePhoto + Guardian consent columns.
--
-- All three new tables are facility-scoped + RLS (same pattern as Submission/FinalGrade,
-- ADR 0042). Guardian.photoConsent columns are ALTER TABLE additions — no RLS policy
-- change needed (Guardian already carries no RLS per the existing schema decision).
--
-- Column types follow the existing migration convention: IDs are TEXT (Prisma
-- stores UUID values as text), FK references match the TEXT type of the parent PK.

-- ---------------------------------------------------------------------------
-- QualitativeAssessment
-- ---------------------------------------------------------------------------

CREATE TABLE "QualitativeAssessment" (
  "id"             TEXT         NOT NULL,
  "facilityId"     TEXT         NOT NULL,
  "studentId"      TEXT         NOT NULL,
  "classSessionId" TEXT,
  "period"         TEXT,
  "content"        TEXT         NOT NULL DEFAULT '',
  "status"         TEXT         NOT NULL DEFAULT 'draft',
  "draftedBy"      TEXT         NOT NULL DEFAULT 'ai',
  "confidence"     REAL,
  "confirmedById"  TEXT,
  "confirmedAt"    TIMESTAMPTZ(3),
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "QualitativeAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualitativeAssessment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id"),
  CONSTRAINT "QualitativeAssessment_classSessionId_fkey"
    FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id")
);

CREATE INDEX "QualitativeAssessment_facilityId_idx" ON "QualitativeAssessment"("facilityId");
CREATE INDEX "QualitativeAssessment_studentId_period_idx" ON "QualitativeAssessment"("studentId", "period");

ALTER TABLE "QualitativeAssessment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_isolation" ON "QualitativeAssessment"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

-- SELECT/INSERT/UPDATE for normal operations; DELETE for test teardown (not an
-- append-only ledger — discard is a status transition, not a hard delete, but
-- teardown still needs DELETE to clean up between tests).
GRANT SELECT, INSERT, UPDATE, DELETE ON "QualitativeAssessment" TO cmc_app;

-- ---------------------------------------------------------------------------
-- SessionEvidence
-- ---------------------------------------------------------------------------

CREATE TABLE "SessionEvidence" (
  "id"             TEXT         NOT NULL,
  "facilityId"     TEXT         NOT NULL,
  "classSessionId" TEXT         NOT NULL,
  "summary"        TEXT         NOT NULL DEFAULT '',
  "internalNote"   TEXT         NOT NULL DEFAULT '',
  "status"         TEXT         NOT NULL DEFAULT 'draft',
  "publishedById"  TEXT,
  "publishedAt"    TIMESTAMPTZ(3),
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "SessionEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionEvidence_classSessionId_key" UNIQUE ("classSessionId"),
  CONSTRAINT "SessionEvidence_classSessionId_fkey"
    FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id")
);

CREATE INDEX "SessionEvidence_facilityId_idx" ON "SessionEvidence"("facilityId");

ALTER TABLE "SessionEvidence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_isolation" ON "SessionEvidence"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionEvidence" TO cmc_app;

-- ---------------------------------------------------------------------------
-- SessionEvidencePhoto
-- ---------------------------------------------------------------------------

CREATE TABLE "SessionEvidencePhoto" (
  "id"                TEXT         NOT NULL,
  "facilityId"        TEXT         NOT NULL,
  "sessionEvidenceId" TEXT         NOT NULL,
  "blobRef"           TEXT         NOT NULL,
  "createdAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "SessionEvidencePhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionEvidencePhoto_sessionEvidenceId_fkey"
    FOREIGN KEY ("sessionEvidenceId") REFERENCES "SessionEvidence"("id")
);

CREATE INDEX "SessionEvidencePhoto_sessionEvidenceId_idx" ON "SessionEvidencePhoto"("sessionEvidenceId");

ALTER TABLE "SessionEvidencePhoto" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_isolation" ON "SessionEvidencePhoto"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

GRANT SELECT, INSERT, DELETE ON "SessionEvidencePhoto" TO cmc_app;

-- ---------------------------------------------------------------------------
-- Guardian — photo consent columns (C2, TL08 §7)
-- ---------------------------------------------------------------------------

ALTER TABLE "Guardian"
  ADD COLUMN "photoConsent"          BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN "photoConsentAt"        TIMESTAMPTZ(3),
  ADD COLUMN "photoConsentRevokedAt" TIMESTAMPTZ(3);

-- Guardian already has UPDATE grant from the initial migration; no new grant needed.

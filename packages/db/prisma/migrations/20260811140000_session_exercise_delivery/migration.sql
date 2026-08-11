-- Session exercise delivery (teaching spine phase 6).
-- ClassExerciseItem: frozen sequence per class.
-- SessionExercise: at most one delivered homework per ClassSession.

CREATE TABLE IF NOT EXISTS "ClassExerciseItem" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"   TEXT         NOT NULL,
  "classBatchId" TEXT         NOT NULL,
  "position"     INTEGER      NOT NULL,
  "exerciseId"   TEXT         NOT NULL,
  "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassExerciseItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassExerciseItem_classBatchId_fkey"
    FOREIGN KEY ("classBatchId") REFERENCES "ClassBatch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassExerciseItem_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClassExerciseItem_classBatchId_position_key"
  ON "ClassExerciseItem"("classBatchId", "position");
CREATE INDEX IF NOT EXISTS "ClassExerciseItem_facilityId_idx"
  ON "ClassExerciseItem"("facilityId");
CREATE INDEX IF NOT EXISTS "ClassExerciseItem_classBatchId_idx"
  ON "ClassExerciseItem"("classBatchId");
CREATE INDEX IF NOT EXISTS "ClassExerciseItem_exerciseId_idx"
  ON "ClassExerciseItem"("exerciseId");

ALTER TABLE "ClassExerciseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassExerciseItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ClassExerciseItem_facility_isolation" ON "ClassExerciseItem";
CREATE POLICY "ClassExerciseItem_facility_isolation" ON "ClassExerciseItem"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "ClassExerciseItem" TO cmc_app;

CREATE TABLE IF NOT EXISTS "SessionExercise" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "facilityId"     TEXT         NOT NULL,
  "classSessionId" TEXT         NOT NULL,
  "exerciseId"     TEXT         NOT NULL,
  "position"       INTEGER      NOT NULL,
  "deliveredAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionExercise_classSessionId_fkey"
    FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionExercise_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionExercise_classSessionId_key"
  ON "SessionExercise"("classSessionId");
CREATE INDEX IF NOT EXISTS "SessionExercise_facilityId_idx"
  ON "SessionExercise"("facilityId");
CREATE INDEX IF NOT EXISTS "SessionExercise_exerciseId_idx"
  ON "SessionExercise"("exerciseId");
CREATE INDEX IF NOT EXISTS "SessionExercise_position_idx"
  ON "SessionExercise"("position");

ALTER TABLE "SessionExercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionExercise" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SessionExercise_facility_isolation" ON "SessionExercise";
CREATE POLICY "SessionExercise_facility_isolation" ON "SessionExercise"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionExercise" TO cmc_app;

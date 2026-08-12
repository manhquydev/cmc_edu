-- B4: Submission binds to SessionExercise (delivery instance), not Exercise catalog.
-- cmc_edu is not production — wipe existing submissions (no real data to keep).
-- Same exercise delivered on two sessions ⇒ two independent submission rows.

-- Star ledger rows that referenced submission ids become orphan if left behind.
DELETE FROM "StarTransaction" WHERE "refType" = 'submission';

TRUNCATE TABLE "Submission";

ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_exerciseId_fkey";
DROP INDEX IF EXISTS "Submission_exerciseId_studentId_key";
DROP INDEX IF EXISTS "Submission_exerciseId_idx";

ALTER TABLE "Submission" DROP COLUMN IF EXISTS "exerciseId";
ALTER TABLE "Submission" ADD COLUMN "sessionExerciseId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Submission_sessionExerciseId_studentId_key"
  ON "Submission"("sessionExerciseId", "studentId");
CREATE INDEX "Submission_sessionExerciseId_idx"
  ON "Submission"("sessionExerciseId");

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_sessionExerciseId_fkey"
  FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

// computeFinalGrade — pure function (no Prisma import), docs/19 §6 + TL29 §1.
//
// ASSUMPTION (documented, TL19 §6 does not pin an exact weighting formula):
// final = 0.7 * (average exercise score, normalized to a 0-10 scale)
//       + 0.3 * (attendanceRate * 10)
// A student with zero graded exercises this period gets an exercise
// component of 0 (not skipped/NaN) — "no homework done yet" is a real, low
// score, not a data gap to paper over. Revisit if the business pins an exact
// weighting/period grain.

export interface ExerciseScoreInput {
  /** Raw score awarded, `0 <= score <= maxScore`. */
  score: number;
  /** The exercise's own scale (`Exercise.maxScore`, default 10). */
  maxScore: number;
}

const EXERCISE_WEIGHT = 0.7;
const ATTENDANCE_WEIGHT = 0.3;
/** The final grade's own scale (matches `Exercise.maxScore`'s default of 10). */
const FINAL_SCALE = 10;

function assertValidAttendanceRate(attendanceRate: number): void {
  if (!Number.isFinite(attendanceRate) || attendanceRate < 0 || attendanceRate > 1) {
    throw new RangeError(`attendanceRate must be a finite number within [0, 1], got ${attendanceRate}.`);
  }
}

function assertValidExerciseScore(input: ExerciseScoreInput): void {
  const { score, maxScore } = input;
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    throw new RangeError(`maxScore must be a positive finite number, got ${maxScore}.`);
  }
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    throw new RangeError(`score must be within [0, maxScore] (${maxScore}), got ${score}.`);
  }
}

/**
 * Combines a student's graded-exercise scores (this period) with their
 * attendance rate (this period, `0..1`) into one final grade on a 0-10 scale.
 * Pure — callers (e.g. `submission.grade`'s FinalGrade recompute) gather the
 * inputs from the DB; this function only encodes the arithmetic.
 */
export function computeFinalGrade(
  exerciseScores: readonly ExerciseScoreInput[],
  attendanceRate: number,
): number {
  assertValidAttendanceRate(attendanceRate);
  for (const input of exerciseScores) {
    assertValidExerciseScore(input);
  }

  const exerciseComponent =
    exerciseScores.length === 0
      ? 0
      : exerciseScores.reduce((sum, { score, maxScore }) => sum + (score / maxScore) * FINAL_SCALE, 0) /
        exerciseScores.length;

  const attendanceComponent = attendanceRate * FINAL_SCALE;

  const final = exerciseComponent * EXERCISE_WEIGHT + attendanceComponent * ATTENDANCE_WEIGHT;
  // Round to 2 decimals — avoids float noise (e.g. 7.949999999999999) leaking
  // into the persisted FinalGrade.score.
  return Math.round(final * 100) / 100;
}

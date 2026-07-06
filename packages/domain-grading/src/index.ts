// @cmc/domain-grading — pure grading math (no Prisma import).
// This is the unit-test home for the final-grade formula (docs/19 §6, TL29
// §1); integration tests for `submission.grade`'s recompute wiring live in
// apps/api.

export { computeFinalGrade, type ExerciseScoreInput } from './compute-final-grade.js';

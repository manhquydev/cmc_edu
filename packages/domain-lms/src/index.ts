// @cmc/domain-lms — pure teaching-domain math (no Prisma).
// Ported from live cmc-lms packages/domain unit-progression (class-unit-spec).

export {
  SESSIONS_PER_UNIT,
  toProgramUnitAxis,
  contiguousProgramAxis,
  axisIndexOf,
  nextOrderOnAxis,
  previousOrderOnAxis,
  realOrdersInRange,
  rangeEndpointsOnAxis,
  deriveSessionUnits,
  isEntitled,
  remainingUnits,
  enrollmentCoversSession,
  validateNewRange,
  resolveReferenceAnchor,
  type ProgramUnitAxis,
  type OrderedSession,
  type SessionUnitStamp,
  type UnitRange,
  type ResolveReferenceAnchorError,
  type ResolveReferenceAnchorResult,
} from './unit-progression.js';

export {
  buildClassSequence,
  planSequenceUpdate,
  nextDeliverablePosition,
  type SequenceItem,
  type SequenceUpdatePlan,
} from './exercise-sequence.js';

export { resolvePackageGrantRange } from './package-grant.js';

export {
  NARRATIVE_MAX_CHARS,
  RUBRIC_PROGRAMS,
  SESSION_COMMENT_RUBRIC,
  coerceScore,
  criterionKeys,
  formatBand,
  isCompleteScores,
  isRubricProgram,
  isScore,
  isSessionCommentSatisfied,
  rubricFor,
  safeParseRubric,
  synthesizeRubricContent,
  type CriterionDef,
  type CriterionGroup,
  type NarrativeDef,
  type NarrativeKey,
  type RubricPayload,
  type RubricProgram,
  type RubricProgramId,
  type RubricScore,
} from './session-comment-rubric.js';

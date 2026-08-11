// @cmc/domain-lms — pure teaching-domain math (no Prisma).
// Ported from live cmc-lms packages/domain unit-progression (class-unit-spec).

export {
  SESSIONS_PER_UNIT,
  deriveSessionUnits,
  isEntitled,
  remainingUnits,
  enrollmentCoversSession,
  validateNewRange,
  resolveReferenceAnchor,
  type OrderedSession,
  type SessionUnitStamp,
  type UnitRange,
  type ResolveReferenceAnchorError,
  type ResolveReferenceAnchorResult,
} from './unit-progression.js';

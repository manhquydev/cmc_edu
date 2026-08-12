// Dual-gate teaching roster predicate (ADR 0045).
// Pure relative to domain-lms; callers load enrollment + ranges + session stamp.

import {
  enrollmentCoversSession,
  isEntitled,
  type UnitRange,
} from '@cmc/domain-lms';

/** Student lifecycle values that hide from teaching ops (monorepo enum). */
export const BLOCKED_TEACHING_LIFECYCLES = new Set(['blocked_lms', 'withdrawn']);

export interface RosterInputs {
  enrollmentStatus: string;
  studentLifecycle: string;
  /** UTC-midnight day of archive, or null. */
  archivedDayUtc: Date | null;
  sessionDate: Date;
  /** orderGlobal of session stamp; null ⇒ fail-closed. */
  sessionOrderGlobal: number | null;
  ranges: UnitRange[];
}

/**
 * True when HS may appear on teaching roster for this session.
 * Fail-closed on null session unit stamp.
 */
export function onRoster(input: RosterInputs): boolean {
  if (input.enrollmentStatus !== 'active') return false;
  if (BLOCKED_TEACHING_LIFECYCLES.has(input.studentLifecycle)) return false;
  if (!enrollmentCoversSession(input.archivedDayUtc, input.sessionDate)) return false;
  if (input.sessionOrderGlobal == null) return false;
  return isEntitled(input.ranges, input.sessionOrderGlobal);
}

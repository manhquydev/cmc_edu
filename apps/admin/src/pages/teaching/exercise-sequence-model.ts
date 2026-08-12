// Pure helpers for the class exercise-sequence work surface.
// listExerciseSequence returns { items } only — never guess deliveredCount from
// sessions. Save is allowed only for a first assign (empty server sequence) or
// after assignExerciseSequence returns deliveredCount in this session.

export const EXERCISE_SEQUENCE_PATH = '/teaching/classes/:classBatchId/exercise-sequence';

export function exerciseSequencePath(classBatchId: string): string {
  return `/teaching/classes/${classBatchId}/exercise-sequence`;
}

export interface SequenceSession {
  id: string;
  status: string;
  sessionDate: Date | string;
  endTime: Date | string;
  curriculumUnitId: string | null;
}

export interface SequenceItem {
  position: number;
  exerciseId: string;
}

/** Sessions that still need a homework slot: not cancelled, not already consumed by the freeze pointer. */
export function remainingSessionCount(
  sessions: readonly SequenceSession[],
  deliveredCount: number,
): number {
  const active = sessions.filter((s) => s.status !== 'cancelled').length;
  return Math.max(0, active - Math.max(0, deliveredCount));
}

export function chronologicalActiveSessions(
  sessions: readonly SequenceSession[],
): SequenceSession[] {
  return sessions
    .filter((s) => s.status !== 'cancelled')
    .slice()
    .sort((a, b) => {
      const end = new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
      if (end !== 0) return end;
      return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
    });
}

/** Session that will receive the next deliverable sequence position. */
export function nextDeliverySession(
  sessions: readonly SequenceSession[],
  deliveredCount: number,
): SequenceSession | null {
  return chronologicalActiveSessions(sessions)[Math.max(0, deliveredCount)] ?? null;
}

export function sessionForPosition(
  sessions: readonly SequenceSession[],
  position: number,
): SequenceSession | null {
  return chronologicalActiveSessions(sessions)[position - 1] ?? null;
}

export function isPositionFrozen(position: number, deliveredCount: number): boolean {
  return deliveredCount > 0 && position <= deliveredCount;
}

export function tailExerciseIds(
  items: readonly SequenceItem[],
  deliveredCount: number,
): string[] {
  return items
    .filter((item) => item.position > deliveredCount)
    .sort((a, b) => a.position - b.position)
    .map((item) => item.exerciseId);
}

export function buildDisplaySequence(
  frozen: readonly SequenceItem[],
  tailIds: readonly string[],
  deliveredCount: number,
): SequenceItem[] {
  const kept = frozen
    .filter((item) => item.position <= deliveredCount)
    .sort((a, b) => a.position - b.position);
  const tail = tailIds.map((exerciseId, i) => ({
    position: deliveredCount + 1 + i,
    exerciseId,
  }));
  return [...kept, ...tail];
}

export function isSequenceEmpty(itemCount: number): boolean {
  return itemCount === 0;
}

/** Compare unlocked tail to remaining sessions — not total length to remaining. */
export function isSequenceShort(tailLength: number, remainingSessions: number): boolean {
  return tailLength > 0 && tailLength < remainingSessions;
}

export function canAddExercise(opts: {
  status: string;
  exerciseId: string;
  alreadyInSequence: ReadonlySet<string>;
}): boolean {
  return opts.status === 'published' && !opts.alreadyInSequence.has(opts.exerciseId);
}

export function moveTailId(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const next = ids.slice();
  const target = index + delta;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  const tmp = next[index]!;
  next[index] = next[target]!;
  next[target] = tmp;
  return next;
}

export function formatSessionDay(value: Date | string): string {
  return new Date(value).toLocaleDateString('vi-VN');
}

/**
 * True when we know the server freeze pointer: first assign (empty sequence ⇒ 0)
 * or assignExerciseSequence already returned deliveredCount this session.
 */
export function hasAuthoritativeFreeze(
  serverItemCount: number,
  authoritativeDeliveredCount: number | null,
): boolean {
  return serverItemCount === 0 || authoritativeDeliveredCount !== null;
}

export function canSafelySaveSequence(opts: {
  serverItemCount: number;
  authoritativeDeliveredCount: number | null;
  dirty: boolean;
  tailIds: readonly string[];
  tailAllPublished: boolean;
  readOnly: boolean;
}): boolean {
  if (opts.readOnly || !opts.dirty || opts.tailIds.length === 0 || !opts.tailAllPublished) {
    return false;
  }
  return hasAuthoritativeFreeze(opts.serverItemCount, opts.authoritativeDeliveredCount);
}

export function tailHasUnpublished(
  tailIds: readonly string[],
  statusById: ReadonlyMap<string, string>,
): boolean {
  return tailIds.some((id) => statusById.get(id) !== 'published');
}

// Class exercise sequence + delivery pointer (class-unit-spec §8, ported from cmc-lms).
// Pure: no Prisma. Monorepo uses Exercise ids (not ExerciseFile).

/** One frozen slot in a class exercise sequence. */
export interface SequenceItem {
  position: number;
  exerciseId: string;
}

export interface SequenceUpdatePlan {
  /** Positions already delivered — never rewritten. */
  kept: SequenceItem[];
  /** New items for positions after the freeze boundary. */
  replaced: SequenceItem[];
  droppedCount: number;
}

/**
 * Build a flat sequence from ordered exercise ids starting at `startPosition`.
 */
export function buildClassSequence(exerciseIds: readonly string[], startPosition = 1): SequenceItem[] {
  return exerciseIds.map((exerciseId, i) => ({
    position: startPosition + i,
    exerciseId,
  }));
}

/**
 * Keep items with position <= deliveredCount; replace the rest from new exercise ids.
 * `deliveredCount` is MAX(position) among SessionExercise rows (freeze boundary).
 */
export function planSequenceUpdate(
  current: SequenceItem[],
  newExerciseIds: readonly string[],
  deliveredCount: number,
): SequenceUpdatePlan {
  const sorted = [...current].sort((a, b) => a.position - b.position);
  const kept = sorted.filter((item) => item.position <= deliveredCount);
  const droppedCount = sorted.length - kept.length;
  const replaced = buildClassSequence(newExerciseIds, deliveredCount + 1);
  return { kept, replaced, droppedCount };
}

/**
 * Next position to deliver: smallest position in [1, sequenceLength] without a
 * live SessionExercise (gap-aware — cancelled undelivered positions are reused).
 * `null` when sequence is exhausted.
 */
export function nextDeliverablePosition(
  deliveredPositions: readonly number[],
  sequenceLength: number,
): number | null {
  const delivered = new Set(deliveredPositions);
  for (let position = 1; position <= sequenceLength; position += 1) {
    if (!delivered.has(position)) return position;
  }
  return null;
}

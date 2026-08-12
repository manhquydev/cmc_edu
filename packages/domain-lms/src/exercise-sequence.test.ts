import { describe, expect, it } from 'vitest';
import {
  buildClassSequence,
  nextDeliverablePosition,
  planSequenceUpdate,
} from './exercise-sequence.js';

describe('buildClassSequence', () => {
  it('numbers from 1 by default', () => {
    expect(buildClassSequence(['a', 'b', 'c'])).toEqual([
      { position: 1, exerciseId: 'a' },
      { position: 2, exerciseId: 'b' },
      { position: 3, exerciseId: 'c' },
    ]);
  });

  it('respects startPosition', () => {
    expect(buildClassSequence(['x'], 4)).toEqual([{ position: 4, exerciseId: 'x' }]);
  });
});

describe('planSequenceUpdate', () => {
  it('keeps delivered prefix and replaces the rest', () => {
    const current = buildClassSequence(['old1', 'old2', 'old3']);
    const plan = planSequenceUpdate(current, ['newA', 'newB'], 1);
    expect(plan.kept).toEqual([{ position: 1, exerciseId: 'old1' }]);
    expect(plan.replaced).toEqual([
      { position: 2, exerciseId: 'newA' },
      { position: 3, exerciseId: 'newB' },
    ]);
    expect(plan.droppedCount).toBe(2);
  });

  it('when nothing delivered, replaces entire sequence', () => {
    const plan = planSequenceUpdate(buildClassSequence(['a']), ['b', 'c'], 0);
    expect(plan.kept).toEqual([]);
    expect(plan.replaced.map((i) => i.exerciseId)).toEqual(['b', 'c']);
  });
});

describe('nextDeliverablePosition', () => {
  it('returns 1 when nothing delivered', () => {
    expect(nextDeliverablePosition([], 3)).toBe(1);
  });

  it('returns first gap', () => {
    expect(nextDeliverablePosition([1, 3], 3)).toBe(2);
  });

  it('returns null when sequence full', () => {
    expect(nextDeliverablePosition([1, 2, 3], 3)).toBeNull();
  });
});

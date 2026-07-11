import { describe, expect, it } from 'vitest';
import { aggregateByBatch } from './revenue-report.js';

// Pure-fn unit test (no render needed), mirroring the cockpit-counter.test.ts
// pattern. Locks `aggregateByBatch`'s grouping/sorting/labeling BEFORE the
// dashboard reshape (phase-04) — logic must stay byte-identical, only the
// card/panel presentation changes.
describe('aggregateByBatch', () => {
  it('groups approved receipts by classBatchId and sums netAmount/count', () => {
    const rows = aggregateByBatch([
      { classBatchId: 'b1', netAmount: 1_000_000, status: 'approved' },
      { classBatchId: 'b1', netAmount: 2_000_000, status: 'approved' },
      { classBatchId: 'b2', netAmount: 500_000, status: 'approved' },
    ]);
    expect(rows).toEqual([
      { classBatchId: 'b1', label: expect.stringContaining('b1'), count: 2, total: 3_000_000 },
      { classBatchId: 'b2', label: expect.stringContaining('b2'), count: 1, total: 500_000 },
    ]);
  });

  it('excludes non-approved receipts from aggregation', () => {
    const rows = aggregateByBatch([
      { classBatchId: 'b1', netAmount: 1_000_000, status: 'approved' },
      { classBatchId: 'b1', netAmount: 5_000_000, status: 'draft' },
      { classBatchId: 'b1', netAmount: 5_000_000, status: 'cancelled' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 1, total: 1_000_000 });
  });

  it('groups a null classBatchId under the "(Không rõ lớp)" bucket', () => {
    const rows = aggregateByBatch([
      { classBatchId: null, netAmount: 1_000_000, status: 'approved' },
      { classBatchId: null, netAmount: 500_000, status: 'approved' },
    ]);
    expect(rows).toEqual([{ classBatchId: '__unknown__', label: '(Không rõ lớp)', count: 2, total: 1_500_000 }]);
  });

  it('sorts groups by total descending', () => {
    const rows = aggregateByBatch([
      { classBatchId: 'small', netAmount: 100, status: 'approved' },
      { classBatchId: 'big', netAmount: 900, status: 'approved' },
      { classBatchId: 'mid', netAmount: 500, status: 'approved' },
    ]);
    expect(rows.map((r) => r.classBatchId)).toEqual(['big', 'mid', 'small']);
  });

  it('returns an empty array for no input', () => {
    expect(aggregateByBatch([])).toEqual([]);
  });
});

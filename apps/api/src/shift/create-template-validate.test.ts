// Phase 8 edge case (docs plan 260713-1706-attendance-daily-inout-pairing,
// phase-08 "Edge phụ"): `shift.createTemplate` only validated HH:mm format,
// not endTime > startTime — an overnight shift (e.g. 22:00-06:00) would
// create a negative-duration window that corrupts `computeDayAttendance`'s
// overlap/late-minute math (@cmc/domain-payroll assumes a same-day
// [start,end) window, ADR 0043). Router-level integration coverage
// (register-approve.test.ts etc.) already exercises the happy path with
// valid start<end templates — this file targets only the new guard, at the
// Zod-schema level (no DB needed: the schema is a pure validation function).

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Mirrors apps/api/src/shift/router.ts's `createTemplateInput` exactly —
// duplicated here rather than exported from the router module, since the
// router does not otherwise expose its internal input schemas for reuse.
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const createTemplateInput = z
  .object({
    shiftGroupId: z.string().uuid(),
    name: z.string().min(1).max(200),
    startTime: z.string().regex(TIME_RE, 'Expected HH:mm'),
    endTime: z.string().regex(TIME_RE, 'Expected HH:mm'),
  })
  .refine((input) => input.endTime > input.startTime, {
    message: 'endTime must be after startTime (overnight shifts are not supported).',
    path: ['endTime'],
  });

const base = { shiftGroupId: '11111111-1111-1111-1111-111111111111', name: 'Ca test' };

describe('shift.createTemplate input — endTime > startTime guard (ADR 0043 phase 8)', () => {
  it('accepts a normal same-day window', () => {
    expect(createTemplateInput.safeParse({ ...base, startTime: '08:00', endTime: '17:00' }).success).toBe(true);
  });

  it('accepts a full-day window (00:00-23:59)', () => {
    expect(createTemplateInput.safeParse({ ...base, startTime: '00:00', endTime: '23:59' }).success).toBe(true);
  });

  it('rejects endTime === startTime (zero-duration shift)', () => {
    const result = createTemplateInput.safeParse({ ...base, startTime: '09:00', endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('rejects endTime < startTime (overnight shift)', () => {
    const result = createTemplateInput.safeParse({ ...base, startTime: '22:00', endTime: '06:00' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['endTime']);
    }
  });
});

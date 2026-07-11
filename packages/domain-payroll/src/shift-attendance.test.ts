// assignPunchesToShifts unit tests (R3-6/R3-7 per-shift punch pairing).

import { describe, expect, it } from 'vitest';
import { assignPunchesToShifts, type ShiftWindow } from './shift-attendance.js';

function at(hhmm: string, day = '2099-06-10'): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
}

const SALE_SHIFT: ShiftWindow = { id: 'sale-1', start: at('08:30'), end: at('18:00') };

describe('assignPunchesToShifts — single shift/day (SINGLE mode)', () => {
  it('on-time in/out: present, no late/early', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('08:30'), at('18:00')]);
    expect(result.shifts[0]).toMatchObject({ present: true, lateMinutes: 0, earlyMinutes: 0 });
    expect(result.unassignedPunches).toHaveLength(0);
  });

  it('late in-punch → lateMinutes = in − start', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('08:45'), at('18:00')]);
    expect(result.shifts[0]).toMatchObject({ present: true, lateMinutes: 15, earlyMinutes: 0 });
  });

  it('early out-punch → earlyMinutes = end − out', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('08:30'), at('17:30')]);
    expect(result.shifts[0]).toMatchObject({ present: true, lateMinutes: 0, earlyMinutes: 30 });
  });

  it('in-punch takes the EARLIEST candidate in [start-2h, midpoint)', () => {
    // 07:00 and 08:00 both fall before start; earliest (07:00) wins as "in".
    const result = assignPunchesToShifts([SALE_SHIFT], [at('07:00'), at('08:00'), at('18:00')]);
    expect(result.shifts[0].present).toBe(true);
    // in = 07:00 is BEFORE start (08:30) → not late, so lateMinutes = 0.
    expect(result.shifts[0].lateMinutes).toBe(0);
    // 08:00 is unassigned (not the earliest, and not needed as "out").
    expect(result.unassignedPunches).toHaveLength(1);
  });

  it('out-punch takes the LATEST candidate in [midpoint, end+2h]', () => {
    // A stray mid-day punch (13:00) should NOT be mistaken for clock-out —
    // the true final punch (18:10) must win.
    const result = assignPunchesToShifts([SALE_SHIFT], [at('08:30'), at('13:00'), at('18:10')]);
    expect(result.shifts[0]).toMatchObject({ present: true, lateMinutes: 0, earlyMinutes: 0 });
    expect(result.unassignedPunches).toHaveLength(1);
    expect(result.unassignedPunches[0]!.getTime()).toBe(at('13:00').getTime());
  });

  it('missing in-punch → shift absent (no wage, no penalty)', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('18:00')]);
    expect(result.shifts[0]).toMatchObject({ present: false, lateMinutes: 0, earlyMinutes: 0 });
  });

  it('missing out-punch → shift absent (no wage, no penalty)', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('08:30')]);
    expect(result.shifts[0]).toMatchObject({ present: false, lateMinutes: 0, earlyMinutes: 0 });
  });

  it('zero punches → shift absent', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], []);
    expect(result.shifts[0]).toMatchObject({ present: false });
  });

  it('punches entirely outside the ±2h grace window are unassigned, shift absent', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('04:00'), at('23:00')]);
    expect(result.shifts[0].present).toBe(false);
    expect(result.unassignedPunches).toHaveLength(2);
  });

  it('shortSpan flags an in→out gap under 50% of shift duration', () => {
    // Shift is 9.5h (midpoint 13:15) — in must be < midpoint, out >= midpoint,
    // so the shortest possible legitimate span straddles the midpoint.
    // 13:00→13:20 is a 20min span, well under 50% of 9.5h (4h45).
    const result = assignPunchesToShifts([SALE_SHIFT], [at('13:00'), at('13:20')]);
    expect(result.shifts[0]).toMatchObject({ present: true, shortSpan: true });
  });

  it('a full-duration span is NOT flagged shortSpan', () => {
    const result = assignPunchesToShifts([SALE_SHIFT], [at('08:30'), at('18:00')]);
    expect(result.shifts[0].shortSpan).toBe(false);
  });
});

describe('assignPunchesToShifts — GV MULTIPLE mode (2 back-to-back shifts/day)', () => {
  const CA1: ShiftWindow = { id: 'ca1', start: at('08:00'), end: at('12:00') };
  const CA2: ShiftWindow = { id: 'ca2', start: at('13:00'), end: at('17:00') };

  it('on-time punches for both shifts pair correctly despite overlapping ±2h grace windows', () => {
    // ca1 out (12:05) and ca2 in (12:55) both fall in the naive [10:00,14:00] ∩
    // [11:00,15:00) overlap — the gap-midpoint clamp (12:30) must separate them.
    const punches = [at('07:55'), at('12:05'), at('12:55'), at('17:05')];
    const result = assignPunchesToShifts([CA1, CA2], punches);

    expect(result.shifts).toHaveLength(2);
    const [ca1Result, ca2Result] = result.shifts;
    expect(ca1Result).toMatchObject({ id: 'ca1', present: true, lateMinutes: 0, earlyMinutes: 0 });
    expect(ca2Result).toMatchObject({ id: 'ca2', present: true, lateMinutes: 0, earlyMinutes: 0 });
    expect(result.unassignedPunches).toHaveLength(0);
  });

  it('a punch is never reused across shifts — pool depletes in start-time order', () => {
    // Only 3 punches for 2 shifts: ca1 gets a full pair, ca2 gets only an in.
    const punches = [at('07:55'), at('12:05'), at('12:55')];
    const result = assignPunchesToShifts([CA1, CA2], punches);
    expect(result.shifts[0]).toMatchObject({ id: 'ca1', present: true });
    expect(result.shifts[1]).toMatchObject({ id: 'ca2', present: false });
  });

  it('one absent shift does not affect the other shift\'s penalty (per-ca independence)', () => {
    // ca1 fully missing punches (absent, no penalty); ca2 has a late in-punch.
    const punches = [at('13:20'), at('17:00')];
    const result = assignPunchesToShifts([CA1, CA2], punches);
    expect(result.shifts[0]).toMatchObject({ id: 'ca1', present: false, lateMinutes: 0 });
    expect(result.shifts[1]).toMatchObject({ id: 'ca2', present: true, lateMinutes: 20 });
  });

  it('deterministic: identical results regardless of punch array input order', () => {
    const punches = [at('12:05'), at('07:55'), at('17:05'), at('12:55')];
    const result = assignPunchesToShifts([CA1, CA2], punches);
    expect(result.shifts[0]).toMatchObject({ present: true, lateMinutes: 0, earlyMinutes: 0 });
    expect(result.shifts[1]).toMatchObject({ present: true, lateMinutes: 0, earlyMinutes: 0 });
  });

  it('zero-gap back-to-back shifts (ca2 end === ca3 start) still separate punches', () => {
    const ca2: ShiftWindow = { id: 'ca2', start: at('13:00'), end: at('17:00') };
    const ca3: ShiftWindow = { id: 'ca3', start: at('17:00'), end: at('21:00') };
    const punches = [at('12:55'), at('16:58'), at('17:02'), at('21:05')];
    const result = assignPunchesToShifts([ca2, ca3], punches);
    expect(result.shifts[0]).toMatchObject({ id: 'ca2', present: true });
    expect(result.shifts[1]).toMatchObject({ id: 'ca3', present: true });
  });
});

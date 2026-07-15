// resolveDayCredit — shared payroll↔KPI day-validity + credit resolver
// (ADR 0043 phase 5, red-team R2: payroll and KPI must never disagree on
// which days/shifts count, so both call this instead of each re-deriving
// dayValid independently).

import { describe, expect, it } from 'vitest';
import { resolveDayCredit } from './resolve-day-credit.js';

function at(hhmm: string, day = '2099-06-10'): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
}

const SHIFT = { id: 'ca-1', start: at('09:00'), end: at('17:00') };

describe('resolveDayCredit', () => {
  it('all punches within network → uses live punches, present with correct late/early', () => {
    const result = resolveDayCredit({
      shifts: [SHIFT],
      dayPunches: [
        { punchAt: at('09:10'), withinNetwork: true },
        { punchAt: at('17:00'), withinNetwork: true },
      ],
      ticket: undefined,
    });
    expect(result.present).toBe(true);
    expect(result.creditedShiftIds).toEqual(['ca-1']);
    expect(result.lateMinutes).toBe(10);
    expect(result.earlyMinutes).toBe(0);
  });

  it('offsite punch, no ticket → not valid, unpunched', () => {
    const result = resolveDayCredit({
      shifts: [SHIFT],
      dayPunches: [{ punchAt: at('09:00'), withinNetwork: false }],
      ticket: undefined,
    });
    expect(result.present).toBe(false);
    expect(result.creditedShiftIds).toEqual([]);
  });

  it('offsite, ticket pending → not valid, unpunched (even though checkInAt/checkOutAt exist on ticket)', () => {
    const result = resolveDayCredit({
      shifts: [SHIFT],
      dayPunches: [
        { punchAt: at('09:00'), withinNetwork: false },
        { punchAt: at('17:00'), withinNetwork: false },
      ],
      ticket: { status: 'pending', checkInAt: at('09:00'), checkOutAt: at('17:00') },
    });
    expect(result.present).toBe(false);
  });

  it('offsite, ticket rejected → not valid, unpunched', () => {
    const result = resolveDayCredit({
      shifts: [SHIFT],
      dayPunches: [
        { punchAt: at('09:00'), withinNetwork: false },
        { punchAt: at('17:00'), withinNetwork: false },
      ],
      ticket: { status: 'rejected', checkInAt: at('09:00'), checkOutAt: at('17:00') },
    });
    expect(result.present).toBe(false);
  });

  it('offsite, ticket approved → uses TICKET checkInAt/checkOutAt (frozen), not live punches', () => {
    // Live punches show a LATER checkout (19:00) than the frozen ticket
    // (17:00) — R1: must use the frozen ticket, not the live punch.
    const result = resolveDayCredit({
      shifts: [SHIFT],
      dayPunches: [
        { punchAt: at('09:00'), withinNetwork: false },
        { punchAt: at('19:00'), withinNetwork: false },
      ],
      ticket: { status: 'approved', checkInAt: at('09:00'), checkOutAt: at('17:00') },
    });
    expect(result.present).toBe(true);
    expect(result.earlyMinutes).toBe(0); // 17:00 checkout vs shift end 17:00, not 19:00
  });

  it('offsite, ticket approved but checkOutAt null (only 1 punch that day) → not valid', () => {
    const result = resolveDayCredit({
      shifts: [SHIFT],
      dayPunches: [{ punchAt: at('09:00'), withinNetwork: false }],
      ticket: { status: 'approved', checkInAt: at('09:00'), checkOutAt: null },
    });
    expect(result.present).toBe(false);
  });

  it('no punches at all → not valid', () => {
    const result = resolveDayCredit({ shifts: [SHIFT], dayPunches: [], ticket: undefined });
    expect(result.present).toBe(false);
  });
});

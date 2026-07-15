// computeDayAttendance — daily in/out attendance pairing (ADR 0043,
// docs/decisions/0043-attendance-daily-inout-pairing.md). Supersedes the
// per-shift ±2h pairing (`assignPunchesToShifts`, removed) that
// plans/260711-1752-hr-kpi-shift-attendance-remediation introduced.
//
// Model (validated + red-teamed, plans/260713-1706-attendance-daily-inout-pairing):
//   - checkin = earliest punch of the day; checkout = latest punch of the
//     day. A day needs >=2 punches (checkin !== checkout) to have a checkout
//     at all — a single punch is recorded (checkInAt) but earns no credit.
//   - A registered shift is credited ("có công") only when its window
//     [start,end) OVERLAPS the day's [checkin,checkout) pair — strict
//     overlap: `start < checkout && end > checkin`. A shift the pair never
//     touches (arrived after it ended, or left before it started) earns
//     nothing and does NOT distort the late/early calculation.
//   - late/early are computed ONCE per day, against the tightest window that
//     covers every CREDITED shift (earliest credited start, latest credited
//     end) — not every registered shift.
//
// Pure — no DB access, no mutation of inputs.

export interface ShiftWindow {
  /** Caller-supplied identifier (e.g. `ShiftRegistrationEntry.id`) to correlate results back. */
  id: string;
  /** UTC instant the shift starts. */
  start: Date;
  /** UTC instant the shift ends. */
  end: Date;
}

export interface DayAttendanceInput {
  /** All shifts registered for this calendar day (any order). */
  shifts: readonly ShiftWindow[];
  /** All punches recorded for this calendar day (any order). */
  punches: readonly Date[];
}

export interface DayAttendanceResult {
  /** True only when >=1 shift is credited (implies checkOutAt !== null). */
  present: boolean;
  /** Earliest punch of the day, or null if there were none. */
  checkInAt: Date | null;
  /** Latest punch of the day, or null if there were fewer than 2 punches. */
  checkOutAt: Date | null;
  /** ids of shifts whose window overlaps [checkInAt, checkOutAt). */
  creditedShiftIds: string[];
  /** max(0, checkInAt − earliest credited shift's start), rounded, minutes. 0 if not present. */
  lateMinutes: number;
  /** max(0, latest credited shift's end − checkOutAt), rounded, minutes. 0 if not present. */
  earlyMinutes: number;
}

export function computeDayAttendance(input: DayAttendanceInput): DayAttendanceResult {
  const sortedPunches = [...input.punches].sort((a, b) => a.getTime() - b.getTime());

  const checkInAt = sortedPunches.length > 0 ? sortedPunches[0]! : null;
  const checkOutAt = sortedPunches.length >= 2 ? sortedPunches[sortedPunches.length - 1]! : null;

  if (checkInAt === null || checkOutAt === null) {
    return { present: false, checkInAt, checkOutAt: null, creditedShiftIds: [], lateMinutes: 0, earlyMinutes: 0 };
  }

  const checkIn = checkInAt.getTime();
  const checkOut = checkOutAt.getTime();

  const credited = input.shifts.filter(
    (shift) => shift.start.getTime() < checkOut && shift.end.getTime() > checkIn,
  );

  if (credited.length === 0) {
    return { present: false, checkInAt, checkOutAt, creditedShiftIds: [], lateMinutes: 0, earlyMinutes: 0 };
  }

  const earliestStart = Math.min(...credited.map((s) => s.start.getTime()));
  const latestEnd = Math.max(...credited.map((s) => s.end.getTime()));
  const lateMinutes = Math.max(0, Math.round((checkIn - earliestStart) / 60_000));
  const earlyMinutes = Math.max(0, Math.round((latestEnd - checkOut) / 60_000));

  return {
    present: true,
    checkInAt,
    checkOutAt,
    creditedShiftIds: credited.map((s) => s.id),
    lateMinutes,
    earlyMinutes,
  };
}

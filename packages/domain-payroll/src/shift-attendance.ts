// assignPunchesToShifts — per-shift punch pairing (R3-6/R3-7, QĐ0025).
//
// Pure — no DB access. Shared between payroll (late/early penalty, this
// package's `assemble-slip.ts` caller in apps/api) and the future KPI
// auto-score "công ca thực" attendance count (phase 3), hence living here
// rather than inline in a router.
//
// Rule (validate session 4 — "sớm muộn KHÔNG mất ca"):
//   - in-punch  = EARLIEST unused punch in [start−2h, midpoint)
//   - out-punch = LATEST unused punch in [midpoint, end+2h]
//   - late  = max(0, in − start); early = max(0, end − out)
//   - a punch consumed by one shift is never reused by another — the pool is
//     depleted greedily, processing shifts in the caller-supplied order
//     (MUST be sorted by `start` ascending — deterministic per R3-6)
//   - missing either half of the pair ⇒ the shift is "vắng" (absent): no
//     wage, no minute penalty — the caller counts it as unpunched instead
//   - `shortSpan` flags an in→out span under 50% of the shift's nominal
//     duration (R3-7 anti-gaming). Payroll does not act on this; the future
//     KPI refresh surfaces it to a director for review.
//
// Back-to-back shifts (e.g. GV's ca1 08:00–12:00 / ca2 13:00–17:00, only a
// 1h gap) would otherwise make each shift's ±2h grace period overlap its
// neighbor's — a punch at 12:55 could match BOTH ca1's out-window
// ([10:00,14:00]) and ca2's in-window ([11:00,15:00)). To keep the pairing
// deterministic and correct for MULTIPLE-mode days, each shift's grace
// window is additionally clamped at the midpoint of the gap to its adjacent
// shift, so two neighbors' windows never overlap and cannot steal each
// other's punches.

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export interface ShiftWindow {
  /** Caller-supplied identifier (e.g. `ShiftRegistrationEntry.id`) to correlate results back. */
  id: string;
  /** UTC instant the shift starts. */
  start: Date;
  /** UTC instant the shift ends. */
  end: Date;
}

export interface ShiftAttendanceOutcome {
  id: string;
  /** True only when BOTH an in-punch and an out-punch were assigned. */
  present: boolean;
  /** max(0, in − start) minutes, rounded. 0 when absent. */
  lateMinutes: number;
  /** max(0, end − out) minutes, rounded. 0 when absent. */
  earlyMinutes: number;
  /** True when present AND (out − in) < 50% of (end − start) — anti-gaming flag. */
  shortSpan: boolean;
}

export interface AssignPunchesResult {
  shifts: ShiftAttendanceOutcome[];
  /** Punches from the input pool never assigned to any shift's in/out slot. */
  unassignedPunches: Date[];
}

/**
 * Assigns punches to shifts for ONE calendar day (all shifts on that day
 * share the same punch pool). `shifts` MUST already be sorted by `start`
 * ascending — this function does not sort them, so callers control the
 * deterministic processing order the business rule requires.
 */
export function assignPunchesToShifts(
  shifts: readonly ShiftWindow[],
  punches: readonly Date[],
): AssignPunchesResult {
  const pool = [...punches].sort((a, b) => a.getTime() - b.getTime());
  const used = new Array<boolean>(pool.length).fill(false);
  const outcomes: ShiftAttendanceOutcome[] = [];

  for (let idx = 0; idx < shifts.length; idx++) {
    const shift = shifts[idx]!;
    const prev = shifts[idx - 1];
    const next = shifts[idx + 1];
    const midpoint = shift.start.getTime() + (shift.end.getTime() - shift.start.getTime()) / 2;

    // Clamp the grace window at the midpoint of the gap to the neighboring
    // shift so adjacent shifts' ±2h windows never overlap (see module doc).
    const lowerClamp = prev ? (prev.end.getTime() + shift.start.getTime()) / 2 : -Infinity;
    const upperClamp = next ? (shift.end.getTime() + next.start.getTime()) / 2 : Infinity;

    const inWindowStart = Math.max(shift.start.getTime() - TWO_HOURS_MS, lowerClamp);
    const outWindowEnd = Math.min(shift.end.getTime() + TWO_HOURS_MS, upperClamp);

    let inIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      if (used[i]) continue;
      const t = pool[i]!.getTime();
      if (t >= inWindowStart && t < midpoint) {
        inIdx = i;
        break; // pool sorted ascending → first unused match is the earliest.
      }
    }

    let outIdx = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (used[i] || i === inIdx) continue;
      const t = pool[i]!.getTime();
      if (t >= midpoint && t <= outWindowEnd) {
        outIdx = i;
        break; // pool sorted ascending → first hit scanning backward is the latest.
      }
    }

    if (inIdx === -1 || outIdx === -1) {
      // Consume whichever half WAS found so it cannot leak into a later
      // shift's assignment (R3-6 "pool loại dần theo thứ tự ca").
      if (inIdx !== -1) used[inIdx] = true;
      if (outIdx !== -1) used[outIdx] = true;
      outcomes.push({ id: shift.id, present: false, lateMinutes: 0, earlyMinutes: 0, shortSpan: false });
      continue;
    }

    used[inIdx] = true;
    used[outIdx] = true;

    const inPunch = pool[inIdx]!;
    const outPunch = pool[outIdx]!;
    const lateMinutes = Math.max(0, Math.round((inPunch.getTime() - shift.start.getTime()) / 60_000));
    const earlyMinutes = Math.max(0, Math.round((shift.end.getTime() - outPunch.getTime()) / 60_000));
    const duration = shift.end.getTime() - shift.start.getTime();
    const span = outPunch.getTime() - inPunch.getTime();
    const shortSpan = duration > 0 && span < duration * 0.5;

    outcomes.push({ id: shift.id, present: true, lateMinutes, earlyMinutes, shortSpan });
  }

  const unassignedPunches = pool.filter((_, i) => !used[i]);
  return { shifts: outcomes, unassignedPunches };
}

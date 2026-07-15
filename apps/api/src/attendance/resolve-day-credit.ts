// resolveDayCredit — shared payroll↔KPI day-validity + credit resolver
// (ADR 0043, red-team R2). Payroll (`payslip.assemble`) and KPI
// (`collectActualShifts`) must compute IDENTICAL day-level results — both
// call this instead of independently re-deriving "which punches count".
//
// Validity rule (ADR 0043 §"Hợp lệ tự động vs phiếu"):
//   - Every punch of the day within network → use the LIVE punches.
//   - Any offsite punch, with an APPROVED ticket for that day → use the
//     ticket's FROZEN checkInAt/checkOutAt (R1: never the live punches,
//     which may have grown since review — see checkin/router.ts's
//     ensureDayTicket "freeze on approve" invariant).
//   - Otherwise (offsite + no ticket, pending, resubmitted, or rejected) →
//     the day is not valid: no credit, no late/early.

import { computeDayAttendance, type ShiftWindow } from '@cmc/domain-payroll';

export interface DayPunch {
  punchAt: Date;
  withinNetwork: boolean;
}

export interface DayTicket {
  status: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
}

export interface ResolveDayCreditParams {
  shifts: readonly ShiftWindow[];
  dayPunches: readonly DayPunch[];
  ticket: DayTicket | undefined;
}

export interface DayCreditResult {
  present: boolean;
  creditedShiftIds: string[];
  lateMinutes: number;
  earlyMinutes: number;
}

const NOT_VALID: DayCreditResult = { present: false, creditedShiftIds: [], lateMinutes: 0, earlyMinutes: 0 };

export function resolveDayCredit(params: ResolveDayCreditParams): DayCreditResult {
  const { shifts, dayPunches, ticket } = params;

  const allWithinNetwork = dayPunches.length > 0 && dayPunches.every((p) => p.withinNetwork);

  let pairingPunches: Date[];
  if (allWithinNetwork) {
    pairingPunches = dayPunches.map((p) => p.punchAt);
  } else if (ticket?.status === 'approved' && ticket.checkInAt && ticket.checkOutAt) {
    pairingPunches = [ticket.checkInAt, ticket.checkOutAt];
  } else {
    return NOT_VALID;
  }

  const result = computeDayAttendance({ shifts, punches: pairingPunches });
  return {
    present: result.present,
    creditedShiftIds: result.creditedShiftIds,
    lateMinutes: result.lateMinutes,
    earlyMinutes: result.earlyMinutes,
  };
}

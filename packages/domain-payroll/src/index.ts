// @cmc/domain-payroll — pure payroll calculation (P3-II, QĐ0025/0012).
// No runtime dependencies — all functions are pure and side-effect free.

export { assembleSlip, roundVnd } from './assemble-slip.js';
export type { AssembleSlipInput, PayslipData } from './assemble-slip.js';
export { computeDayAttendance } from './day-attendance.js';
export type { ShiftWindow, DayAttendanceInput, DayAttendanceResult } from './day-attendance.js';

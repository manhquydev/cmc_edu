// ICT (Indochina Time, UTC+7, no DST) wall-clock <-> UTC instant conversions
// for class scheduling and HR/attendance (docs/26 WF-P2-01, WF-P3-01, TL19
// §4-5). Extracted from apps/api/src/class/ict-time.ts into a shared package
// so payroll (P3-II) and other consumers can import without depending on the
// api app.

const ICT_OFFSET_MINUTES = 7 * 60;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateOnly(value: string): boolean {
  return DATE_ONLY_RE.test(value);
}

export function isValidTimeOfDay(value: string): boolean {
  return TIME_OF_DAY_RE.test(value);
}

/**
 * The ICT weekday (0=Sunday .. 6=Saturday, JS `Date#getDay()` convention) of a
 * `YYYY-MM-DD` calendar date. A pure Y-M-D triple has no timezone of its own,
 * so this is computed via `Date.UTC` directly (no ICT shift needed here) --
 * only wall-clock TIME needs the ICT conversion (`ictToUtc` below).
 */
export function weekdayOf(dateOnly: string): number {
  const match = dateOnly.match(DATE_ONLY_RE);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${dateOnly}".`);
  const [, y, m, d] = match as [string, string, string, string];
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
}

/** Converts a `YYYY-MM-DD` + `HH:mm` ICT wall-clock pair into the UTC instant it denotes. */
export function ictToUtc(dateOnly: string, timeOfDay: string): Date {
  const dateMatch = dateOnly.match(DATE_ONLY_RE);
  const timeMatch = timeOfDay.match(TIME_OF_DAY_RE);
  if (!dateMatch) throw new RangeError(`Expected YYYY-MM-DD, got "${dateOnly}".`);
  if (!timeMatch) throw new RangeError(`Expected HH:mm, got "${timeOfDay}".`);
  const [, y, m, d] = dateMatch as [string, string, string, string];
  const [, h, min] = timeMatch as [string, string, string];
  const utcMillis =
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), 0, 0) -
    ICT_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis);
}

/**
 * The inverse of `ictToUtc(dateOnly, '00:00')`: recovers the ICT calendar
 * date of an instant that was stored as ICT midnight (e.g.
 * `ClassBatch.startDate`/`endDate`, `ClassSession.sessionDate`).
 */
export function ictDateOnlyOf(instant: Date): string {
  const shifted = new Date(instant.getTime() + ICT_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The `YYYY-MM` ICT calendar month an instant falls in (TL19 §5: "điểm danh
 * bucket theo tháng ICT của thời điểm kết thúc buổi" — attendance's reporting
 * bucket is the ICT month of the session's END time, a stable UTC+7 month
 * boundary rather than the naive UTC month, which can disagree near
 * midnight). Reuses the same ICT shift as `ictDateOnlyOf`, truncated to month.
 */
export function ictMonthOf(instant: Date): string {
  return ictDateOnlyOf(instant).slice(0, 7);
}

/** Adds `days` calendar days to a `YYYY-MM-DD` date, returning `YYYY-MM-DD`. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const match = dateOnly.match(DATE_ONLY_RE);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${dateOnly}".`);
  const [, y, m, d] = match as [string, string, string, string];
  const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + days));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/** Lexicographic comparison works directly on zero-padded `YYYY-MM-DD` strings. */
export function compareDateOnly(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type DueLevel = 'late' | 'today' | 'future';

/**
 * Inclusive ICT-today start and exclusive tomorrow start, as UTC instants.
 * SQL due filters and `classifyDueLevel` must use this same pair so list
 * `?due=` and client chip colors cannot drift.
 */
export function ictDueBounds(now: Date): { startToday: Date; startTomorrow: Date } {
  const today = ictDateOnlyOf(now);
  return {
    startToday: ictToUtc(today, '00:00'),
    startTomorrow: ictToUtc(addDaysToDateOnly(today, 1), '00:00'),
  };
}

/**
 * CRM next-action due bucket from ICT calendar dates (not the machine
 * timezone, not a raw instant compare). `now` is an explicit argument so
 * tests and a tab left open overnight never silently freeze yesterday's
 * classification.
 */
export function classifyDueLevel(nextActionAt: Date, now: Date): DueLevel {
  const { startToday, startTomorrow } = ictDueBounds(now);
  const at = nextActionAt.getTime();
  if (at < startToday.getTime()) return 'late';
  if (at >= startTomorrow.getTime()) return 'future';
  return 'today';
}

/**
 * P3-II: Resolves the shift group type from a staff member's roles.
 * Pure function — no DB access. Holding the teacher role puts someone in the
 * teaching group; everyone else registers on the business/operations track.
 *
 * This used to read `AppUser.position`, a free-text job title. The match was
 * for the role identifier ('giao_vien'), while the staff form asks for a human
 * title, so a teacher entered as "Giáo viên" resolved to KINH_DOANH and was
 * refused every teaching shift group. Roles are the assignable, validated
 * field, so they decide.
 */
export function resolveShiftGroup(roles: readonly string[]): 'KINH_DOANH' | 'GIAO_VIEN' {
  return roles.includes('giao_vien') ? 'GIAO_VIEN' : 'KINH_DOANH';
}

const MONTH_ONLY_RE = /^(\d{4})-(\d{2})$/;

/**
 * The `[inclusive start, exclusive end)` UTC instants bounding an ICT
 * calendar month (`YYYY-MM`, the shape `ictMonthOf` returns). Used by T2-II's
 * `FinalGrade` recompute (`submission.grade`) to bucket graded submissions
 * and attendance rows into the same monthly window `ictMonthOf` already
 * assigns them to.
 */
export function ictMonthBounds(period: string): [Date, Date] {
  const match = period.match(MONTH_ONLY_RE);
  if (!match) throw new RangeError(`Expected YYYY-MM, got "${period}".`);
  const [, y, m] = match as [string, string, string];
  const year = Number(y);
  const month = Number(m);
  const start = ictToUtc(`${y}-${m}-01`, '00:00');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = ictToUtc(`${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`, '00:00');
  return [start, end];
}

const ONE_HOUR_MS = 60 * 60 * 1_000;

/**
 * HR remediation phase 7: the fixed instant the session-done engine went
 * live. A session whose `endTime` predates this is a historical event with
 * no sweep-evaluated `doneAt` — the one-time backfill script (not this
 * function) sets `done` for those and their credit is unconditionally 1.0.
 * Hardcoded (not env — R2 Scope F3: this is an immutable historical marker,
 * not environment config that should vary between deploys).
 */
export const SESSION_DONE_ACTIVATED_AT: Date = new Date('2026-07-12T00:00:00.000Z');

/**
 * Wage credit multiplier for a `done` session, based on how late it was
 * marked done relative to its own `endTime` (docs/20, phase 7 Requirements):
 * within 24h -> full credit; within 48h -> half; beyond -> none. The session
 * still transitions to `done` when its 3 conditions are met however late —
 * only the payroll credit is zeroed, never the `done` status itself.
 * Boundaries are inclusive of the lower bucket (`<=24h` -> 1.0, `<=48h` -> 0.5).
 */
export function creditFactor(doneAt: Date, endTime: Date): number {
  const lateMs = doneAt.getTime() - endTime.getTime();
  if (lateMs <= 24 * ONE_HOUR_MS) return 1.0;
  if (lateMs <= 48 * ONE_HOUR_MS) return 0.5;
  return 0;
}

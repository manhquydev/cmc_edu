// ICT (Indochina Time, UTC+7, no DST) wall-clock <-> UTC instant conversions
// for class scheduling (docs/26 WF-P2-01, TL19 §4-5 "bien ngay/thang theo
// ICT"). A `YYYY-MM-DD` calendar date + `HH:mm` wall-clock pair from a
// `classBatch.create`/`schedule.generateSessions` caller is always
// interpreted as Indochina Time -- this module is the single place that
// conversion happens, so `ClassSession.sessionDate`/`startTime`/`endTime`
// (all `@db.Timestamptz(3)`) store the correct UTC instant.

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
  const match = DATE_ONLY_RE.exec(dateOnly);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${dateOnly}".`);
  const [, y, m, d] = match as unknown as [string, string, string, string];
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
}

/** Converts a `YYYY-MM-DD` + `HH:mm` ICT wall-clock pair into the UTC instant it denotes. */
export function ictToUtc(dateOnly: string, timeOfDay: string): Date {
  const dateMatch = DATE_ONLY_RE.exec(dateOnly);
  const timeMatch = TIME_OF_DAY_RE.exec(timeOfDay);
  if (!dateMatch) throw new RangeError(`Expected YYYY-MM-DD, got "${dateOnly}".`);
  if (!timeMatch) throw new RangeError(`Expected HH:mm, got "${timeOfDay}".`);
  const [, y, m, d] = dateMatch as unknown as [string, string, string, string];
  const [, h, min] = timeMatch as unknown as [string, string, string];
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

/** Adds `days` calendar days to a `YYYY-MM-DD` date, returning `YYYY-MM-DD`. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const match = DATE_ONLY_RE.exec(dateOnly);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${dateOnly}".`);
  const [, y, m, d] = match as unknown as [string, string, string, string];
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

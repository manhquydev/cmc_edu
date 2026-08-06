/**
 * Map schedule domain rows → FullCalendar EventInput-shaped objects.
 *
 * - `classBatchToEvents`: all-day batch periods (list/kanban residual; not
 *   primary calendar feed).
 * - `classSessionToEvents`: **timed** ClassSession blocks for timeGrid/dayGrid
 *   (startTime/endTime ISO). FullCalendar all-day `end` is exclusive.
 */

export interface ClassBatchLike {
  id: string;
  code: string;
  program: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  teacherId?: string | null;
}

/** Subset of listInRange / ClassSession for calendar timed events. */
export interface ClassSessionLike {
  id: string;
  classBatchId: string;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  isMakeup?: boolean;
  batchCode?: string;
  program?: string;
  teacherId?: string | null;
}

/**
 * Subset of FullCalendar Event Object fields
 * (docs: event-parsing / event-object).
 */
export interface ScheduleFcEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  /** docs: eventInteractive — url makes event tabbable by default; we also set eventInteractive */
  url?: string;
  classNames?: string[];
  display?: 'auto' | 'block' | 'list-item' | 'background' | 'inverse-background' | 'none';
  extendedProps: {
    batchId: string;
    sessionId?: string;
    program: string;
    status: string;
    href: string;
    teacherId?: string | null;
    isMakeup?: boolean;
  };
}

/** Local calendar YYYY-MM-DD (avoids UTC shift for all-day). */
export function toDateOnly(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Exclusive end date for FC allDay: day after inclusive end. */
export function exclusiveEndDateOnly(inclusiveEnd: Date | string): string {
  const d = typeof inclusiveEnd === 'string' ? new Date(inclusiveEnd) : new Date(inclusiveEnd);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return toDateOnly(d);
}

function statusClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'active' || s === 'confirmed' || s === 'planned') return 'o-fc-ev--active';
  if (s === 'done' || s === 'completed') return 'o-fc-ev--done';
  if (s === 'cancelled') return 'o-fc-ev--cancelled';
  return 'o-fc-ev--neutral';
}

function toIsoInstant(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/**
 * Timed ClassSession → FC events for timeGrid/dayGrid.
 * Deep-link includes both classBatch + session (attendance requires both).
 */
export function classSessionToEvents(rows: ClassSessionLike[]): ScheduleFcEvent[] {
  const out: ScheduleFcEvent[] = [];
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    const start = toIsoInstant(row.startTime);
    const end = toIsoInstant(row.endTime);
    if (!start || !end) continue;
    if (start >= end) continue;

    const code = row.batchCode?.trim() || row.classBatchId.slice(0, 8);
    const program = row.program?.trim() || '';
    const title = program ? `${code} · ${program}` : code;
    // Session Detail hub (RCWS) — attendance is default tab for mid-class ops.
    const href = `/teaching/sessions/${row.id}?tab=attendance`;

    out.push({
      id: row.id,
      title: row.isMakeup ? `${title} (bù)` : title,
      start,
      end,
      allDay: false,
      url: href,
      display: 'auto',
      classNames: ['o-fc-ev', 'o-fc-ev--timed', statusClass(row.status)],
      extendedProps: {
        batchId: row.classBatchId,
        sessionId: row.id,
        program,
        status: row.status,
        href,
        teacherId: row.teacherId ?? null,
        isMakeup: row.isMakeup ?? false,
      },
    });
  }
  return out;
}

export function classBatchToEvents(rows: ClassBatchLike[]): ScheduleFcEvent[] {
  const out: ScheduleFcEvent[] = [];
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    const start = toDateOnly(row.startDate);
    const end = exclusiveEndDateOnly(row.endDate);
    if (!start || !end) continue;
    // Skip inverted ranges
    if (start >= end && start !== toDateOnly(row.endDate)) {
      // still allow single-day if exclusive equals start+1
    }
    const href = `/teaching/attendance?classBatch=${row.id}`;
    out.push({
      id: row.id,
      title: `${row.code} · ${row.program}`,
      start,
      end,
      allDay: true,
      // Prevent FC default navigation; eventClick handles SPA route.
      // Still set for a11y tab order hints in some themes.
      url: href,
      display: 'block',
      classNames: ['o-fc-ev', statusClass(row.status)],
      extendedProps: {
        batchId: row.id,
        program: row.program,
        status: row.status,
        href,
        teacherId: row.teacherId ?? null,
      },
    });
  }
  return out;
}

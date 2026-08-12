// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  classBatchToEvents,
  classSessionToEvents,
  exclusiveEndDateOnly,
  toDateOnly,
} from './schedule-fc-events.js';

describe('schedule-fc-events adapter', () => {
  it('toDateOnly formats local YYYY-MM-DD', () => {
    expect(toDateOnly(new Date(2026, 0, 5, 15, 30))).toBe('2026-01-05');
  });

  it('exclusiveEndDateOnly is day after inclusive end', () => {
    expect(exclusiveEndDateOnly('2026-12-31T00:00:00.000Z')).toMatch(/2027-01-0[12]/);
    // Local date: Dec 31 + 1 day
    const local = exclusiveEndDateOnly(new Date(2026, 11, 31));
    expect(local).toBe('2027-01-01');
  });

  it('returns empty array for empty input', () => {
    expect(classBatchToEvents([])).toEqual([]);
    expect(classSessionToEvents([])).toEqual([]);
  });

  it('maps batch to all-day event with attendance href', () => {
    const events = classBatchToEvents([
      {
        id: 'batch-1',
        code: 'ENG-A1',
        program: 'English',
        startDate: new Date(2026, 0, 5),
        endDate: new Date(2026, 11, 31),
        status: 'active',
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('batch-1');
    expect(events[0]!.title).toBe('ENG-A1 · English');
    expect(events[0]!.allDay).toBe(true);
    expect(events[0]!.start).toBe('2026-01-05');
    expect(events[0]!.end).toBe('2027-01-01');
    expect(events[0]!.extendedProps.href).toBe('/teaching/attendance?classBatch=batch-1');
    expect(events[0]!.classNames).toContain('console-fc-ev--active');
  });

  // `console-fc` is FocusCard's prefix in console.css. The calendar used to emit it
  // too, so its wrapper inherited FocusCard's accent rail, padding and
  // hover-lift. Calendar classes must stay out of that namespace.
  it('emits no ck-* class names', () => {
    const events = classBatchToEvents([
      {
        id: 'batch-1',
        code: 'ENG-A1',
        program: 'English',
        startDate: new Date(2026, 0, 5),
        endDate: new Date(2026, 11, 31),
        status: 'active',
      },
    ]);
    expect(events[0]!.classNames.filter((c) => c.startsWith('ck-'))).toEqual([]);
  });

  it('skips cancelled batches', () => {
    const events = classBatchToEvents([
      {
        id: 'x',
        code: 'X',
        program: 'P',
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 0, 10),
        status: 'cancelled',
      },
    ]);
    expect(events).toHaveLength(0);
  });

  it('skips rows with invalid dates', () => {
    const events = classBatchToEvents([
      {
        id: 'bad',
        code: 'B',
        program: 'P',
        startDate: 'not-a-date',
        endDate: 'also-bad',
        status: 'active',
      },
    ]);
    expect(events).toHaveLength(0);
  });

  describe('classSessionToEvents (timed)', () => {
    it('href targets session hub with attendance tab', () => {
      const events = classSessionToEvents([
        {
          id: 'sess-1',
          classBatchId: 'batch-9',
          startTime: '2026-08-03T11:00:00.000Z',
          endTime: '2026-08-03T12:30:00.000Z',
          status: 'planned',
          batchCode: 'ENG-A1',
          program: 'English',
        },
      ]);
      expect(events[0]!.extendedProps.href).toBe('/teaching/sessions/sess-1?tab=attendance');
      expect(events[0]!.url).toBe('/teaching/sessions/sess-1?tab=attendance');
    });

    const base = {
      id: 'sess-1',
      classBatchId: 'batch-9',
      startTime: '2026-08-03T11:00:00.000Z', // 18:00 ICT
      endTime: '2026-08-03T12:30:00.000Z', // 19:30 ICT
      status: 'planned',
      batchCode: 'CMC-UCREA-2026-001',
      program: 'UCREA',
      teacherId: 'teacher-1',
    };

    it('maps session to timed event with dual deep-link', () => {
      const events = classSessionToEvents([base]);
      expect(events).toHaveLength(1);
      const ev = events[0]!;
      expect(ev.allDay).toBe(false);
      expect(ev.start).toBe('2026-08-03T11:00:00.000Z');
      expect(ev.end).toBe('2026-08-03T12:30:00.000Z');
      expect(ev.title).toBe('CMC-UCREA-2026-001 · UCREA');
      expect(ev.extendedProps.href).toBe('/teaching/sessions/sess-1?tab=attendance');
      expect(ev.extendedProps.sessionId).toBe('sess-1');
      expect(ev.extendedProps.batchId).toBe('batch-9');
      expect(ev.classNames).toContain('console-fc-ev--timed');
    });

    it('skips cancelled sessions', () => {
      expect(classSessionToEvents([{ ...base, status: 'cancelled' }])).toHaveLength(0);
    });

    it('skips inverted start/end', () => {
      expect(
        classSessionToEvents([
          {
            ...base,
            startTime: '2026-08-03T12:30:00.000Z',
            endTime: '2026-08-03T11:00:00.000Z',
          },
        ]),
      ).toHaveLength(0);
    });
  });
});

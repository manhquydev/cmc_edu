// Unit coverage for the shared student-lifecycle gate (scenario audit pattern
// #2, 2026-07-15) — pure function, no DB fixture needed.

import { describe, expect, it } from 'vitest';
import { assertStudentActive } from './assert-student-active.js';

describe('assertStudentActive', () => {
  it('passes for an active student', () => {
    expect(() => assertStudentActive({ lifecycle: 'active' })).not.toThrow();
  });

  it('passes for a blocked_lms student (LMS-read-only restriction, not a staff-write block)', () => {
    expect(() => assertStudentActive({ lifecycle: 'blocked_lms' })).not.toThrow();
  });

  it('throws BAD_REQUEST for a withdrawn (void) student', () => {
    try {
      assertStudentActive({ lifecycle: 'withdrawn' });
      throw new Error('expected assertStudentActive to throw');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('BAD_REQUEST');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { computeFinalGrade } from './compute-final-grade.js';

describe('computeFinalGrade (docs/19 §6, weights: 0.7 exercise + 0.3 attendance, documented default)', () => {
  it('a perfect student (full marks, full attendance) scores exactly 10', () => {
    expect(computeFinalGrade([{ score: 10, maxScore: 10 }], 1)).toBe(10);
  });

  it('zero graded exercises + zero attendance scores exactly 0', () => {
    expect(computeFinalGrade([], 0)).toBe(0);
  });

  it('zero graded exercises still credits the attendance component (0.3 weight)', () => {
    // exerciseComponent=0, attendanceComponent=10*1=10 -> 0*0.7 + 10*0.3 = 3.
    expect(computeFinalGrade([], 1)).toBe(3);
  });

  it('perfect exercises with zero attendance credits only the exercise component (0.7 weight)', () => {
    // exerciseComponent=10, attendanceComponent=0 -> 10*0.7 + 0*0.3 = 7.
    expect(computeFinalGrade([{ score: 10, maxScore: 10 }], 0)).toBe(7);
  });

  it('normalizes exercises with a non-default maxScore onto the 0-10 scale', () => {
    // 50/100 * 10 = 5 -> 5*0.7 + 10*0.3 (full attendance) = 6.5.
    expect(computeFinalGrade([{ score: 50, maxScore: 100 }], 1)).toBe(6.5);
  });

  it('averages multiple graded exercises', () => {
    // (10/10*10 + 5/10*10) / 2 = 7.5 -> 7.5*0.7 + 10*0.3 = 8.25.
    expect(computeFinalGrade([{ score: 10, maxScore: 10 }, { score: 5, maxScore: 10 }], 1)).toBe(8.25);
  });

  it('attendanceRate boundary 0.5 mid-point', () => {
    // exerciseComponent=0, attendanceComponent=5 -> 0*0.7 + 5*0.3 = 1.5.
    expect(computeFinalGrade([], 0.5)).toBe(1.5);
  });

  it('rejects an attendanceRate below 0', () => {
    expect(() => computeFinalGrade([], -0.01)).toThrow(RangeError);
  });

  it('rejects an attendanceRate above 1', () => {
    expect(() => computeFinalGrade([], 1.01)).toThrow(RangeError);
  });

  it('rejects a non-finite attendanceRate', () => {
    expect(() => computeFinalGrade([], Number.NaN)).toThrow(RangeError);
  });

  it('rejects a score above its own maxScore', () => {
    expect(() => computeFinalGrade([{ score: 11, maxScore: 10 }], 1)).toThrow(RangeError);
  });

  it('rejects a negative score', () => {
    expect(() => computeFinalGrade([{ score: -1, maxScore: 10 }], 1)).toThrow(RangeError);
  });

  it('rejects a non-positive maxScore', () => {
    expect(() => computeFinalGrade([{ score: 0, maxScore: 0 }], 1)).toThrow(RangeError);
  });

  it('rounds to 2 decimal places to avoid float noise', () => {
    const result = computeFinalGrade([{ score: 7, maxScore: 9 }], 0.6);
    expect(Number.isInteger(result * 100)).toBe(true);
  });
});

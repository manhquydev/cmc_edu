// HR remediation phase 7: unit tests for the pure `evaluateSessionDone`
// (docs/26 phase-07). No DB — every condition row is fabricated directly.

import { describe, expect, it } from 'vitest';
import {
  evaluateSessionDone,
  evaluateSessionDoneProgress,
  type SessionDoneEvaluationInput,
} from './session-done.js';

const endTime = new Date('2026-08-03T12:30:00.000Z');
const now = new Date('2026-08-03T13:00:00.000Z'); // past endTime — clears the time gate

function baseInput(overrides?: Partial<SessionDoneEvaluationInput>): SessionDoneEvaluationInput {
  return {
    endTime,
    attendances: [{ studentId: 's1', status: 'present', markedAt: new Date('2026-08-03T12:00:00.000Z') }],
    assessments: [{ studentId: 's1', status: 'confirmed', confirmedAt: new Date('2026-08-03T12:35:00.000Z') }],
    evidence: { status: 'published', publishedAt: new Date('2026-08-03T12:40:00.000Z'), photoCount: 1 },
    ...overrides,
  };
}

describe('evaluateSessionDoneProgress', () => {
  it('marks all flags true when eligible', () => {
    const p = evaluateSessionDoneProgress(baseInput(), now);
    expect(p).toMatchObject({
      attendanceOk: true,
      presentCount: 1,
      assessmentOk: true,
      assessmentsConfirmed: 1,
      assessmentsRequired: 1,
      evidenceOk: true,
      photoCount: 1,
      evidencePublished: true,
      timeGatePassed: true,
      eligible: true,
    });
  });

  it('reports partial progress without time gate', () => {
    const before = new Date(endTime.getTime() - 1_000);
    const p = evaluateSessionDoneProgress(baseInput(), before);
    expect(p.attendanceOk).toBe(true);
    expect(p.assessmentOk).toBe(true);
    expect(p.evidenceOk).toBe(true);
    expect(p.timeGatePassed).toBe(false);
    expect(p.eligible).toBe(false);
  });

  it('tracks assessment counts for multi-present roster', () => {
    const p = evaluateSessionDoneProgress(
      baseInput({
        attendances: [
          { studentId: 's1', status: 'present', markedAt: new Date() },
          { studentId: 's2', status: 'present', markedAt: new Date() },
        ],
        assessments: [
          { studentId: 's1', status: 'confirmed', confirmedAt: new Date() },
        ],
      }),
      now,
    );
    expect(p.presentCount).toBe(2);
    expect(p.assessmentsRequired).toBe(2);
    expect(p.assessmentsConfirmed).toBe(1);
    expect(p.assessmentOk).toBe(false);
    expect(p.eligible).toBe(false);
  });

  it('does not count confirmed assessments marked sessionCommentOk false', () => {
    const p = evaluateSessionDoneProgress(
      baseInput({
        assessments: [
          {
            studentId: 's1',
            status: 'confirmed',
            confirmedAt: new Date(),
            sessionCommentOk: false,
          },
        ],
      }),
      now,
    );
    expect(p.assessmentsConfirmed).toBe(0);
    expect(p.assessmentOk).toBe(false);
    expect(p.eligible).toBe(false);
  });
});

describe('evaluateSessionDone', () => {
  it('returns doneAt = MAX(markedAt, confirmedAt, publishedAt) when all 3 conditions hold', () => {
    const result = evaluateSessionDone(baseInput(), now);
    expect(result).toEqual({ doneAt: new Date('2026-08-03T12:40:00.000Z') });
  });

  it('is null when 0 attendance rows are present (no present status at all)', () => {
    const result = evaluateSessionDone(
      baseInput({ attendances: [{ studentId: 's1', status: 'absent', markedAt: new Date() }] }),
      now,
    );
    expect(result).toBeNull();
  });

  it('is null when a present student has no assessment at all', () => {
    const result = evaluateSessionDone(baseInput({ assessments: [] }), now);
    expect(result).toBeNull();
  });

  it('is null when a present student assessment exists but is only draft, not confirmed', () => {
    const result = evaluateSessionDone(
      baseInput({ assessments: [{ studentId: 's1', status: 'draft', confirmedAt: null }] }),
      now,
    );
    expect(result).toBeNull();
  });

  it('is null when one of two present students lacks a confirmed assessment', () => {
    const result = evaluateSessionDone(
      baseInput({
        attendances: [
          { studentId: 's1', status: 'present', markedAt: new Date('2026-08-03T12:00:00.000Z') },
          { studentId: 's2', status: 'present', markedAt: new Date('2026-08-03T12:05:00.000Z') },
        ],
        assessments: [{ studentId: 's1', status: 'confirmed', confirmedAt: new Date('2026-08-03T12:35:00.000Z') }],
      }),
      now,
    );
    expect(result).toBeNull();
  });

  it('is null when evidence is missing entirely', () => {
    const result = evaluateSessionDone(baseInput({ evidence: null }), now);
    expect(result).toBeNull();
  });

  it('is null when evidence is draft (not yet published)', () => {
    const result = evaluateSessionDone(
      baseInput({ evidence: { status: 'draft', publishedAt: null, photoCount: 1 } }),
      now,
    );
    expect(result).toBeNull();
  });

  it('is null when evidence is published but has 0 photos', () => {
    const result = evaluateSessionDone(
      baseInput({ evidence: { status: 'published', publishedAt: new Date(), photoCount: 0 } }),
      now,
    );
    expect(result).toBeNull();
  });

  it('time gate: is null when now is before endTime even though all conditions are met', () => {
    const beforeEndTime = new Date(endTime.getTime() - 1_000);
    const result = evaluateSessionDone(baseInput(), beforeEndTime);
    expect(result).toBeNull();
  });

  it('time gate: is eligible exactly at now === endTime', () => {
    const result = evaluateSessionDone(baseInput(), endTime);
    expect(result).not.toBeNull();
  });

  it('doneAt only considers required (present-student) assessments, ignoring a confirmed assessment for an absent student that is later', () => {
    const result = evaluateSessionDone(
      baseInput({
        assessments: [
          { studentId: 's1', status: 'confirmed', confirmedAt: new Date('2026-08-03T12:35:00.000Z') },
          // absent student, confirmed much later — must not influence doneAt.
          { studentId: 's-absent', status: 'confirmed', confirmedAt: new Date('2026-08-04T00:00:00.000Z') },
        ],
      }),
      now,
    );
    expect(result).toEqual({ doneAt: new Date('2026-08-03T12:40:00.000Z') });
  });
});

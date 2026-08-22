import { describe, expect, it } from 'vitest';
import {
  NARRATIVE_MAX_CHARS,
  RUBRIC_PROGRAMS,
  SESSION_COMMENT_RUBRIC,
  coerceScore,
  criterionKeys,
  isCompleteScores,
  isScore,
  isSessionCommentSatisfied,
  rubricFor,
  safeParseRubric,
  synthesizeRubricContent,
} from './session-comment-rubric.js';

describe('session-comment-rubric', () => {
  it('keys match Prisma Program', () => {
    expect(Object.keys(SESSION_COMMENT_RUBRIC)).toEqual(['UCREA', 'BRIGHT_IG', 'BLACK_HOLE']);
    expect(RUBRIC_PROGRAMS).toEqual(['UCREA', 'BRIGHT_IG', 'BLACK_HOLE']);
  });

  it('counts scored criteria per program', () => {
    expect(criterionKeys('UCREA')).toHaveLength(8);
    expect(criterionKeys('BRIGHT_IG')).toHaveLength(8);
    expect(criterionKeys('BLACK_HOLE')).toHaveLength(9);
  });

  it('shares attitude and knowledge keys', () => {
    const shared = ['attendanceAttitude', 'inClassAttitude', 'priorKnowledge', 'newKnowledge'];
    for (const program of RUBRIC_PROGRAMS) {
      const keys = criterionKeys(program);
      expect(keys.slice(0, 4)).toEqual(shared);
      expect(rubricFor(program).criteria[0].labelVi).toBe('Thái độ đi học');
    }
  });

  it('uses distinct skill keys', () => {
    expect(criterionKeys('UCREA').slice(4)).toEqual([
      'basicThinking',
      'logicalThinking',
      'mathThinking',
      'creativeThinking',
    ]);
    expect(criterionKeys('BRIGHT_IG').slice(4)).toEqual([
      'focusObserve',
      'logicAnalyze',
      'initiativeApply',
      'persistCreate',
    ]);
    expect(criterionKeys('BLACK_HOLE').slice(4)).toEqual([
      'logicAnalyze',
      'initiativeApply',
      'persistCreate',
      'tacticalThinking',
      'presentDebate',
    ]);
  });

  it('scores and narrative cap', () => {
    expect(isScore(1)).toBe(true);
    expect(isScore(4)).toBe(true);
    expect(isScore(0)).toBe(false);
    expect(isScore(5)).toBe(false);
    expect(coerceScore('3')).toBe(3);
    expect(coerceScore('x')).toBeNull();
    expect(NARRATIVE_MAX_CHARS).toBe(2000);
  });

  it('complete scores require every program key', () => {
    const scores = Object.fromEntries(criterionKeys('UCREA').map((key) => [key, 3]));
    expect(isCompleteScores('UCREA', scores)).toBe(true);
    const { attendanceAttitude: _drop, ...rest } = scores;
    expect(isCompleteScores('UCREA', rest)).toBe(false);
  });

  it('safeParseRubric rejects junk and accepts v2', () => {
    expect(safeParseRubric(null)).toBeNull();
    expect(safeParseRubric({ version: 2, scores: null })).toBeNull();
    expect(safeParseRubric({ version: 2, scores: { attendanceAttitude: 3 } })).toEqual({
      version: 2,
      scores: { attendanceAttitude: 3 },
      narratives: {},
    });
  });

  it('session comment satisfied: legacy content or complete v2', () => {
    const scores = Object.fromEntries(criterionKeys('UCREA').map((key) => [key, 3]));
    expect(isSessionCommentSatisfied('UCREA', 'Bé chăm.', null)).toBe(true);
    expect(isSessionCommentSatisfied('UCREA', '', { version: 2, scores })).toBe(true);
    expect(
      isSessionCommentSatisfied('UCREA', 'Bé chăm.', { version: 2, scores: { attendanceAttitude: 3 } }),
    ).toBe(false);
    expect(isSessionCommentSatisfied('UCREA', '', null)).toBe(false);
    expect(synthesizeRubricContent('UCREA', { version: 2, scores: { attendanceAttitude: 3 } })).toContain(
      'Thái độ đi học',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { dueLevelClassName, dueLevelTone } from './due-level.js';

describe('dueLevelClassName', () => {
  it('maps each level onto the token CSS class', () => {
    expect(dueLevelClassName('late')).toBe('cmc-due-late');
    expect(dueLevelClassName('today')).toBe('cmc-due-today');
    expect(dueLevelClassName('future')).toBe('cmc-due-future');
  });
});

describe('dueLevelTone', () => {
  it('maps each level onto the WorkInbox tone', () => {
    expect(dueLevelTone('late')).toBe('danger');
    expect(dueLevelTone('today')).toBe('warning');
    expect(dueLevelTone('future')).toBe('brand');
  });
});

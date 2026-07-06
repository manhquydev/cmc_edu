import { describe, expect, it } from 'vitest';
import { duplicatePhoneWarning } from './duplicate-phone.js';

describe('duplicatePhoneWarning', () => {
  it('returns null when neither a ParentAccount nor a Receipt match the phone', () => {
    expect(duplicatePhoneWarning(false, false)).toBeNull();
  });

  it('returns a warning when a ParentAccount already uses the phone', () => {
    expect(duplicatePhoneWarning(true, false)).toBeTypeOf('string');
  });

  it('returns a warning when another Receipt already uses the phone', () => {
    expect(duplicatePhoneWarning(false, true)).toBeTypeOf('string');
  });

  it('returns a warning when both conflict', () => {
    expect(duplicatePhoneWarning(true, true)).toBeTypeOf('string');
  });
});

import { describe, expect, it } from 'vitest';
import { InvalidPhoneError, normalizeLoginPhone } from './normalize-login-phone.js';

describe('normalizeLoginPhone', () => {
  it('normalizes a local 0-prefixed number to 84xxxxxxxxx', () => {
    expect(normalizeLoginPhone('0912345678')).toBe('84912345678');
  });

  it('normalizes a +84-prefixed number to 84xxxxxxxxx', () => {
    expect(normalizeLoginPhone('+84912345678')).toBe('84912345678');
  });

  it('passes through an already-canonical 84xxxxxxxxx number', () => {
    expect(normalizeLoginPhone('84912345678')).toBe('84912345678');
  });

  it('strips spaces and dashes before normalizing', () => {
    expect(normalizeLoginPhone('091 234-5678')).toBe('84912345678');
  });

  it('throws InvalidPhoneError for a too-short number', () => {
    expect(() => normalizeLoginPhone('12345')).toThrow(InvalidPhoneError);
  });

  it('throws InvalidPhoneError for a non-numeric string', () => {
    expect(() => normalizeLoginPhone('not-a-phone')).toThrow(InvalidPhoneError);
  });
});

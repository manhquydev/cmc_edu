// Unit tests for the CRM contact-phone normalizer (phase-08). Pure function —
// no DB, no jsdom.

import { describe, expect, it } from 'vitest';
import { normalizeContactPhone, toContactPhoneSearchDigits } from './normalize-contact-phone.js';

describe('normalizeContactPhone', () => {
  it('maps every VN mobile input form to the canonical 84xxxxxxxxx', () => {
    expect(normalizeContactPhone('0912345678')).toBe('84912345678');
    expect(normalizeContactPhone('+84912345678')).toBe('84912345678');
    expect(normalizeContactPhone('84912345678')).toBe('84912345678');
    expect(normalizeContactPhone('912345678')).toBe('84912345678'); // bare national
  });

  it('ignores spaces, dashes, dots and parentheses', () => {
    expect(normalizeContactPhone('091 234 5678')).toBe('84912345678');
    expect(normalizeContactPhone('091-234-5678')).toBe('84912345678');
    expect(normalizeContactPhone('+84 (91) 234.5678')).toBe('84912345678');
  });

  it('is lenient — a non-VN-mobile string returns its cleaned digits, never throws', () => {
    expect(normalizeContactPhone('12345')).toBe('12345'); // too short
    expect(normalizeContactPhone('abc')).toBe(''); // no digits
  });
});

describe('toContactPhoneSearchDigits', () => {
  it('maps a 0-prefixed search term to the 84 form so it matches stored values', () => {
    expect(toContactPhoneSearchDigits('0912345678')).toBe('84912345678');
    expect(toContactPhoneSearchDigits('091 234')).toBe('8491234'); // partial keeps mapping
  });

  it('passes 84-prefixed and bare partials through as digits', () => {
    expect(toContactPhoneSearchDigits('84912')).toBe('84912');
    expect(toContactPhoneSearchDigits('912345')).toBe('912345');
    expect(toContactPhoneSearchDigits('+84-912')).toBe('84912');
  });
});

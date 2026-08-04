import { describe, it, expect } from 'vitest';
import { RETURN_TO_EXCLUDED, safeReturnTo, shouldCaptureReturnTo } from './safe-return-to.js';

describe('shouldCaptureReturnTo', () => {
  it('captures product paths', () => {
    expect(shouldCaptureReturnTo('/crm/opportunities/abc')).toBe(true);
    expect(shouldCaptureReturnTo('/finance')).toBe(true);
    expect(shouldCaptureReturnTo('/cockpit')).toBe(true);
  });

  it('skips auth chrome and the root index', () => {
    for (const path of RETURN_TO_EXCLUDED) {
      expect(shouldCaptureReturnTo(path)).toBe(false);
    }
  });
});

describe('safeReturnTo', () => {
  it('accepts an internal path with nested query', () => {
    expect(safeReturnTo('/finance?page=2')).toBe('/finance?page=2');
    expect(safeReturnTo('/crm/opportunities/550e8400-e29b-41d4-a716-446655440000')).toBe(
      '/crm/opportunities/550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('preserves percent-encoding already present in the query (no double-decode)', () => {
    // searchParams.get already decoded the outer returnTo wrapper once; a
    // literal "%25" in the product query must survive another safeReturnTo call.
    expect(safeReturnTo('/finance?q=100%25off')).toBe('/finance?q=100%25off');
  });

  it('still accepts a still-encoded path via the decode fallback', () => {
    // Non-searchParams caller / defense for double-encoded wrappers.
    expect(safeReturnTo(encodeURIComponent('/finance?page=2'))).toBe('/finance?page=2');
  });

  it('rejects open-redirect shapes', () => {
    expect(safeReturnTo('//evil.com')).toBe('/');
    expect(safeReturnTo('https://evil.com')).toBe('/');
    expect(safeReturnTo('http://evil.com/path')).toBe('/');
    expect(safeReturnTo('/\\evil')).toBe('/');
    expect(safeReturnTo('javascript:alert(1)')).toBe('/');
    expect(safeReturnTo('//evil.com/%2e%2e')).toBe('/');
  });

  it('rejects control-char / whitespace bypasses that URL parsers normalize', () => {
    // After one searchParams decode: /%09//evil.com → /\t//evil.com
    expect(safeReturnTo('/\t//evil.com')).toBe('/');
    expect(safeReturnTo('/\n//evil.com')).toBe('/');
    expect(safeReturnTo('/\r//evil.com')).toBe('/');
    // Still-encoded form (decode fallback then reject).
    expect(safeReturnTo('/%09//evil.com')).toBe('/');
    expect(safeReturnTo('/%0a//evil.com')).toBe('/');
  });

  it('rejects empty, nullish, and garbage', () => {
    expect(safeReturnTo(null)).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
    expect(safeReturnTo('')).toBe('/');
    expect(safeReturnTo('crm/no-leading-slash')).toBe('/');
    // Malformed percent-encoding on non-path fallback → fallback
    expect(safeReturnTo('%E0%A4%A')).toBe('/');
  });

  it('rejects excluded paths so restore cannot loop on auth chrome', () => {
    expect(safeReturnTo('/login')).toBe('/');
    expect(safeReturnTo('/change-password')).toBe('/');
    expect(safeReturnTo('/')).toBe('/');
    expect(safeReturnTo('/login?x=1')).toBe('/');
  });

  it('drops hash fragments (out of scope)', () => {
    expect(safeReturnTo('/finance#section')).toBe('/finance');
  });
});

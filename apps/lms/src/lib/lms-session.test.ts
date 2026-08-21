import { describe, expect, it } from 'vitest';
import { parseLmsToken } from './lms-session.js';

function b64urlJson(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

describe('parseLmsToken', () => {
  it('extracts claims from a 3-part HMAC token without verifying the signature', () => {
    const payload = b64urlJson({
      parentAccountId: 'pa-1',
      kind: 'parent',
      studentId: 'st-9',
      iat: 1,
      exp: 2,
    });
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkNNQy1MTVMtMSJ9.${payload}.not-a-real-sig`;

    expect(parseLmsToken(token)).toEqual({
      parentAccountId: 'pa-1',
      kind: 'parent',
      studentId: 'st-9',
    });
  });

  it('returns null for garbage and 1-part invalid JSON', () => {
    expect(parseLmsToken('not-valid')).toBeNull();
    expect(parseLmsToken(b64urlJson('not-an-object'))).toBeNull();
    expect(parseLmsToken('aaa.bbb.ccc')).toBeNull();
  });

  it('still parses a legacy 1-part unsigned JSON token', () => {
    const token = b64urlJson({
      parentAccountId: 'pa-legacy',
      kind: 'student',
      studentId: 'st-legacy',
    });

    expect(parseLmsToken(token)).toEqual({
      parentAccountId: 'pa-legacy',
      kind: 'student',
      studentId: 'st-legacy',
    });
  });

  it('accepts kind family without requiring studentId', () => {
    const payload = b64urlJson({
      parentAccountId: 'pa-fam',
      kind: 'family',
      iat: 1,
      exp: 2,
    });
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkNNQy1MTVMtMSJ9.${payload}.sig`;
    expect(parseLmsToken(token)).toEqual({
      parentAccountId: 'pa-fam',
      kind: 'family',
      studentId: undefined,
    });
  });
});

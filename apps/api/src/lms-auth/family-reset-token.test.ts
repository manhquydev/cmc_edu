import { describe, expect, it } from 'vitest';
import { signLmsToken } from './session-token.js';
import { signFamilyResetToken, verifyFamilyResetToken } from './family-reset-token.js';

const SECRET = 'test-family-reset-secret-32-bytes!!';

describe('family reset token', () => {
  it('round-trips parentAccountId and tokenVersion', () => {
    const token = signFamilyResetToken('pa-1', 4, SECRET);
    expect(verifyFamilyResetToken(token, SECRET)).toEqual({
      parentAccountId: 'pa-1',
      tokenVersion: 4,
    });
  });

  it('rejects an LMS session token', () => {
    const session = signLmsToken({ parentAccountId: 'pa-1', kind: 'family' }, SECRET);
    expect(verifyFamilyResetToken(session, SECRET)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signFamilyResetToken('pa-1', 0, SECRET);
    const [h, , sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        parentAccountId: 'pa-EVIL',
        tv: 0,
        typ: 'family-reset',
        iat: 1,
        exp: 9999999999,
      }),
      'utf8',
    ).toString('base64url');
    expect(verifyFamilyResetToken(`${h}.${forged}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects an expired ticket', () => {
    const token = signFamilyResetToken('pa-1', 0, SECRET, -1000);
    expect(verifyFamilyResetToken(token, SECRET)).toBeNull();
  });
});

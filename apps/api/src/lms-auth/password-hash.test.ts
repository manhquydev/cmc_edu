import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-hash.js';

describe('password-hash', () => {
  it('verifies a correct password', () => {
    const hash = hashPassword('Cmc2026@');
    expect(verifyPassword('Cmc2026@', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('Cmc2026@');
    expect(verifyPassword('Wrong!', hash)).toBe(false);
  });

  it('rejects a malformed hash — no prefix', () => {
    expect(verifyPassword('Cmc2026@', 'notahash')).toBe(false);
  });

  it('rejects a malformed hash — wrong algorithm prefix', () => {
    expect(verifyPassword('Cmc2026@', 'bcrypt:abc:def')).toBe(false);
  });

  it('rejects a malformed hash — missing salt segment', () => {
    expect(verifyPassword('Cmc2026@', 'pbkdf2:onlyone')).toBe(false);
  });

  it('rejects an empty stored value', () => {
    expect(verifyPassword('Cmc2026@', '')).toBe(false);
  });

  it('two hashes of the same password are different (random salt)', () => {
    const h1 = hashPassword('abc');
    const h2 = hashPassword('abc');
    expect(h1).not.toBe(h2);
  });

  it('both salted hashes still verify correctly', () => {
    const h1 = hashPassword('abc');
    const h2 = hashPassword('abc');
    expect(verifyPassword('abc', h1)).toBe(true);
    expect(verifyPassword('abc', h2)).toBe(true);
  });
});

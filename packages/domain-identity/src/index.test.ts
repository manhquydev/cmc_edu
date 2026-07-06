// Barrel re-export smoke test — confirms the public entrypoint wires each
// function through, independent of the per-function unit tests.

import { describe, expect, it } from 'vitest';
import { InvalidPhoneError, normalizeLoginPhone } from './index.js';

describe('@cmc/domain-identity barrel', () => {
  it('re-exports the pure functions and error class', () => {
    expect(typeof normalizeLoginPhone).toBe('function');
    expect(InvalidPhoneError.prototype).toBeInstanceOf(Error);
  });
});

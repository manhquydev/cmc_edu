// Unit coverage for the shared session-status gate (scenario audit pattern
// #2, 2026-07-15) — pure function, no DB fixture needed.

import { describe, expect, it } from 'vitest';
import { assertSessionActive } from './assert-session-active.js';

describe('assertSessionActive', () => {
  it('passes for planned/confirmed/done sessions when alsoBlockDone is not set', () => {
    expect(() => assertSessionActive({ status: 'planned' })).not.toThrow();
    expect(() => assertSessionActive({ status: 'confirmed' })).not.toThrow();
    expect(() => assertSessionActive({ status: 'done' })).not.toThrow();
  });

  it('throws BAD_REQUEST for a cancelled session, always', () => {
    try {
      assertSessionActive({ status: 'cancelled' });
      throw new Error('expected assertSessionActive to throw');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('BAD_REQUEST');
    }
  });

  it('throws BAD_REQUEST for cancelled even when alsoBlockDone is set', () => {
    expect(() => assertSessionActive({ status: 'cancelled' }, { alsoBlockDone: true })).toThrow();
  });

  it('passes for done when alsoBlockDone is not set', () => {
    expect(() => assertSessionActive({ status: 'done' })).not.toThrow();
  });

  it('throws BAD_REQUEST for done when alsoBlockDone is set', () => {
    try {
      assertSessionActive({ status: 'done' }, { alsoBlockDone: true });
      throw new Error('expected assertSessionActive to throw');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('BAD_REQUEST');
    }
  });
});

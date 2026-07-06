import { describe, expect, it } from 'vitest';
import { computeNetAmount } from './net-amount.js';

describe('computeNetAmount', () => {
  it('returns the gross amount when there is no discount', () => {
    expect(computeNetAmount(1000)).toBe(1000);
  });

  it('subtracts a flat discount from the gross amount', () => {
    expect(computeNetAmount(1000, 200)).toBe(800);
  });

  it('allows a discount that exactly consumes the gross amount', () => {
    expect(computeNetAmount(1000, 1000)).toBe(0);
  });

  it('rejects a discount larger than the gross amount', () => {
    expect(() => computeNetAmount(1000, 1001)).toThrow(RangeError);
  });

  it('rejects a negative gross amount', () => {
    expect(() => computeNetAmount(-1)).toThrow(RangeError);
  });

  it('rejects a negative discount', () => {
    expect(() => computeNetAmount(1000, -1)).toThrow(RangeError);
  });
});

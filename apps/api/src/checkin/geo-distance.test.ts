// Pure unit tests for haversineDistanceM — no DB.

import { describe, expect, it } from 'vitest';
import { haversineDistanceM } from './geo-distance.js';

describe('haversineDistanceM', () => {
  it('same point is 0', () => {
    expect(haversineDistanceM({ lat: 21.0285, lng: 105.8542 }, { lat: 21.0285, lng: 105.8542 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { lat: 21.0285, lng: 105.8542 }; // Hanoi
    const b = { lat: 10.8231, lng: 106.6297 }; // HCMC
    expect(haversineDistanceM(a, b)).toBeCloseTo(haversineDistanceM(b, a), 6);
  });

  it('HN ↔ HCMC ≈ 1140 km within 1%', () => {
    const hn = { lat: 21.0285, lng: 105.8542 };
    const hcm = { lat: 10.8231, lng: 106.6297 };
    const d = haversineDistanceM(hn, hcm);
    // Published great-circle ≈ 1_130–1_160 km depending on endpoints
    expect(d).toBeGreaterThan(1_130_000);
    expect(d).toBeLessThan(1_160_000);
  });

  it('~200 m real-world offset is within 5%', () => {
    // ~0.0018° lat ≈ 200 m near equator; at 21°N still ≈ 200 m
    const a = { lat: 21.0285, lng: 105.8542 };
    const b = { lat: 21.0285 + 0.0018, lng: 105.8542 };
    const d = haversineDistanceM(a, b);
    expect(d).toBeGreaterThan(190);
    expect(d).toBeLessThan(210);
  });
});

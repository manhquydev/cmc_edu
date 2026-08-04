import { describe, it, expect } from 'vitest';
import { UUID_RE, goPath, links, resolveGo } from './index.js';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('links builders', () => {
  it('builds the four entity detail paths', () => {
    expect(links.opportunity(UUID)).toBe(`/crm/opportunities/${UUID}`);
    expect(links.receipt(UUID)).toBe(`/finance/${UUID}`);
    expect(links.student(UUID)).toBe(`/admin/students/${UUID}`);
    expect(links.classBatch(UUID)).toBe(`/admin/classes/${UUID}`);
  });

  it('builds go paths', () => {
    expect(goPath('opportunity', UUID)).toBe(`/go/opportunity/${UUID}`);
    expect(goPath('receipt', UUID)).toBe(`/go/receipt/${UUID}`);
  });
});

describe('UUID_RE', () => {
  it('accepts standard UUID strings', () => {
    expect(UUID_RE.test(UUID)).toBe(true);
  });

  it('rejects non-UUID tokens', () => {
    expect(UUID_RE.test('refund')).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
  });
});

describe('resolveGo', () => {
  it('resolves known entity + UUID', () => {
    expect(resolveGo('opportunity', UUID)).toBe(`/crm/opportunities/${UUID}`);
    expect(resolveGo('receipt', UUID)).toBe(`/finance/${UUID}`);
    expect(resolveGo('student', UUID)).toBe(`/admin/students/${UUID}`);
    expect(resolveGo('classBatch', UUID)).toBe(`/admin/classes/${UUID}`);
  });

  it('returns null for unknown entity keys', () => {
    expect(resolveGo('unknown', UUID)).toBeNull();
  });

  it('rejects prototype-chain keys (Object.hasOwn, not `in`)', () => {
    expect(resolveGo('toString', UUID)).toBeNull();
    expect(resolveGo('constructor', UUID)).toBeNull();
    expect(resolveGo('__proto__', UUID)).toBeNull();
  });

  it('rejects non-UUID ids (static sibling routes, traversal, empty)', () => {
    expect(resolveGo('receipt', 'refund')).toBeNull();
    expect(resolveGo('opportunity', '..%2F..%2Fadmin%2Fusers')).toBeNull();
    expect(resolveGo('opportunity', '')).toBeNull();
    expect(resolveGo('student', 'not-a-uuid')).toBeNull();
  });
});

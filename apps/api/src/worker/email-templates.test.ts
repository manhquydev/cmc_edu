// Gap-closure 260710-0005 Phase 1: renderOutboxEmail OTP branch. Covers the
// existing receipt branch's sibling — subject/body must contain the plaintext
// code (this IS the delivery mechanism), HTML-escaped, plus the pre-existing
// unknown-shape fallback so a transport never sends an empty body.

import { describe, expect, it } from 'vitest';
import { renderOutboxEmail } from './email-templates.js';

describe('renderOutboxEmail', () => {
  it('renders the receipt payload branch unchanged', () => {
    const result = renderOutboxEmail({ receiptId: 'r1', studentName: 'Nguyễn Văn A', kind: 'tuition' });
    expect(result.subject).toContain('Nguyễn Văn A');
    expect(result.html).toContain('Nguyễn Văn A');
  });

  it('renders an OTP payload with the code and TTL in subject/body', () => {
    const result = renderOutboxEmail({ kind: 'otp', code: '123456', ttlMinutes: 5 });
    expect(result.subject).toContain('Mã đăng nhập');
    expect(result.text).toContain('123456');
    expect(result.html).toContain('123456');
    expect(result.text).toContain('5 phút');
  });

  it('HTML-escapes the OTP code so no markup/script injection is possible', () => {
    const result = renderOutboxEmail({ kind: 'otp', code: '<script>alert(1)</script>', ttlMinutes: 5 });
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('a scrubbed OTP payload ({kind:"otp",scrubbed:true}) falls through to the safe generic branch', () => {
    const result = renderOutboxEmail({ kind: 'otp', scrubbed: true });
    expect(result.subject).toBe('CMC EDU — Thông báo');
    expect(result.text).not.toContain('123456');
  });

  it('renders a family-reset payload with the reset URL', () => {
    const result = renderOutboxEmail({
      kind: 'family-reset',
      resetUrl: 'http://localhost:5174/dat-lai-mat-khau-gia-dinh#token=abc',
      ttlMinutes: 60,
    });
    expect(result.subject).toContain('Đặt lại mật khẩu gia đình');
    expect(result.text).toContain('#token=abc');
    expect(result.html).toContain('Đặt lại mật khẩu');
  });

  it('falls back to a safe generic message for an unknown payload shape', () => {
    const result = renderOutboxEmail({ somethingElse: true });
    expect(result.subject).toBe('CMC EDU — Thông báo');
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
  });
});

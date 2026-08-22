// Renders an EmailOutbox row's domain payload into a concrete email message.
//
// EmailOutbox.payload carries DOMAIN data (e.g. {receiptId, studentName, kind}),
// not rendered content — so every transport (Brevo/Graph) renders here rather
// than duplicating templating. Two email types are rendered: parent login OTP
// (`kind: 'otp'`, lmsAuth.requestOtpEmail) and receipt approval notification
// (finance/router.ts enqueueReceiptEmail); unknown shapes
// fall back to a safe generic message so a transport never sends an empty body.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface ReceiptPayload {
  receiptId: string;
  studentName: string;
  kind: string;
}

function isReceiptPayload(p: unknown): p is ReceiptPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Record<string, unknown>)['receiptId'] === 'string' &&
    typeof (p as Record<string, unknown>)['studentName'] === 'string'
  );
}

/**
 * LMS parent email-OTP delivery (gap closure 260710-0005 Phase 1). `code` is
 * the plaintext OTP — lives in the outbox row only until relay-email-outbox
 * scrubs it post-send (see relay-email-outbox.ts). Distinguished from
 * ReceiptPayload by `kind: 'otp'` so a scrubbed row `{kind:'otp',scrubbed:true}`
 * never matches this guard again (falls through to the safe generic branch).
 */
interface OtpPayload {
  kind: 'otp';
  code: string;
  ttlMinutes: number;
}

interface FamilyResetPayload {
  kind: 'family-reset';
  resetUrl: string;
  ttlMinutes: number;
}

function isFamilyResetPayload(p: unknown): p is FamilyResetPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as Record<string, unknown>)['kind'] === 'family-reset' &&
    typeof (p as Record<string, unknown>)['resetUrl'] === 'string' &&
    typeof (p as Record<string, unknown>)['ttlMinutes'] === 'number'
  );
}

function isOtpPayload(p: unknown): p is OtpPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as Record<string, unknown>)['kind'] === 'otp' &&
    typeof (p as Record<string, unknown>)['code'] === 'string' &&
    typeof (p as Record<string, unknown>)['ttlMinutes'] === 'number'
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Maps an outbox payload to a rendered email. Never throws. */
export function renderOutboxEmail(payload: unknown): RenderedEmail {
  if (isReceiptPayload(payload)) {
    const name = payload.studentName;
    const subject = `CMC EDU — Xác nhận phiếu thu cho ${name}`;
    const text =
      `Kính gửi Quý phụ huynh,\n\n` +
      `Phiếu thu học phí cho học viên ${name} đã được duyệt và ghi nhận.\n` +
      `Quý phụ huynh vui lòng đăng nhập cổng CMC EDU để xem chi tiết.\n\n` +
      `Trân trọng,\nCMC EDU`;
    const html =
      `<p>Kính gửi Quý phụ huynh,</p>` +
      `<p>Phiếu thu học phí cho học viên <strong>${escapeHtml(name)}</strong> ` +
      `đã được duyệt và ghi nhận.</p>` +
      `<p>Quý phụ huynh vui lòng đăng nhập cổng CMC EDU để xem chi tiết.</p>` +
      `<p>Trân trọng,<br/>CMC EDU</p>`;
    return { subject, html, text };
  }

  if (isFamilyResetPayload(payload)) {
    const url = escapeHtml(payload.resetUrl);
    const ttl = payload.ttlMinutes;
    const subject = 'CMC EDU — Đặt lại mật khẩu gia đình';
    const text =
      `Kính gửi Quý phụ huynh,\n\n` +
      `Quý phụ huynh yêu cầu đặt lại mật khẩu tài khoản gia đình.\n` +
      `Mở liên kết sau (hết hạn sau ${ttl} phút):\n${payload.resetUrl}\n\n` +
      `Nếu không phải Quý phụ huynh yêu cầu, hãy bỏ qua thư này.\n\n` +
      `Trân trọng,\nCMC EDU`;
    const html =
      `<p>Kính gửi Quý phụ huynh,</p>` +
      `<p>Quý phụ huynh yêu cầu đặt lại mật khẩu tài khoản gia đình.</p>` +
      `<p><a href="${url}">Đặt lại mật khẩu</a> — liên kết hết hạn sau ${ttl} phút.</p>` +
      `<p>Nếu không phải Quý phụ huynh yêu cầu, hãy bỏ qua thư này.</p>` +
      `<p>Trân trọng,<br/>CMC EDU</p>`;
    return { subject, html, text };
  }

  if (isOtpPayload(payload)) {
    const code = escapeHtml(payload.code);
    const ttl = payload.ttlMinutes;
    const subject = 'CMC EDU — Mã đăng nhập';
    const text =
      `Kính gửi Quý phụ huynh,\n\n` +
      `Mã đăng nhập cổng CMC EDU của Quý phụ huynh là: ${payload.code}\n` +
      `Mã hết hạn sau ${ttl} phút. Vui lòng không chia sẻ mã này với bất kỳ ai.\n\n` +
      `Trân trọng,\nCMC EDU`;
    const html =
      `<p>Kính gửi Quý phụ huynh,</p>` +
      `<p>Mã đăng nhập cổng CMC EDU của Quý phụ huynh là: <strong>${code}</strong></p>` +
      `<p>Mã hết hạn sau ${ttl} phút. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>` +
      `<p>Trân trọng,<br/>CMC EDU</p>`;
    return { subject, html, text };
  }

  // Unknown payload shape — safe generic notification (never an empty body).
  const subject = 'CMC EDU — Thông báo';
  const text = 'Quý phụ huynh có một thông báo mới. Vui lòng đăng nhập cổng CMC EDU để xem chi tiết.';
  const html = `<p>${text}</p>`;
  return { subject, html, text };
}

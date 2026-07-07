// Renders an EmailOutbox row's domain payload into a concrete email message.
//
// EmailOutbox.payload carries DOMAIN data (e.g. {receiptId, studentName, kind}),
// not rendered content — so every transport (Brevo/Graph) renders here rather
// than duplicating templating. Currently one email type is enqueued (receipt
// approval notification, finance/router.ts enqueueReceiptEmail); unknown shapes
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

  // Unknown payload shape — safe generic notification (never an empty body).
  const subject = 'CMC EDU — Thông báo';
  const text = 'Quý phụ huynh có một thông báo mới. Vui lòng đăng nhập cổng CMC EDU để xem chi tiết.';
  const html = `<p>${text}</p>`;
  return { subject, html, text };
}

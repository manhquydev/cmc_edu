// R5 remediation integration test (deep-review adversarial verification,
// LOW): `enqueueReceiptEmailBestEffort` isolates the receipt-notification
// email enqueue from `receiptApprove`'s provisioning success/failure boundary.
// Before this fix, `enqueueReceiptEmail` shared ONE try/catch with
// `provisionFromReceipt` inside `receiptApprove` — an outbox INSERT failure
// flipped a fully-successful provisioning to `provisioning: 'pending'` and
// wrote a spurious `provisioning.retry_pending` marker, even though the money
// + Student/Guardian/Enrollment/StudentAccount chain had already committed
// correctly. This test exercises the isolation directly via a
// dependency-injected `enqueue` stub — a real Postgres outbox-insert failure
// is not something this suite can force deterministically, and the
// dependency-injection seam (defaulting to the real `enqueueReceiptEmail` in
// production) is exactly what makes this invariant testable without one.

import { describe, expect, it } from 'vitest';
import { enqueueReceiptEmailBestEffort } from './router.js';
import { testDb } from '../test/db.js';

describe('enqueueReceiptEmailBestEffort (R5)', () => {
  it('a throwing enqueue dependency does not propagate and is recorded under its own marker, never provisioning.retry_pending', async () => {
    const receiptId = `test-r5-fail-${Math.random().toString(36).slice(2, 10)}`;
    const receipt = { id: receiptId, parentPhone: '0990000000', studentName: 'R5 Test Child', kind: 'new' };

    await expect(
      enqueueReceiptEmailBestEffort(testDb(), receipt, async () => {
        throw new Error('simulated outbox insert failure');
      }),
    ).resolves.toBeUndefined();

    const retryPendingMarker = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: receiptId, action: 'provisioning.retry_pending' },
    });
    expect(retryPendingMarker).toBeNull();

    const emailFailedMarker = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: receiptId, action: 'email.enqueue_failed' },
    });
    expect(emailFailedMarker).not.toBeNull();
  });

  it('a succeeding enqueue dependency writes no failure marker at all', async () => {
    const receiptId = `test-r5-ok-${Math.random().toString(36).slice(2, 10)}`;
    const receipt = { id: receiptId, parentPhone: '0990000001', studentName: 'R5 OK Child', kind: 'new' };
    let called = false;

    await enqueueReceiptEmailBestEffort(testDb(), receipt, async () => {
      called = true;
    });

    expect(called).toBe(true);
    const emailFailedMarker = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: receiptId, action: 'email.enqueue_failed' },
    });
    expect(emailFailedMarker).toBeNull();
  });
});

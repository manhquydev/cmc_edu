// K6 remediation integration tests: `relayEmailOutbox` drains `EmailOutbox`
// rows through an injectable transport (deep-review K6, MEDIUM — enqueued
// notification emails were never sent, confirmed by 3/3 review agents).
// Covers: pending -> sent via a working transport; a failing transport marks
// the row `failed`; a `failed` row is retried (re-drainable) on the next
// call; a `sent` row is never re-sent (idempotent).

import { afterEach, describe, expect, it } from 'vitest';
import { relayEmailOutbox } from './relay-email-outbox.js';
import type { EmailTransport, OutboxEmail } from './email-transport.js';
import { testDb } from '../test/db.js';

class RecordingTransport implements EmailTransport {
  sent: OutboxEmail[] = [];
  async send(email: OutboxEmail): Promise<void> {
    this.sent.push(email);
  }
}

class AlwaysFailingTransport implements EmailTransport {
  async send(): Promise<void> {
    throw new Error('simulated transport failure');
  }
}

describe('relayEmailOutbox (K6)', () => {
  const outboxIdsToClean: string[] = [];

  afterEach(async () => {
    if (outboxIdsToClean.length > 0) {
      await testDb().emailOutbox.deleteMany({ where: { id: { in: outboxIdsToClean } } });
      outboxIdsToClean.length = 0;
    }
  });

  async function seedOutbox(status: 'pending' | 'sent' | 'failed' = 'pending') {
    const row = await testDb().emailOutbox.create({
      data: {
        to: '84900000000',
        transport: 'brevo',
        status,
        payload: { receiptId: `test-${Math.random().toString(36).slice(2, 10)}` },
      },
    });
    outboxIdsToClean.push(row.id);
    return row;
  }

  it('a pending row is relayed and marked sent via a working transport', async () => {
    const row = await seedOutbox('pending');
    const transport = new RecordingTransport();

    const result = await relayEmailOutbox(testDb(), transport);

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(transport.sent.some((e) => e.id === row.id)).toBe(true);
    const updated = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(updated.status).toBe('sent');
  });

  it('a failing transport marks the row failed, and it is re-drainable on the next call', async () => {
    const row = await seedOutbox('pending');

    const first = await relayEmailOutbox(testDb(), new AlwaysFailingTransport());
    expect(first.failed).toBeGreaterThanOrEqual(1);
    const afterFirst = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(afterFirst.status).toBe('failed');

    // Re-drain with a working transport — the failed row is retried, not
    // permanently dead-lettered.
    const transport = new RecordingTransport();
    const second = await relayEmailOutbox(testDb(), transport);
    expect(transport.sent.some((e) => e.id === row.id)).toBe(true);
    expect(second.sent).toBeGreaterThanOrEqual(1);
    const afterSecond = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(afterSecond.status).toBe('sent');
  });

  it('a sent row is never re-sent (idempotent)', async () => {
    const row = await seedOutbox('sent');
    const transport = new RecordingTransport();

    await relayEmailOutbox(testDb(), transport);

    expect(transport.sent.some((e) => e.id === row.id)).toBe(false);
    const unchanged = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(unchanged.status).toBe('sent');
  });

  it('R3: two concurrent drains never double-send the same row (atomic claim)', async () => {
    const row = await seedOutbox('pending');
    const transportA = new RecordingTransport();
    const transportB = new RecordingTransport();

    // Two "replicas" draining the same outbox concurrently — before the R3
    // atomic-claim fix, both would read the row as `pending` and both send
    // it. The `updateMany WHERE status IN ('pending','failed')` claim lets
    // only one of the two transitions win per row.
    const [resultA, resultB] = await Promise.all([
      relayEmailOutbox(testDb(), transportA),
      relayEmailOutbox(testDb(), transportB),
    ]);

    const totalSendsOfThisRow =
      transportA.sent.filter((e) => e.id === row.id).length + transportB.sent.filter((e) => e.id === row.id).length;
    expect(totalSendsOfThisRow).toBe(1);
    expect(resultA.sent + resultB.sent).toBeGreaterThanOrEqual(1);

    const updated = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(updated.status).toBe('sent');
  });

  it('writes an audit marker when a row fails to relay', async () => {
    const row = await seedOutbox('pending');

    await relayEmailOutbox(testDb(), new AlwaysFailingTransport());

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'EmailOutbox', entityId: row.id, action: 'worker.relayEmailOutbox.failed' },
    });
    expect(audit).not.toBeNull();
  });
});

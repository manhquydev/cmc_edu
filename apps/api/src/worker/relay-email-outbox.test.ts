// K6 remediation integration tests: `relayEmailOutbox` drains `EmailOutbox`
// rows through an injectable transport (deep-review K6, MEDIUM — enqueued
// notification emails were never sent, confirmed by 3/3 review agents).
// Covers: pending -> sent via a working transport; a failing transport marks
// the row `failed`; a `failed` row is retried (re-drainable) on the next
// call; a `sent` row is never re-sent (idempotent).
//
// RT-6/RT-8 additions (unit tests at the bottom of this file): retry
// counting, dead-letter after max attempts, reaping of stuck `sending` rows,
// transport routing by name, and no OTP payload leakage to console.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { relayEmailOutbox } from './relay-email-outbox.js';
import type { EmailTransport, OutboxEmail } from './email-transport.js';
import type { PrismaClient } from '@cmc/db';
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

// ---------------------------------------------------------------------------
// Integration tests (real DB via testDb())
// ---------------------------------------------------------------------------

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

    const result = await relayEmailOutbox(testDb(), { brevo: transport });

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(transport.sent.some((e) => e.id === row.id)).toBe(true);
    const updated = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(updated.status).toBe('sent');
  });

  it('a failing transport marks the row failed, and it is re-drainable on the next call', async () => {
    const row = await seedOutbox('pending');

    const first = await relayEmailOutbox(testDb(), { brevo: new AlwaysFailingTransport() });
    expect(first.failed).toBeGreaterThanOrEqual(1);
    const afterFirst = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(afterFirst.status).toBe('failed');

    // Re-drain with a working transport — the failed row is retried, not
    // permanently dead-lettered (attempts=1 < EMAIL_MAX_ATTEMPTS=5).
    const transport = new RecordingTransport();
    const second = await relayEmailOutbox(testDb(), { brevo: transport });
    expect(transport.sent.some((e) => e.id === row.id)).toBe(true);
    expect(second.sent).toBeGreaterThanOrEqual(1);
    const afterSecond = await testDb().emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(afterSecond.status).toBe('sent');
  });

  it('a sent row is never re-sent (idempotent)', async () => {
    const row = await seedOutbox('sent');
    const transport = new RecordingTransport();

    await relayEmailOutbox(testDb(), { brevo: transport });

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
      relayEmailOutbox(testDb(), { brevo: transportA }),
      relayEmailOutbox(testDb(), { brevo: transportB }),
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

    await relayEmailOutbox(testDb(), { brevo: new AlwaysFailingTransport() });

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'EmailOutbox', entityId: row.id, action: 'worker.relayEmailOutbox.failed' },
    });
    expect(audit).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unit tests (mocked Prisma — no DB connection required)
// RT-6/RT-8: retry counting, dead-letter, reaping, transport routing, log safety
// ---------------------------------------------------------------------------

/** Typed mock shape — keeps vi.fn() methods visible to TypeScript so
 *  mockResolvedValueOnce / .mock.calls are accessible without casts. */
type MockDb = {
  emailOutbox: {
    findMany: MockInstance;
    updateMany: MockInstance;
    update: MockInstance;
  };
  auditLog: {
    create: MockInstance;
  };
};

describe('relayEmailOutbox unit tests (RT-6/RT-8)', () => {
  /** Build a minimal Prisma mock with vi.fn() stubs for every method the relay
   *  calls. Default return values are "no-op" safe defaults; individual tests
   *  override them with mockResolvedValueOnce / mockResolvedValue. */
  function makeMockDb(): MockDb {
    return {
      emailOutbox: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
  }

  /** Minimal row shape matching the fields the relay reads post-migration. */
  function makeRow(overrides?: Partial<{ id: string; to: string; transport: string; attempts: number; payload: unknown }>) {
    return {
      id: 'row-1',
      to: 'parent@test.com',
      transport: 'brevo',
      attempts: 0,
      payload: { receiptId: 'rcpt-abc' },
      ...overrides,
    };
  }

  it('pending row → transport called → marked sent', async () => {
    const db = makeMockDb();
    const row = makeRow();
    db.emailOutbox.updateMany
      .mockResolvedValueOnce({ count: 0 }) // reap: nothing stuck
      .mockResolvedValueOnce({ count: 1 }); // claim: won
    db.emailOutbox.findMany.mockResolvedValue([row]);

    const send = vi.fn().mockResolvedValue(undefined);
    const result = await relayEmailOutbox(db as unknown as PrismaClient, { brevo: { send } });

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ id: 'row-1', to: 'parent@test.com', payload: row.payload });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'sent' } }),
    );
    expect(result).toEqual({ sent: 1, failed: 0, dead: 0, reaped: 0 });
  });

  it('failed row → retried → success → sent', async () => {
    const db = makeMockDb();
    const row = makeRow({ attempts: 2 });
    db.emailOutbox.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    db.emailOutbox.findMany.mockResolvedValue([row]);

    const send = vi.fn().mockResolvedValue(undefined);
    const result = await relayEmailOutbox(db as unknown as PrismaClient, { brevo: { send } });

    expect(send).toHaveBeenCalledOnce();
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.dead).toBe(0);
  });

  it('transport throws → marked failed + attempts incremented', async () => {
    const db = makeMockDb();
    const row = makeRow({ attempts: 0 });
    db.emailOutbox.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    db.emailOutbox.findMany.mockResolvedValue([row]);

    const send = vi.fn().mockRejectedValue(new Error('SMTP timeout'));
    const result = await relayEmailOutbox(db as unknown as PrismaClient, { brevo: { send } });

    expect(result).toEqual({ sent: 0, failed: 1, dead: 0, reaped: 0 });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', attempts: 1, lastError: 'SMTP timeout' }),
      }),
    );
    // nextRetryAt must be set for retryable failures (attempts=1 < EMAIL_MAX_ATTEMPTS=5)
    const updateData = (db.emailOutbox.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(updateData.nextRetryAt).toBeInstanceOf(Date);
  });

  it('transport throws with attempts:4 → dead after 5th failure', async () => {
    const db = makeMockDb();
    // Row has already failed 4 times; this 5th attempt exhausts EMAIL_MAX_ATTEMPTS.
    const row = makeRow({ attempts: 4 });
    db.emailOutbox.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    db.emailOutbox.findMany.mockResolvedValue([row]);

    const send = vi.fn().mockRejectedValue(new Error('connection refused'));
    const result = await relayEmailOutbox(db as unknown as PrismaClient, { brevo: { send } });

    expect(result).toEqual({ sent: 0, failed: 0, dead: 1, reaped: 0 });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'dead', attempts: 5 }),
      }),
    );
    // nextRetryAt must NOT be set on dead rows — they are never re-drained
    const updateData = (db.emailOutbox.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(updateData.nextRetryAt).toBeUndefined();
    // Audit log must use the dead action
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'worker.relayEmailOutbox.dead' }),
      }),
    );
  });

  it('sending row older than 5 min → reaped to pending before drain', async () => {
    const db = makeMockDb();
    db.emailOutbox.updateMany.mockResolvedValueOnce({ count: 2 }); // reap: 2 stuck rows
    db.emailOutbox.findMany.mockResolvedValue([]); // no candidates after reap

    const result = await relayEmailOutbox(db as unknown as PrismaClient, {});

    expect(result.reaped).toBe(2);
    expect(result).toEqual({ sent: 0, failed: 0, dead: 0, reaped: 2 });
    // First updateMany call must target 'sending' status + updatedAt cutoff
    const reapArgs = (db.emailOutbox.updateMany.mock.calls[0] as [{ where: { status: string; updatedAt: { lt: Date } }; data: { status: string } }])[0];
    expect(reapArgs.where.status).toBe('sending');
    expect(reapArgs.where.updatedAt.lt).toBeInstanceOf(Date);
    expect(reapArgs.data.status).toBe('pending');
  });

  it('row with no configured transport → marked dead immediately', async () => {
    const db = makeMockDb();
    const row = makeRow({ transport: 'sms' }); // key absent from transport map
    db.emailOutbox.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    db.emailOutbox.findMany.mockResolvedValue([row]);

    const result = await relayEmailOutbox(db as unknown as PrismaClient, { brevo: { send: vi.fn() } });

    expect(result).toEqual({ sent: 0, failed: 0, dead: 1, reaped: 0 });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'dead',
          lastError: 'no transport configured for: sms',
        }),
      }),
    );
  });

  it('sent rows are never included in the drain query', async () => {
    const db = makeMockDb();
    db.emailOutbox.updateMany.mockResolvedValueOnce({ count: 0 }); // reap only
    db.emailOutbox.findMany.mockResolvedValue([]); // sent rows excluded by the WHERE clause

    await relayEmailOutbox(db as unknown as PrismaClient, {});

    // The findMany WHERE must only include pending/failed
    expect(db.emailOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['pending', 'failed'] } },
      }),
    );
    // update never called — no rows processed
    expect(db.emailOutbox.update).not.toHaveBeenCalled();
  });

  it('does not log OTP payload content to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const db = makeMockDb();
      const row = makeRow({ payload: { otp: 'SECRET_OTP_789', receiptId: 'rcpt-1' } });
      db.emailOutbox.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      db.emailOutbox.findMany.mockResolvedValue([row]);

      // Silent stub transport — relayEmailOutbox itself must not log payload.
      await relayEmailOutbox(db as unknown as PrismaClient, {
        brevo: { send: vi.fn().mockResolvedValue(undefined) },
      });

      const allLogged = [...logSpy.mock.calls, ...errorSpy.mock.calls]
        .flat()
        .map((v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v)))
        .join(' ');

      expect(allLogged).not.toContain('SECRET_OTP_789');
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

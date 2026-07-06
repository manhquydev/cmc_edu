// Worker drain function — K6 remediation. `finance.receiptApprove`
// (`enqueueReceiptEmail`, apps/api/src/finance/router.ts) writes `EmailOutbox`
// rows with `status: 'pending'` but nothing ever relayed them — confirmed by
// 3/3 review agents (deep-review MEDIUM K6): parents never receive the
// notification email. This function drains `pending`/`failed` rows through
// an injectable `EmailTransport` (../worker/email-transport.ts) and marks
// each row `sent` or `failed`.
//
// R3 remediation (deep-review adversarial verification): the original version
// did `findMany(pending/failed)` -> send -> `update sent`, with no claim
// between the read and the send — two concurrent worker replicas draining the
// same outbox would both read the same row and both send it (a double-send).
// Each row is now atomically claimed first via `updateMany WHERE status IN
// ('pending','failed') -> 'sending'` (the same atomic-claim shape as
// `finance.receiptApprove`'s `status: 'draft'` predicate, finance/router.ts):
// the WHERE predicate lets exactly one replica win per row (`claim.count ===
// 1`); the loser sees `count === 0` and skips it, already claimed by another
// replica this cycle.

import type { PrismaClient } from '@cmc/db';
import { ConsoleEmailTransport, type EmailTransport } from './email-transport.js';

export interface RelayEmailOutboxResult {
  sent: number;
  failed: number;
}

/**
 * Drains every `pending` AND `failed` `EmailOutbox` row (failed rows are
 * retried on the next drain — the task's "retry-on-failed" requirement) via
 * `transport`, marking each `sent` or `failed`. Idempotent: a `sent` row is
 * excluded from the query entirely, so it is never re-sent by a later call.
 * One row's transport failure does not abort the batch. Safe to run from
 * multiple worker replicas concurrently (R3 — see the atomic claim below).
 */
export async function relayEmailOutbox(
  db: PrismaClient,
  transport: EmailTransport = new ConsoleEmailTransport(),
): Promise<RelayEmailOutboxResult> {
  const candidates = await db.emailOutbox.findMany({
    where: { status: { in: ['pending', 'failed'] } },
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  let failed = 0;
  for (const row of candidates) {
    // Atomic claim: only a replica that still finds this row `pending`/
    // `failed` at claim time flips it to `sending`. A concurrent replica
    // that already claimed it (or already sent/failed it) makes this
    // `updateMany` match 0 rows — skip it rather than sending a second time.
    const claim = await db.emailOutbox.updateMany({
      where: { id: row.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'sending' },
    });
    if (claim.count !== 1) continue;

    try {
      await transport.send({ id: row.id, to: row.to, payload: row.payload });
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: 'sent' } });
      sent += 1;
    } catch (error) {
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: 'failed' } });
      failed += 1;
      await db.auditLog.create({
        data: {
          actor: 'system',
          action: 'worker.relayEmailOutbox.failed',
          entity: 'EmailOutbox',
          entityId: row.id,
          data: { error: error instanceof Error ? error.message : String(error) },
        },
      });
    }
  }
  return { sent, failed };
}

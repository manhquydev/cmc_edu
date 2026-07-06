// Worker drain function — K6 remediation. `finance.receiptApprove`
// (`enqueueReceiptEmail`, apps/api/src/finance/router.ts) writes `EmailOutbox`
// rows with `status: 'pending'` but nothing ever relayed them — confirmed by
// 3/3 review agents (deep-review MEDIUM K6): parents never receive the
// notification email. This function drains `pending`/`failed` rows through
// an injectable `EmailTransport` (../worker/email-transport.ts) and marks
// each row `sent` or `failed`.

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
 * One row's transport failure does not abort the batch.
 */
export async function relayEmailOutbox(
  db: PrismaClient,
  transport: EmailTransport = new ConsoleEmailTransport(),
): Promise<RelayEmailOutboxResult> {
  const rows = await db.emailOutbox.findMany({
    where: { status: { in: ['pending', 'failed'] } },
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
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

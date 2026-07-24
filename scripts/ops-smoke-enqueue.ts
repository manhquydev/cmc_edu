#!/usr/bin/env tsx
// ops-smoke-enqueue.ts — helper for scripts/ops-smoke.sh mark 5 (email relay).
//
// Writes ONE EmailOutbox row through Prisma (`createPrismaClient` from
// `@cmc/db`, connects as `cmc_app` via APP_DATABASE_URL — the exact role the
// real app writes as, see packages/db/src/index.ts), never via raw SQL/psql.
// This is deliberate (red-team H3): a psql INSERT would bypass whatever
// grants/validation a real request goes through, and would need its own
// hand-maintained copy of the payload shape that silently drifts from the
// real one.
//
// Payload shape mirrors the ACTUAL receipt-notification call site
// (`enqueueReceiptEmail`, apps/api/src/finance/router.ts:1106-1113) —
// `{ receiptId, studentName, kind }` — which is also exactly what
// `isReceiptPayload()` (apps/api/src/worker/email-templates.ts) discriminates
// on. `kind` is deliberately NOT `'otp'`: relay-email-outbox.ts's
// `isOtpKindPayload` scrub-on-sent/scrub-on-sweep logic only touches
// `kind: 'otp'` rows, and this script must never exercise or resemble the
// real OTP path (no OTP is ever involved in this smoke check).
//
// `apps/api/src/finance/router.ts` is not imported directly: it is a
// different workspace package (`@cmc/api`, not a declared dependency of
// `@cmc/scripts`) with its own heavy tRPC/router import graph. Reproducing
// the small literal it writes keeps this script self-contained and fast,
// while still going through Prisma exactly as the real call site does.
//
// Usage: tsx scripts/ops-smoke-enqueue.ts <sink-email>
// Prints exactly one line on success: the created EmailOutbox row's `id`
// (not a secret — a random UUID). Never prints the payload, env values, or
// any credential.

import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@cmc/db';

async function main(): Promise<void> {
  const sink = process.argv[2];
  if (!sink) {
    console.error('usage: tsx scripts/ops-smoke-enqueue.ts <sink-email>');
    process.exitCode = 1;
    return;
  }

  const db = createPrismaClient();
  // Unique per run so this never collides with a real receipt id, and so the
  // polling caller can unambiguously find exactly this row back.
  const syntheticReceiptId = `ops-smoke-${randomUUID()}`;

  try {
    const row = await db.emailOutbox.create({
      data: {
        to: sink,
        transport: 'brevo',
        status: 'pending',
        payload: {
          receiptId: syntheticReceiptId,
          studentName: 'OPS SMOKE TEST',
          kind: 'ops-smoke',
        },
      },
      select: { id: true },
    });
    // Only the row id — never the payload or the sink address twice over.
    console.log(row.id);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

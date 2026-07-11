// Worker drain function — K6 remediation. `finance.receiptApprove`
// (`enqueueReceiptEmail`, apps/api/src/finance/router.ts) writes `EmailOutbox`
// rows with `status: 'pending'` but nothing ever relayed them — confirmed by
// 3/3 review agents (deep-review MEDIUM K6): parents never receive the
// notification email. This function drains `pending`/`failed` rows through
// an injectable `EmailTransport` (./email-transport.ts) and marks each row
// `sent`, `failed`, or `dead`.
//
// R3 remediation (deep-review adversarial verification): each row is
// atomically claimed via `updateMany WHERE status IN ('pending','failed') →
// 'sending'` before any send attempt. Two concurrent replicas draining the
// same outbox see exactly one replica's `updateMany` match count=1; the other
// sees count=0 and skips — no double-send. See the prior migration
// 20260706160000_p1_remediation_wavec_outbox_atomic_claim for the `sending`
// enum value that enables this shape.
//
// RT-6/RT-8 additions:
//   - Transport routing: each row's `transport` field selects from the map.
//   - Retry with exponential back-off: failures increment `attempts` and set
//     `nextRetryAt`. Phase PD-2 will filter by `nextRetryAt`; for now all
//     `failed` rows are drained on every cycle regardless.
//   - Dead-letter: after EMAIL_MAX_ATTEMPTS consecutive failures (default 5),
//     or when no transport is configured for the row's `transport` value, the
//     row is set to `dead` — never re-drained again.
//   - Reap: stuck `sending` rows older than 5 min are reset to `pending`
//     before the drain loop so a crashed worker doesn't strand them.

import type { PrismaClient } from '@cmc/db';
import type { EmailTransport } from './email-transport.js';

/** Refuse ConsoleEmailTransport in production. Index.ts checks this constant
 *  before calling relayEmailOutbox so the worker fails fast rather than
 *  silently swallowing emails behind a console stub. */
export const CONSOLE_TRANSPORT_PROD_FORBIDDEN = true;

/** Configurable via env — default 5. A row reaching this many consecutive
 *  failures transitions to `dead` (permanent terminal state). */
const EMAIL_MAX_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS ?? 5);

/** Rows still in `sending` after this long are presumed from a crashed worker
 *  and are reset to `pending` before the main drain loop. */
const SENDING_REAP_TIMEOUT_MS = 5 * 60 * 1_000;

/** Must stay in sync with `OTP_TTL_MINUTES` in `lms-auth/router.ts`. Sweep
 *  window for orphaned OTP payloads (row stuck in `failed`/`pending` — e.g.
 *  worker died mid-cycle — past the point the code could still be used to
 *  log in). Gap-closure 260710-0005 Phase 1 red-team C1/validation #2: scrub
 *  runs on both terminal success paths (`sent`, `dead`) AND this age-based
 *  sweep, so no OTP plaintext survives past its login TTL regardless of
 *  which state the row is stuck in. */
const OTP_PAYLOAD_TTL_MINUTES = 5;

/** True when a raw `EmailOutbox.payload` JSON value is an (unscrubbed or
 *  scrubbed) OTP payload — kind discriminator only, no other field access. */
function isOtpKindPayload(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as Record<string, unknown>)['kind'] === 'otp'
  );
}

const SCRUBBED_OTP_PAYLOAD = { kind: 'otp', scrubbed: true };

/** Configurable via env — default 30. Terminal (`sent`/`dead`) rows older
 *  than this many days are pruned every drain cycle (see
 *  `pruneTerminalOutbox`) to keep the table small. */
const EMAIL_OUTBOX_RETENTION_DAYS = Number(process.env.EMAIL_OUTBOX_RETENTION_DAYS ?? 30);

/**
 * Scrubs plaintext OTP codes from `EmailOutbox` rows older than
 * `OTP_PAYLOAD_TTL_MINUTES`, regardless of `status`. Covers the case where a
 * row is stuck in `pending`/`sending`/`failed` (worker crash, transport
 * outage) past the point the code is still usable — closes red-team C1
 * (scrub-only-on-success left `dead`/stuck rows holding plaintext forever).
 */
export async function sweepStaleOtpPayloads(db: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - OTP_PAYLOAD_TTL_MINUTES * 60_000);
  const result = await db.emailOutbox.updateMany({
    where: {
      createdAt: { lt: cutoff },
      AND: [
        { payload: { path: ['kind'], equals: 'otp' } },
        // Whole-object inequality, not `NOT path:['scrubbed'] equals true`:
        // an unscrubbed row is MISSING the `scrubbed` key entirely, so a
        // path-scoped check compares against NULL and Postgres 3-valued
        // logic makes `NOT (NULL)` = UNKNOWN — the row is silently excluded
        // from every future sweep and its OTP plaintext never gets scrubbed
        // (the exact C1 hole this sweep exists to close). Comparing the
        // whole payload object against SCRUBBED_OTP_PAYLOAD has no such
        // trap: an unscrubbed row never equals it, so `NOT equals` stays
        // true until the row is actually scrubbed — after which it drops
        // out and stops being re-updated every cycle.
        { NOT: { payload: { equals: SCRUBBED_OTP_PAYLOAD } } },
      ],
    },
    data: { payload: SCRUBBED_OTP_PAYLOAD },
  });
  return result.count;
}

/**
 * Deletes terminal (`sent`/`dead`) `EmailOutbox` rows older than
 * `EMAIL_OUTBOX_RETENTION_DAYS`. Never touches `pending`/`failed`/`sending`
 * — those still need to be drained or retried. Not a ledger table (unlike
 * RefundRecord/AuditLog), so hard-delete is safe here.
 *
 * Retention is keyed off `createdAt`, not time-of-termination — a row that
 * stays non-terminal past the retention window and only then reaches
 * `sent`/`dead` gets pruned the same cycle it terminates (no grace period).
 * Harmless in practice: `failed` rows are redrained every cycle regardless
 * of `nextRetryAt`, so a row reaches `dead` within a handful of cycles under
 * normal operation — this only matters after sustained (multi-week) worker
 * downtime.
 */
export async function pruneTerminalOutbox(db: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - EMAIL_OUTBOX_RETENTION_DAYS * 24 * 60 * 60_000);
  const result = await db.emailOutbox.deleteMany({
    where: {
      status: { in: ['sent', 'dead'] },
      createdAt: { lt: cutoff },
    },
  });
  return result.count;
}

/**
 * Exponential back-off before the next retry.
 * Caps at 30 minutes so a permanently-broken transport doesn't produce a
 * row that waits days before being retried on the next worker restart.
 *
 * attempts=1 → 2 min, 2 → 4 min, 3 → 8 min, 4 → 16 min, 5+ → 30 min.
 */
function backoffMs(attempts: number): number {
  return Math.min(30, 2 ** attempts) * 60_000;
}

export interface RelayEmailOutboxResult {
  sent: number;
  failed: number;
  dead: number;
  reaped: number;
  /** Count of stale OTP-payload rows scrubbed this cycle (see sweepStaleOtpPayloads). */
  otpSwept: number;
  /** Count of terminal (sent/dead) rows deleted this cycle (see pruneTerminalOutbox). */
  pruned: number;
}

/**
 * Drains every `pending` AND `failed` `EmailOutbox` row via the matching
 * transport in `transport`, marking each `sent`, `failed`, or `dead`.
 *
 * @param db      - Prisma client (real or mocked in tests).
 * @param transport - Map from `EmailOutbox.transport` value to a concrete
 *   `EmailTransport` implementation. Defaults to `{}` (empty map) — when
 *   empty, every row hits the "no transport configured" path and becomes
 *   `dead`. This is intentional fail-closed behaviour: the caller must
 *   explicitly opt in to ConsoleEmailTransport in non-production environments.
 */
export async function relayEmailOutbox(
  db: PrismaClient,
  transport: Record<string, EmailTransport> = {},
): Promise<RelayEmailOutboxResult> {
  // ── 1. Reap stuck `sending` rows ──────────────────────────────────────────
  // A row stays `sending` for the duration of one send attempt. Any row still
  // `sending` after SENDING_REAP_TIMEOUT_MS (5 min) means the worker process
  // crashed between the atomic claim and the status update. Reset it so a
  // fresh worker cycle can retry it.
  const reaperCutoff = new Date(Date.now() - SENDING_REAP_TIMEOUT_MS);
  const reaped_result = await db.emailOutbox.updateMany({
    where: { status: 'sending', updatedAt: { lt: reaperCutoff } },
    data: { status: 'pending' },
  });
  const reaped = reaped_result.count;

  // ── 2. Drain `pending` / `failed` rows ────────────────────────────────────
  const candidates = await db.emailOutbox.findMany({
    where: { status: { in: ['pending', 'failed'] } },
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  let failed = 0;
  let dead = 0;

  for (const row of candidates) {
    // Atomic claim (R3): only the replica that wins the `updateMany` race
    // (count=1) proceeds. The loser (count=0) skips — the row was already
    // claimed or advanced by a concurrent replica this cycle.
    const claim = await db.emailOutbox.updateMany({
      where: { id: row.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'sending' },
    });
    if (claim.count !== 1) continue;

    // ── 2a. Route to transport ───────────────────────────────────────────────
    const t = transport[row.transport as string];
    if (!t) {
      const reason = `no transport configured for: ${row.transport as string}`;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: 'dead',
          attempts: (row.attempts as number) + 1,
          lastError: reason,
          // C1: dead is terminal — scrub any OTP plaintext now, don't wait for sweep.
          ...(isOtpKindPayload(row.payload) ? { payload: SCRUBBED_OTP_PAYLOAD } : {}),
        },
      });
      dead += 1;
      await db.auditLog.create({
        data: {
          actor: 'system',
          action: 'worker.relayEmailOutbox.dead',
          entity: 'EmailOutbox',
          entityId: row.id,
          data: { reason, attempts: (row.attempts as number) + 1 },
        },
      });
      continue;
    }

    // ── 2b. Attempt delivery ─────────────────────────────────────────────────
    try {
      await t.send({ id: row.id, to: row.to, payload: row.payload });
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: 'sent',
          // C1: scrub OTP plaintext immediately on the success path.
          ...(isOtpKindPayload(row.payload) ? { payload: SCRUBBED_OTP_PAYLOAD } : {}),
        },
      });
      sent += 1;
    } catch (error) {
      const newAttempts = (row.attempts as number) + 1;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isDead = newAttempts >= EMAIL_MAX_ATTEMPTS;

      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: isDead ? 'dead' : 'failed',
          attempts: newAttempts,
          lastError: errorMsg,
          // nextRetryAt is set only for retryable failures; dead rows don't
          // need it (they are never re-drained). Phase PD-2 will use this
          // column to filter out rows whose nextRetryAt hasn't passed yet.
          ...(isDead ? {} : { nextRetryAt: new Date(Date.now() + backoffMs(newAttempts)) }),
          // C1: `dead` is terminal — scrub now. `failed` (still retryable)
          // intentionally KEEPS the code so a retry can still send it; the
          // age-based sweep (sweepStaleOtpPayloads) is the backstop if a
          // `failed` row never recovers before the OTP's own login TTL.
          ...(isDead && isOtpKindPayload(row.payload) ? { payload: SCRUBBED_OTP_PAYLOAD } : {}),
        },
      });

      if (isDead) {
        dead += 1;
      } else {
        failed += 1;
      }

      await db.auditLog.create({
        data: {
          actor: 'system',
          action: isDead ? 'worker.relayEmailOutbox.dead' : 'worker.relayEmailOutbox.failed',
          entity: 'EmailOutbox',
          entityId: row.id,
          data: { error: errorMsg, attempts: newAttempts },
        },
      });
    }
  }

  // ── 3. Sweep stale OTP payloads (age-based, any status) ───────────────────
  // Runs AFTER the drain loop, not before: a stale `pending`/`failed` row
  // scrubbed first would then be claimed and sent this SAME cycle with its
  // payload already wiped — `renderOutboxEmail` falls through to the empty
  // generic branch, wasting a real Brevo send on content-free mail instead
  // of the row being handled by drain (sent-with-code or dead-lettered).
  // Running the sweep last means drain always sees the real payload first;
  // the sweep then only catches rows drain didn't resolve this cycle (still
  // `pending`/`failed`/`sending` and past the OTP's own login TTL).
  const otpSwept = await sweepStaleOtpPayloads(db);

  // ── 4. Prune terminal rows past retention ──────────────────────────────────
  const pruned = await pruneTerminalOutbox(db);

  return { sent, failed, dead, reaped, otpSwept, pruned };
}

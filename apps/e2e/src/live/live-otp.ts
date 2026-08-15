// live-otp — reads REAL OTP codes on the live environment.
//
// Production forbids TEST_OTP_SEAM (apps/api/src/boot-checks.ts throws), so
// the live suite must obtain the plaintext code the system actually queued.
// The EmailOutbox table stores it in payload.code ({kind:'otp', code}) — the
// same artifact readOtpCodeByEmail (src/db.ts) uses on the local harness.
//
// The prod Postgres has NO host port mapping (scout §6), so this helper reads
// it through the container:  docker exec cmcv2-prod-postgres-1 psql -U
// postgres -d cmc_prod -tAc "SELECT ..."  — READ-ONLY SELECTs only; the live
// suite never writes to the DB.
//
// Fallback: the outbox worker may drain+scrub the payload within seconds
// (payload becomes {kind:'otp', scrubbed:true}); when that races the read, the
// code is recovered from the LoginOtp.codeHash (salted sha256) — the same
// brute-force fallback readOtpCodeByEmail uses.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const CONTAINER = process.env.LIVE_POSTGRES_CONTAINER ?? 'cmcv2-prod-postgres-1';
const DB_USER = process.env.LIVE_POSTGRES_USER ?? 'postgres';
const DB_NAME = process.env.LIVE_POSTGRES_DB ?? 'cmc_prod';

const PSQL_TIMEOUT_MS = 20_000;
const OTP_POLL_MS = 1_500;
const OTP_POLL_LIMIT_MS = 30_000;
const OTP_CODE_SPACE = 1_000_000;

async function psqlSelect(query: string): Promise<string> {
  const { stdout } = await execFileP(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', query],
    { timeout: PSQL_TIMEOUT_MS },
  );
  return stdout.trim();
}

/** Recovers the plaintext code behind a salted salt:digest sha256 hash by
 *  walking the 6-digit space (sub-second, same as src/db.ts). */
function recoverCodeFromHash(codeHash: string, subject: string): string {
  const separatorIndex = codeHash.indexOf(':');
  if (separatorIndex < 0) {
    throw new Error('Malformed LoginOtp.codeHash for ' + subject + '.');
  }
  const salt = codeHash.slice(0, separatorIndex);
  const digest = codeHash.slice(separatorIndex + 1);
  for (let i = 0; i < OTP_CODE_SPACE; i += 1) {
    const candidate = String(i).padStart(6, '0');
    if (createHash('sha256').update(salt + candidate).digest('hex') === digest) {
      return candidate;
    }
  }
  throw new Error('Could not recover the OTP code for ' + subject + ' (brute-force exhausted).');
}

export interface OtpReadOptions {
  /** Milliseconds to keep polling for the queued email before giving up. */
  timeoutMs?: number;
}

/** Polls EmailOutbox for a fresh OTP email to emailLike and returns the
 *  plaintext code; falls back to recovering it from the LoginOtp hash when the
 *  outbox worker scrubbed the payload first. Throws a diagnostic error when
 *  no OTP email was ever queued (usually: no ParentAccount owns the address —
 *  lmsAuth.requestOtpEmail answers {ok:true} either way by design). */
export async function readOtpFromEmailOutbox(emailLike: string, opts: OtpReadOptions = {}): Promise<string> {
  const deadline = Date.now() + (opts.timeoutMs ?? OTP_POLL_LIMIT_MS);
  let lastError: string | null = null;

  const emailLower = emailLike.toLowerCase();
  while (Date.now() < deadline) {
    try {
      // "to" is a reserved word in Postgres — double-quote the column name.
      const row = await psqlSelect(
        "SELECT payload::text FROM \"EmailOutbox\" WHERE \"to\" ILIKE '%" +
          emailLower +
          "%' AND payload->>'kind' = 'otp' AND payload ? 'code' ORDER BY \"createdAt\" DESC LIMIT 1",
      );
      if (row) {
        const payload = JSON.parse(row) as { code?: unknown };
        if (typeof payload?.code === 'string' && /^\d{6}$/.test(payload.code)) {
          return payload.code;
        }
      }

      // The row may exist but be scrubbed already — check for it so the
      // fallback is only attempted when the email WAS actually queued.
      const anyOtpRow = await psqlSelect(
        "SELECT 1 FROM \"EmailOutbox\" WHERE \"to\" ILIKE '%" +
          emailLower +
          "%' AND payload->>'kind' = 'otp' ORDER BY \"createdAt\" DESC LIMIT 1",
      );
      if (anyOtpRow) {
        const hash = await psqlSelect(
          'SELECT "codeHash" FROM "LoginOtp" WHERE email = \'' +
            emailLower +
            "\' AND status = 'pending' ORDER BY \"createdAt\" DESC LIMIT 1",
        );
        if (hash) {
          return recoverCodeFromHash(hash, 'email ' + emailLike);
        }
        lastError =
          'an OTP email was queued for ' +
          emailLike +
          ' but its payload is scrubbed and no pending LoginOtp row remains.';
      } else {
        lastError =
          'no OTP email has been queued for ' +
          emailLike +
          ' yet — lmsAuth.requestOtpEmail answers {ok:true} either way, so this usually means no ' +
          'ParentAccount owns the address (check the "Email phụ huynh" field on the receipt).';
      }
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, OTP_POLL_MS));
  }

  throw new Error('readOtpFromEmailOutbox: no OTP code within the poll window for ' + emailLike + '. ' + lastError);
}

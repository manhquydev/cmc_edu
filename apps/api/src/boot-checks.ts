import type { PrismaClient } from '@cmc/db';
import { LMS_SESSION_SECRET_DEV_DEFAULT } from './lms-auth/session-token.js';

/**
 * Verifies the connected DB user is NOT a PostgreSQL superuser (ADR 0042).
 *
 * A superuser bypasses all Row-Level Security policies unconditionally, which
 * would silently neutralise the entire cross-facility isolation guarantee.
 * `cmc_app` must be a restricted role — this check fails loudly at boot rather
 * than letting the server start in an insecure configuration.
 *
 * Call once at server startup before accepting requests.
 */
export async function assertCmcAppNotSuperuser(db: PrismaClient): Promise<void> {
  const result = await db.$queryRaw<Array<{ is_superuser: boolean }>>`
    SELECT usesuper AS is_superuser FROM pg_user WHERE usename = current_user
  `;
  if (result[0]?.is_superuser) {
    throw new Error(
      'FATAL: Database user has superuser privilege. ' +
        'cmc_app must be a restricted role for RLS to be effective (ADR 0042). ' +
        'Revoke superuser from the role and restart the server.',
    );
  }
}

/**
 * RT-2 / V2: Refuses to start in production if ALLOW_DEV_AUTH is still set.
 *
 * The `ALLOW_DEV_AUTH` escape hatch was removed from context.ts (it no longer
 * affects the auth gate), but this check provides a belt-and-suspenders
 * assertion: if an operator accidentally sets `ALLOW_DEV_AUTH=1` in a prod
 * deploy, the server refuses to start rather than silently ignoring it.
 */
export function assertAllowDevAuthNotInProd(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEV_AUTH === '1'
  ) {
    throw new Error(
      'FATAL: ALLOW_DEV_AUTH=1 must not be set in production. ' +
        'This env var is a dev-only impersonation escape hatch that has been ' +
        'removed from the auth gate. Remove it from the production environment ' +
        'and restart the server.',
    );
  }
}

/**
 * RT-1: Refuses to start in production if LMS_SESSION_SECRET is unset or
 * still the hard-coded dev default. A missing/default secret means the
 * HMAC-signed LMS bearer tokens can be forged by anyone who reads the source.
 */
export function assertLmsSecretConfiguredForProd(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = process.env['LMS_SESSION_SECRET'];
  if (!secret) {
    throw new Error(
      'FATAL: LMS_SESSION_SECRET must be set in production. ' +
        'Set a cryptographically random secret of at least 32 characters.',
    );
  }
  if (secret === LMS_SESSION_SECRET_DEV_DEFAULT) {
    throw new Error(
      'FATAL: LMS_SESSION_SECRET is using the insecure dev default. ' +
        'Replace it with a unique cryptographically random secret in production.',
    );
  }
}

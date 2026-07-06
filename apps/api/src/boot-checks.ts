import type { PrismaClient } from '@cmc/db';

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

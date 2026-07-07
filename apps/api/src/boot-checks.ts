import type { PrismaClient } from '@cmc/db';
import { LMS_SESSION_SECRET_DEV_DEFAULT } from './lms-auth/session-token.js';

/**
 * RT-7: Asserts the connected DB role is exactly 'cmc_app'.
 *
 * Superuser is rejected by assertCmcAppNotSuperuser; this check also rejects
 * the owner/migration role (e.g. 'postgres' or the role in DATABASE_URL).
 * Table owners bypass RLS unconditionally even without superuser, so
 * connecting as owner neutralises cross-facility isolation (ADR 0042).
 *
 * Expected in production: APP_DATABASE_URL connects as cmc_app.
 */
export async function assertCmcAppRole(db: PrismaClient): Promise<void> {
  const rows = await db.$queryRaw<Array<{ current_user: string }>>`
    SELECT current_user::text AS current_user
  `;
  const role = rows[0]?.current_user;
  if (role !== 'cmc_app') {
    throw new Error(
      `FATAL: Database role is '${role ?? 'unknown'}', expected 'cmc_app'. ` +
        'Connecting as the table owner bypasses RLS unconditionally (ADR 0042). ' +
        'Ensure APP_DATABASE_URL connects as cmc_app and restart.',
    );
  }
}

/**
 * RT-7: Asserts every RLS-enabled table also has FORCE ROW LEVEL SECURITY.
 *
 * Without FORCE RLS the table owner can read/write across all facilities even
 * when RLS policies are defined. A table with rowsecurity=true but
 * relforcerowsecurity=false is silently unsafe for owner connections.
 */
export async function assertForceRlsOnAllRlsTables(db: PrismaClient): Promise<void> {
  const tables = await db.$queryRaw<
    Array<{ relname: string; relforcerowsecurity: boolean }>
  >`
    SELECT c.relname, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
  `;
  const missing = tables.filter((t) => !t.relforcerowsecurity).map((t) => t.relname);
  if (missing.length > 0) {
    throw new Error(
      `FATAL: FORCE ROW LEVEL SECURITY missing on RLS table(s): ${missing.join(', ')}. ` +
        'Run: ALTER TABLE <table> FORCE ROW LEVEL SECURITY; for each and restart.',
    );
  }
}

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

/**
 * Runtime twin of `scripts/env-check.sh` (which guards CI / shell pre-boot).
 * Runs inside the app at startup so the production image (alpine, no bash)
 * still fails closed on a missing env-var contract. Reports only variable
 * NAMES, never values.
 *
 * Storage: either the full S3_* set OR the local-disk fallback (BLOB_STORAGE_DIR).
 * SSO/Graph vars are enforced only when SSO_ENABLED=true (Entra app is shared
 * between staff SSO and Graph email). LMS_SESSION_SECRET is covered separately
 * by assertLmsSecretConfiguredForProd (kept for its dev-default check).
 */
export function assertRequiredEnvForProd(): void {
  if (process.env.NODE_ENV !== 'production') return;

  if (process.env['TEST_OTP_SEAM']) {
    throw new Error('FATAL: TEST_OTP_SEAM must not be set in production.');
  }

  const required = ['APP_DATABASE_URL', 'DATABASE_URL', 'BREVO_API_KEY', 'TRUSTED_PROXY_CIDRS', 'CORS_ORIGINS'];

  if (process.env['S3_ENDPOINT']) {
    required.push('S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY');
  } else {
    required.push('BLOB_STORAGE_DIR');
  }

  if (process.env['SSO_ENABLED'] === 'true') {
    required.push(
      'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'ERP_SSO_REDIRECT_URI',
      'GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_SENDER_EMAIL',
    );
  }

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `FATAL: missing required env var(s) in production: ${missing.join(', ')}. ` +
        'See .env.example / scripts/env-check.sh. Set them and restart.',
    );
  }
}

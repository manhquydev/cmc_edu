// @cmc/db — database access surface.
//
// Re-exports the generated Prisma client. Consumers create their own instance
// via `createPrismaClient()` so importing this module has no side effects (no
// connection is opened at import time). A single shared connection strategy
// lands with the first data story.

export { PrismaClient, Role } from '@prisma/client';
export type { Prisma } from '@prisma/client';

import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Factory for a Prisma client. Callers own the lifecycle (connect/disconnect).
 *
 * Connects via `APP_DATABASE_URL` when set, falling back to `DATABASE_URL`
 * (schema/migration owner role). This distinction matters for Postgres RLS
 * (ADR 0042, docs/decisions/0042-rls-defense-in-depth.md): RLS policies are
 * silently NO-OPs for the table owner and for any role with the superuser or
 * BYPASSRLS attribute — a role that cannot be forced to respect RLS. The dev
 * migration role (`DATABASE_URL`) is exactly such a role, so the application
 * (and its tests) must connect as a separate, unprivileged role
 * (`cmc_app` — see the `p1_remediation_wave1_schema_rls` migration) via
 * `APP_DATABASE_URL` for the policies to have any effect.
 *
 * Prisma 7 removed the `datasources` constructor override along with
 * `datasource.url` in schema.prisma — connection selection now happens by
 * building a driver adapter (`@prisma/adapter-pg`) from an explicit
 * connection string and handing it to the client. See
 * `createPrivilegedPrismaClient` below for the migration-owner-role
 * counterpart of this factory (DATABASE_URL only, no fallback chain).
 */
export function createPrismaClient(): PrismaClient {
  const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  return buildPrismaClient(
    url,
    'createPrismaClient: neither APP_DATABASE_URL nor DATABASE_URL is set.',
  );
}

/**
 * Factory for the PRIVILEGED (schema/migration-owner role) Prisma client —
 * connects via `DATABASE_URL` ONLY, deliberately with no `APP_DATABASE_URL`
 * fallback. This is the escape hatch a handful of call sites use for
 * operations the unprivileged `cmc_app` role has no grant for — audit-log
 * retention (`apps/api/src/worker/audit-log-retention-sweep.ts`), and
 * teardown of append-only ledgers in the api/e2e test harnesses
 * (`apps/api/src/test/db.ts`, `apps/e2e/src/db.ts`). Each of those callers
 * previously built this connection inline via
 * `new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })`,
 * a construction Prisma 7 removed — they now call this factory instead.
 *
 * No fallback chain on purpose: if this silently fell back to
 * `APP_DATABASE_URL` when `DATABASE_URL` were unset, a caller that needs the
 * schema-owner role would instead get the unprivileged role, and fail later
 * with a confusing permission error (or, worse for RLS-bypass callers,
 * silently see fewer rows) instead of failing immediately and clearly here.
 */
export function createPrivilegedPrismaClient(): PrismaClient {
  return buildPrismaClient(process.env.DATABASE_URL, 'createPrivilegedPrismaClient: DATABASE_URL is not set.');
}

/**
 * Factory for scripts that resolve their own connection string (e.g. an env
 * var chosen at the caller's discretion, or a rewritten host for
 * container-vs-host reachability — see `scripts/ensure-curriculum-units.ts`).
 * `connectionString` is REQUIRED (not optional): there is no fallback chain
 * here, so a caller cannot accidentally end up on the wrong role by omitting
 * it — that ambiguity is exactly what `createPrismaClient`/
 * `createPrivilegedPrismaClient` above exist to avoid.
 */
export function createPrismaClientWithUrl(connectionString: string): PrismaClient {
  return buildPrismaClient(connectionString, 'createPrismaClientWithUrl: connectionString must be non-empty.');
}

function buildPrismaClient(url: string | undefined, missingUrlMessage: string): PrismaClient {
  if (!url) {
    // Fail loud, matching the pre-Prisma-7 behavior where an unset
    // `DATABASE_URL` made Prisma's own `env("DATABASE_URL")` resolution throw.
    // `pg.Pool` (which the adapter wraps) falls back to libpq-style `PG*`
    // environment variables / local defaults when `connectionString` is
    // `undefined` — silently connecting to an unintended local Postgres
    // instead of failing is exactly the failure mode ADR 0042 exists to rule
    // out, so this must throw rather than pass `undefined` through.
    throw new Error(missingUrlMessage);
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export interface WithFacilityOptions {
  /**
   * Sets `app.bypass_rls = 'on'` for the transaction — the audited,
   * narrow escape hatch (ADR 0042) for cross-facility reads: super_admin /
   * director executive visibility, and the LMS parent-facing read paths that
   * are gated by `parentAccountId` ownership rather than a single facility
   * (see `Guardian`/`GuardianLinkRequest` comments in schema.prisma).
   */
  bypass?: boolean;
}

/**
 * Runs `fn` inside a Postgres transaction with the RLS GUCs
 * (`app.current_facility_id`, `app.bypass_rls`) set via
 * `set_config(key, value, true)` — the third argument (`is_local`) makes the
 * setting transaction-LOCAL, so it is automatically unset at COMMIT/ROLLBACK
 * regardless of Prisma's connection pooling (a session-level `SET` would leak
 * across pooled connections onto unrelated requests — unsafe). Facility-scoped
 * Postgres RLS policies read these GUCs as a backstop behind the app-level
 * `scoped(ctx)` filter (ADR 0042).
 *
 * Every facility-scoped Prisma call in a request MUST go through this helper
 * (or receive a `tx` obtained from it) — a plain `ctx.db.someModel.find(...)`
 * outside of it runs with no GUC set, which the RLS policies treat as "no
 * facility, no bypass" and reject (0 rows), not "unrestricted".
 */
export async function withFacility<T>(
  db: PrismaClient,
  facilityId: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts: WithFacilityOptions = {},
): Promise<T> {
  if (!opts.bypass && !facilityId) {
    throw new Error('withFacility requires a facilityId unless { bypass: true } is set.');
  }
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_facility_id', ${facilityId ?? ''}, true)`;
      if (opts.bypass) {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      }
      return fn(tx);
    },
    // Prisma default is 5000ms — under full-suite parallel DB load (Vitest
    // spawns many concurrent request-shaped transactions against one Postgres),
    // legitimate KPI-refresh transactions with per-shift punch collection can
    // race the deadline. Prod transactions complete in ms; a raised ceiling
    // costs nothing there and eliminates a class of infra-load flakes.
    { timeout: 15_000 },
  );
}

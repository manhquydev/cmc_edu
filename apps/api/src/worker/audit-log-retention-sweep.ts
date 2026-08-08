// Phase-04 super-admin-completion: AuditLog retention sweep (PO decision:
// auto-delete rows older than 12 months). `AuditLog` has UPDATE/DELETE
// revoked from `cmc_app` — the append-only guarantee enforced by
// `security/append-only-privilege.test.ts` and the connection every
// user-facing request runs through (`createPrismaClient()` prefers
// `APP_DATABASE_URL`). This sweep therefore opens a SEPARATE, privileged
// (schema/migration owner role) connection — the ONLY code path in the
// entire app that can ever delete an audit row; every request path keeps
// the guarantee that a bug or compromised app process cannot erase history.
// Same pattern as the test harness's own `privilegedDb()` (test/db.ts).

import { createPrivilegedPrismaClient, type PrismaClient } from '@cmc/db';

const RETENTION_MONTHS = 12;

let privilegedAuditDbSingleton: PrismaClient | undefined;

function privilegedAuditDb(): PrismaClient {
  // Prisma 7: `new PrismaClient({ datasources: ... })` no longer exists —
  // route through the shared privileged-role factory (DATABASE_URL only)
  // instead of constructing the adapter here.
  privilegedAuditDbSingleton ??= createPrivilegedPrismaClient();
  return privilegedAuditDbSingleton;
}

export interface SweepAuditLogRetentionResult {
  deletedCount: number;
}

/** Deletes every `AuditLog` row older than 12 months. Exported for the
 * worker loop; also callable directly in tests (`now` defaults to the real
 * clock, injectable for the exact cutoff-boundary tests). */
export async function sweepAuditLogRetention(now: Date = new Date()): Promise<SweepAuditLogRetentionResult> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const { count } = await privilegedAuditDb().auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deletedCount: count };
}

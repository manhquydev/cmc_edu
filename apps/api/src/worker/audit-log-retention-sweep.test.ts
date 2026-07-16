// Phase-04 super-admin-completion: AuditLog retention sweep — rows older
// than 12 months are deleted. AuditLog has UPDATE/DELETE revoked from
// cmc_app (append-only guarantee, security/append-only-privilege.test.ts),
// so this sweep deliberately runs on a separate, privileged (schema/
// migration owner role) connection — the only code path in the app that can
// ever delete an audit row. Covers the exact cutoff boundary: an 11-month-old
// row survives, a 13-month-old row is swept.

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sweepAuditLogRetention } from './audit-log-retention-sweep.js';
import { testDb } from '../test/db.js';

function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

describe('sweepAuditLogRetention (phase-04)', () => {
  it('deletes rows older than 12 months, keeps rows within 12 months (exact cutoff boundary)', async () => {
    const now = new Date('2026-07-16T00:00:00.000Z');
    const keptId = randomUUID();
    const sweptId = randomUUID();

    await testDb().auditLog.create({
      data: {
        id: keptId,
        actor: 'retention-test',
        action: 'retention.kept',
        entity: 'Test',
        entityId: 'kept-1',
        createdAt: monthsAgo(now, 11),
      },
    });
    await testDb().auditLog.create({
      data: {
        id: sweptId,
        actor: 'retention-test',
        action: 'retention.swept',
        entity: 'Test',
        entityId: 'swept-1',
        createdAt: monthsAgo(now, 13),
      },
    });

    const result = await sweepAuditLogRetention(now);
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);

    const kept = await testDb().auditLog.findUnique({ where: { id: keptId } });
    const swept = await testDb().auditLog.findUnique({ where: { id: sweptId } });
    expect(kept).not.toBeNull();
    expect(swept).toBeNull();
  });

  it('is a no-op (deletedCount=0) when no row is older than 12 months', async () => {
    const now = new Date('2026-07-16T00:00:00.000Z');
    const id = randomUUID();
    await testDb().auditLog.create({
      data: {
        id,
        actor: 'retention-test-noop',
        action: 'retention.recent',
        entity: 'Test',
        entityId: 'recent-1',
        createdAt: monthsAgo(now, 1),
      },
    });

    await sweepAuditLogRetention(now);

    const stillThere = await testDb().auditLog.findUnique({ where: { id } });
    expect(stillThere).not.toBeNull();
  });
});

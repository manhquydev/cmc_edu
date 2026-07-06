// K5 remediation acceptance test: Postgres must enforce append-only ledgers
// (RefundRecord, AuditLog — I5/docs/01 §4) at the PRIVILEGE layer, not just by
// application convention. Before the `p1_remediation_wavea_privilege_hardening`
// migration, `cmc_app` had blanket `SELECT, INSERT, UPDATE, DELETE ON ALL
// TABLES` with no REVOKE (deep-review K5, CONFIRMED) — so a bug (or a
// compromised app process) could silently edit/erase ledger history. This
// test connects as the SAME unprivileged `cmc_app` role the app runs as
// (`testDb()`) and proves UPDATE/DELETE on these two tables now fail at the
// database layer.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupFacility, createTestFacility, testDb, testDbBypass } from '../test/db.js';

describe('append-only ledger privilege enforcement (K5)', () => {
  let facility: { id: string };
  let refund: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('K5 Privilege Facility');
    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-K5-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 5_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone: '0995000001',
          studentName: 'K5 Privilege Student',
          createdById: 'test-creator',
        },
      }),
    );
    refund = await testDbBypass((tx) =>
      tx.refundRecord.create({
        data: { receiptId: receipt.id, facilityId: facility.id, amount: 1_000_000 },
      }),
    );
  });

  afterEach(async () => {
    // `cleanupFacility` deletes RefundRecord via the privileged migration-role
    // connection internally (see test/db.ts `privilegedDb()`), since cmc_app
    // itself can no longer DELETE this table — exactly the invariant this
    // file asserts.
    await cleanupFacility(facility.id);
  });

  it('cmc_app cannot UPDATE a RefundRecord row', async () => {
    await expect(
      testDb().refundRecord.update({ where: { id: refund.id }, data: { amount: 999 } }),
    ).rejects.toThrow();

    const unchanged = await testDbBypass((tx) => tx.refundRecord.findUniqueOrThrow({ where: { id: refund.id } }));
    expect(unchanged.amount.toNumber()).toBe(1_000_000);
  });

  it('cmc_app cannot DELETE a RefundRecord row', async () => {
    await expect(testDb().refundRecord.delete({ where: { id: refund.id } })).rejects.toThrow();

    const stillExists = await testDbBypass((tx) => tx.refundRecord.findUnique({ where: { id: refund.id } }));
    expect(stillExists).not.toBeNull();
  });

  it('cmc_app cannot UPDATE an AuditLog row', async () => {
    const audit = await testDb().auditLog.create({
      data: { actor: 'test-k5', action: 'test.k5.audit', entity: 'Test', entityId: 'k5-1' },
    });

    await expect(
      testDb().auditLog.update({ where: { id: audit.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow();

    const unchanged = await testDb().auditLog.findUniqueOrThrow({ where: { id: audit.id } });
    expect(unchanged.action).toBe('test.k5.audit');
  });

  it('cmc_app cannot DELETE an AuditLog row', async () => {
    const audit = await testDb().auditLog.create({
      data: { actor: 'test-k5', action: 'test.k5.audit.delete', entity: 'Test', entityId: 'k5-2' },
    });

    await expect(testDb().auditLog.delete({ where: { id: audit.id } })).rejects.toThrow();

    const stillExists = await testDb().auditLog.findUnique({ where: { id: audit.id } });
    expect(stillExists).not.toBeNull();
  });

  it('cmc_app can still INSERT/SELECT RefundRecord and AuditLog (privilege trim did not over-restrict)', async () => {
    // RefundRecord is RLS-protected (unlike AuditLog) — read it the same way
    // every other facility-scoped assertion in this suite does, via the
    // bypass GUC, so this only exercises the GRANT/REVOKE privilege, not RLS
    // row-visibility scoping (a separate concern already covered by
    // ../security/rls-enforcement.test.ts).
    const rows = await testDbBypass((tx) => tx.refundRecord.findMany({ where: { id: refund.id } }));
    expect(rows).toHaveLength(1);

    const audit = await testDb().auditLog.create({
      data: { actor: 'test-k5', action: 'test.k5.audit.insert', entity: 'Test', entityId: 'k5-3' },
    });
    expect(audit.id).toEqual(expect.any(String));
  });
});

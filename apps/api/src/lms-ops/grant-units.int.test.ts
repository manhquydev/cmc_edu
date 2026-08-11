// Plan 3: grantUnitsFromReceipt + package range resolution.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  createTestFacility,
  seedClassBatch,
  seedCurriculumUnit,
  testDbBypass,
} from '../test/db.js';
import { provisionFromReceipt } from '../provisioning/provision-from-receipt.js';
import { grantUnitsFromReceipt } from './grant-units.js';
import { testDb } from '../test/db.js';
import { normalizeLoginPhone } from '@cmc/domain-identity';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('grantUnitsFromReceipt (Plan 3 money bridge)', () => {
  let facility: { id: string };
  let gdkd: Caller;
  let unitIds: string[] = [];
  let classBatchId: string;

  beforeEach(async () => {
    facility = await createTestFacility('Money Bridge Facility');
    gdkd = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gdkd-mb-1',
        roles: ['giam_doc_kinh_doanh'],
      }),
    );
    const u1 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 301, title: 'M1' });
    const u2 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 302, title: 'M2' });
    const u3 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 303, title: 'M3' });
    const u4 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 304, title: 'M4' });
    unitIds = [u1.id, u2.id, u3.id, u4.id];

    const batch = await seedClassBatch({ facilityId: facility.id });
    classBatchId = batch.id;
    await testDbBypass((tx) =>
      tx.classBatch.update({
        where: { id: batch.id },
        data: { startUnitId: u1.id, currentUnitId: u1.id, currentUnitAnchor: new Date('2026-09-01') },
      }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...unitIds);
    unitIds = [];
  });

  async function approvedReceipt(opts: {
    phone: string;
    studentName: string;
    unitCount?: number | null;
  }) {
    return testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-MB-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 5_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone: opts.phone,
          studentName: opts.studentName,
          classBatchId,
          unitCount: opts.unitCount === undefined ? 4 : opts.unitCount,
          createdById: 'sale-mb',
        },
      }),
    );
  }

  it('provision grants continuous units from class current neo', async () => {
    const receipt = await approvedReceipt({
      phone: '0961000001',
      studentName: 'Grant Kid',
      unitCount: 4,
    });

    const result = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone: receipt.parentPhone,
      studentName: receipt.studentName,
      classBatchId,
      unitCount: 4,
    });

    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({
        where: { enrollmentId: result.enrollmentId },
        select: { fromOrderGlobal: true, toOrderGlobal: true, sourceReceiptId: true },
      }),
    );
    expect(ranges).toEqual([
      { fromOrderGlobal: 301, toOrderGlobal: 304, sourceReceiptId: receipt.id },
    ]);
  });

  it('is idempotent on provision replay (sourceReceiptId)', async () => {
    const receipt = await approvedReceipt({
      phone: '0961000002',
      studentName: 'Replay Kid',
      unitCount: 2,
    });
    const input = {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone: receipt.parentPhone,
      studentName: receipt.studentName,
      classBatchId,
      unitCount: 2 as number | null,
    };
    const first = await provisionFromReceipt(testDb(), input);
    const second = await provisionFromReceipt(testDb(), input);
    expect(first.enrollmentId).toBe(second.enrollmentId);

    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({ where: { enrollmentId: first.enrollmentId } }),
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.toOrderGlobal - ranges[0]!.fromOrderGlobal + 1).toBe(2);
  });

  it('unitCount 0 is break-glass: active enrollment, no ranges', async () => {
    const receipt = await approvedReceipt({
      phone: '0961000003',
      studentName: 'Breakglass Kid',
      unitCount: 0,
    });
    const result = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone: receipt.parentPhone,
      studentName: receipt.studentName,
      classBatchId,
      unitCount: 0,
    });

    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findUniqueOrThrow({ where: { id: result.enrollmentId } }),
    );
    expect(enrollment.status).toBe('active');

    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({ where: { enrollmentId: result.enrollmentId } }),
    );
    expect(ranges).toHaveLength(0);

    // Not on dual-gate roster for stamped session unit
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId,
          sessionDate: new Date('2026-09-07'),
          startTime: new Date('2026-09-07T11:00:00.000Z'),
          endTime: new Date('2026-09-07T12:30:00.000Z'),
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );
    const gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gddt-mb-1',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    const roster = await gddt.lmsOps.rosterForSession({ classSessionId: session.id });
    expect(roster.students.map((s) => s.studentId)).not.toContain(result.studentId);
  });

  it('renewal receipt extends after previous range', async () => {
    const r1 = await approvedReceipt({ phone: '0961000004', studentName: 'Renew Kid', unitCount: 2 });
    const first = await provisionFromReceipt(testDb(), {
      id: r1.id,
      facilityId: facility.id,
      parentPhone: r1.parentPhone,
      studentName: r1.studentName,
      classBatchId,
      unitCount: 2,
    });

    const r2 = await approvedReceipt({ phone: '0961000004', studentName: 'Renew Kid', unitCount: 2 });
    const g2 = await grantUnitsFromReceipt(testDb(), {
      facilityId: facility.id,
      enrollmentId: first.enrollmentId,
      receiptId: r2.id,
      unitCount: 2,
    });
    expect(g2.status).toBe('granted');
    if (g2.status === 'granted') {
      expect(g2.range.fromOrderGlobal).toBe(303);
      expect(g2.range.toOrderGlobal).toBe(304);
    }
  });

  it('full refund deletes ranges sourced by that receipt', async () => {
    const receipt = await approvedReceipt({
      phone: '0961000005',
      studentName: 'Refund Kid',
      unitCount: 2,
    });
    // Approve via money path so refundCreate works with real finance caller
    // Raw approved already — use provision then refundCreate
    const provisioned = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone: receipt.parentPhone,
      studentName: receipt.studentName,
      classBatchId,
      unitCount: 2,
    });

    await gdkd.finance.refundCreate({
      receiptId: receipt.id,
      amount: 5_000_000,
    });

    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({ where: { enrollmentId: provisioned.enrollmentId } }),
    );
    expect(ranges).toHaveLength(0);

    // Parent account still exists
    const parent = await testDb().parentAccount.findUnique({
      where: { phone: normalizeLoginPhone('0961000005') },
    });
    expect(parent).not.toBeNull();
  });
});

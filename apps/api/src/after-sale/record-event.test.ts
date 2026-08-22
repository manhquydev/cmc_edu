import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  testDbBypass,
} from '../test/db.js';
import {
  AFTER_SALE_RECORD_EVENT_KINDS,
  AFTER_SALE_RECORD_EVENT_LABELS,
  isAfterSaleRecordEventKind,
  labelForAfterSaleRecordEventKind,
} from './record-event.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('afterSale record-event labels (pure)', () => {
  it('maps every closed kind and falls back for unknown kinds', () => {
    for (const kind of AFTER_SALE_RECORD_EVENT_KINDS) {
      expect(isAfterSaleRecordEventKind(kind)).toBe(true);
      expect(labelForAfterSaleRecordEventKind(kind)).toBe(AFTER_SALE_RECORD_EVENT_LABELS[kind]);
    }
    expect(isAfterSaleRecordEventKind('note')).toBe(false);
    expect(labelForAfterSaleRecordEventKind('mystery')).toBe('Sự kiện không đọc được');
  });
});

describe('afterSale RecordEvent timeline', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let saleB: Caller;
  let studentId: string;

  beforeEach(async () => {
    facilityA = await createTestFacility('AfterSaleTimeline-A');
    facilityB = await createTestFacility('AfterSaleTimeline-B');
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-as-tl-a', roles: ['sale'] }),
    );
    saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'sale-as-tl-b', roles: ['sale'] }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facilityA.id, fullName: 'Timeline Student' } }),
    );
    studentId = student.id;
  });

  afterEach(async () => {
    if (facilityA) await cleanupFacility(facilityA.id);
    if (facilityB) await cleanupFacility(facilityB.id);
  });

  it('emits created then status_changed through the lifecycle', async () => {
    const created = await saleA.afterSale.create({ studentId, description: 'Need follow-up' });
    const page0 = await saleA.afterSale.timeline({ caseId: created.id });
    expect(page0.items.map((item) => item.kind)).toEqual(['created']);
    expect(page0.items[0]?.payload).toEqual({ studentId, priority: 'normal' });

    await saleA.afterSale.advance({ caseId: created.id });
    await saleA.afterSale.resolve({ caseId: created.id, resolution: 'Called parent' });
    await saleA.afterSale.close({ caseId: created.id });
    const page = await saleA.afterSale.timeline({ caseId: created.id });
    expect(page.items.map((item) => item.kind)).toEqual([
      'status_changed',
      'status_changed',
      'status_changed',
      'created',
    ]);
    expect(page.items[0]?.payload).toEqual({ from: 'resolved', to: 'closed' });
    expect(page.historySince).toBeNull();
  });

  it('does not emit on idempotent advance', async () => {
    const created = await saleA.afterSale.create({ studentId, description: 'Idempotent' });
    await saleA.afterSale.advance({ caseId: created.id });
    await saleA.afterSale.advance({ caseId: created.id });
    const page = await saleA.afterSale.timeline({ caseId: created.id });
    expect(page.items.filter((item) => item.kind === 'status_changed')).toHaveLength(1);
  });

  it('rejects cross-facility timeline reads with NOT_FOUND', async () => {
    const created = await saleA.afterSale.create({ studentId, description: 'RLS' });
    await expect(saleB.afterSale.timeline({ caseId: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('unknown kind renders fallback label and omits raw payload', async () => {
    const created = await saleA.afterSale.create({ studentId, description: 'Unknown kind' });
    await testDbBypass(async (tx) => {
      await tx.recordEvent.create({
        data: {
          facilityId: facilityA.id,
          entity: 'AfterSaleCase',
          entityId: created.id,
          kind: 'mystery_future',
          actor: 'sale-as-tl-a',
          payload: { secret: 'nope' },
        },
      });
    });
    const page = await saleA.afterSale.timeline({ caseId: created.id });
    const unknown = page.items.find((item) => item.kind === 'mystery_future');
    expect(unknown?.label).toBe('Sự kiện không đọc được');
    expect(unknown?.payload).toBeNull();
  });
});

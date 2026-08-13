import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFacility } from '@cmc/db';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDb,
  testDbBypass,
} from '../test/db.js';
import {
  assertRecordEventKindExhaustive,
  financePayloadLeaksMoney,
  labelForRecordEventKind,
  RECORD_EVENT_HISTORY_SINCE,
  RECORD_EVENT_KINDS,
  UNKNOWN_RECORD_EVENT_LABEL,
} from './record-event.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('record-event labels + finance payload allowlist (pure)', () => {
  it('maps every closed kind and falls back for unknown kinds', () => {
    for (const kind of RECORD_EVENT_KINDS) {
      assertRecordEventKindExhaustive(kind);
      expect(labelForRecordEventKind(kind).length).toBeGreaterThan(0);
      expect(labelForRecordEventKind(kind)).not.toBe(UNKNOWN_RECORD_EVENT_LABEL);
    }
    expect(labelForRecordEventKind('not_a_real_kind')).toBe(UNKNOWN_RECORD_EVENT_LABEL);
  });

  it('rejects finance payloads that leak amount / receipt / approver', () => {
    expect(financePayloadLeaksMoney(null)).toBe(false);
    expect(financePayloadLeaksMoney({})).toBe(false);
    expect(financePayloadLeaksMoney({ netAmount: 5_000_000 })).toBe(true);
    expect(financePayloadLeaksMoney({ amount: 1 })).toBe(true);
    expect(financePayloadLeaksMoney({ receiptId: 'r1' })).toBe(true);
    expect(financePayloadLeaksMoney({ receiptCode: 'PT-1' })).toBe(true);
    expect(financePayloadLeaksMoney({ approver: 'gdkd' })).toBe(true);
    expect(financePayloadLeaksMoney({ approverId: 'u1' })).toBe(true);
  });
});

describe('crm RecordEvent timeline (Con A)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let saleB: Caller;
  let manager: Caller;
  let phoneSeq = 0;

  beforeEach(async () => {
    facilityA = await createTestFacility('RecordEvent Facility A');
    facilityB = await createTestFacility('RecordEvent Facility B');
    await seedAppUser({ facilityId: facilityA.id, userId: 'sale-re-a', roles: ['sale'] });
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-re-a', roles: ['sale'] }),
    );
    saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'sale-re-b', roles: ['sale'] }),
    );
    manager = appRouter.createCaller(
      buildStaffContext({
        facilityId: facilityA.id,
        userId: 'gdkd-re-a',
        roles: ['giam_doc_kinh_doanh'],
      }),
    );
    phoneSeq = 0;
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  function nextPhone(): string {
    phoneSeq += 1;
    return `0971${String(phoneSeq).padStart(6, '0')}`;
  }

  async function kindsOf(caller: Caller, opportunityId: string): Promise<string[]> {
    const page = await caller.crm.opportunityTimeline({ opportunityId, take: 100 });
    return page.items.map((item) => item.kind);
  }

  it('emits created on opportunityCreate', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Create',
      phone: nextPhone(),
    });
    const page = await saleA.crm.opportunityTimeline({ opportunityId: opp.id });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.kind).toBe('created');
    expect(page.items[0]?.actor).toBe('sale-re-a');
    expect(page.items[0]?.label).toBe(labelForRecordEventKind('created'));
    expect(page.nextCursor).toBeNull();
    expect(page.historySince).toBeNull();
  });

  it('emits stage_advanced on opportunityAdvance', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Advance',
      phone: nextPhone(),
    });
    await saleA.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    expect(await kindsOf(saleA, opp.id)).toEqual(['stage_advanced', 'created']);
  });

  it('emits marked_lost and reopened', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Lost',
      phone: nextPhone(),
    });
    await saleA.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'no_response' });
    expect(await kindsOf(saleA, opp.id)).toContain('marked_lost');
    await saleA.crm.opportunityMarkLost({ opportunityId: opp.id, reopen: true });
    expect(await kindsOf(saleA, opp.id)).toEqual(['reopened', 'marked_lost', 'created']);
  });

  it('emits assigned', async () => {
    const opp = await manager.crm.opportunityCreate({
      contactName: 'Lead Assign',
      phone: nextPhone(),
    });
    await manager.crm.opportunityAssign({
      opportunityId: opp.id,
      assigneeUserId: 'sale-re-a',
    });
    expect(await kindsOf(manager, opp.id)).toContain('assigned');
  });

  it('emits next_action_set and next_action_cleared', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Next',
      phone: nextPhone(),
    });
    const due = new Date(Date.now() + 86_400_000).toISOString();
    await saleA.crm.opportunitySetNextAction({
      opportunityId: opp.id,
      nextActionAt: due,
      nextActionNote: 'Gọi lại',
    });
    expect(await kindsOf(saleA, opp.id)).toContain('next_action_set');
    await saleA.crm.opportunityClearNextAction({ opportunityId: opp.id });
    expect(await kindsOf(saleA, opp.id)).toEqual([
      'next_action_cleared',
      'next_action_set',
      'created',
    ]);
  });

  it('rejects cross-facility timeline reads with NOT_FOUND', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead RLS',
      phone: nextPhone(),
    });
    await expect(
      saleB.crm.opportunityTimeline({ opportunityId: opp.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      saleB.crm.opportunityAddNote({ opportunityId: opp.id, body: 'nope' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('addNote then timeline contains note; no update/delete procedures', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Note',
      phone: nextPhone(),
    });
    await saleA.crm.opportunityAddNote({ opportunityId: opp.id, body: 'Gọi PH chiều nay' });
    const page = await saleA.crm.opportunityTimeline({ opportunityId: opp.id });
    expect(page.items[0]?.kind).toBe('note');
    expect(page.items[0]?.payload).toEqual({ body: 'Gọi PH chiều nay' });
    expect(page.items[0]?.actor).toBe('sale-re-a');
    expect(saleA.crm).not.toHaveProperty('opportunityUpdateNote');
    expect(saleA.crm).not.toHaveProperty('opportunityDeleteNote');
    expect(saleA.crm).not.toHaveProperty('opportunityTimelineUpdate');
  });

  it('hardcodes entity Opportunity and ignores a confused-deputy entity field', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Entity',
      phone: nextPhone(),
    });
    const page = await saleA.crm.opportunityTimeline({
      opportunityId: opp.id,
      entity: 'Receipt',
    } as never);
    expect(page.items.every((item) => item.kind === 'created' || item.kind === 'note')).toBe(true);
    expect(page.items).toHaveLength(1);
  });

  it('unknown kind renders fallback label and omits raw payload', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Unknown',
      phone: nextPhone(),
    });
    await testDbBypass(async (tx) => {
      await tx.recordEvent.create({
        data: {
          facilityId: facilityA.id,
          entity: 'Opportunity',
          entityId: opp.id,
          kind: 'not_a_real_kind',
          actor: 'sale-re-a',
          payload: { secret: 'do-not-leak', netAmount: 1 },
        },
      });
    });
    const page = await saleA.crm.opportunityTimeline({ opportunityId: opp.id });
    const unknown = page.items.find((item) => item.kind === 'not_a_real_kind');
    expect(unknown?.label).toBe(UNKNOWN_RECORD_EVENT_LABEL);
    expect(unknown?.payload).toBeNull();
  });

  it('keyset pagination returns a nextCursor and the next page', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Pages',
      phone: nextPhone(),
    });
    await saleA.crm.opportunityAddNote({ opportunityId: opp.id, body: 'one' });
    await saleA.crm.opportunityAddNote({ opportunityId: opp.id, body: 'two' });
    const first = await saleA.crm.opportunityTimeline({ opportunityId: opp.id, take: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await saleA.crm.opportunityTimeline({
      opportunityId: opp.id,
      take: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(first.items.map((i) => i.id));
    expect(second.items.every((item) => !ids.has(item.id))).toBe(true);
  });

  it('returns a fixed historySince when the opportunity has no created event', async () => {
    const opportunityId = await testDbBypass(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          facilityId: facilityA.id,
          name: 'Lead Epoch',
          phone: nextPhone(),
        },
      });
      const opportunity = await tx.opportunity.create({
        data: {
          facilityId: facilityA.id,
          contactId: contact.id,
          stage: 'O1_LEAD',
        },
      });
      return opportunity.id;
    });
    await saleA.crm.opportunityAddNote({ opportunityId, body: 'ghi sau migration' });
    const page = await saleA.crm.opportunityTimeline({ opportunityId, take: 1 });
    expect(page.items.some((item) => item.kind === 'created')).toBe(false);
    expect(page.historySince).toEqual(RECORD_EVENT_HISTORY_SINCE);
  });

  it('rejects update/delete of RecordEvent via the cmc_app client', async () => {
    const opp = await saleA.crm.opportunityCreate({
      contactName: 'Lead Immutable',
      phone: nextPhone(),
    });
    const page = await saleA.crm.opportunityTimeline({ opportunityId: opp.id });
    const eventId = page.items[0]?.id;
    expect(eventId).toBeTruthy();

    await expect(
      withFacility(testDb(), facilityA.id, (tx) =>
        tx.recordEvent.update({ where: { id: eventId! }, data: { actor: 'tampered' } }),
      ),
    ).rejects.toThrow();

    await expect(
      withFacility(testDb(), facilityA.id, (tx) =>
        tx.recordEvent.delete({ where: { id: eventId! } }),
      ),
    ).rejects.toThrow();
  });
});

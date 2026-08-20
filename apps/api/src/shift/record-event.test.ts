import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';
import {
  SHIFT_RECORD_EVENT_KINDS,
  SHIFT_RECORD_EVENT_LABELS,
  isShiftRecordEventKind,
  labelForShiftRecordEventKind,
} from './record-event.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('shift record-event labels (pure)', () => {
  it('maps every closed kind and falls back for unknown kinds', () => {
    for (const kind of SHIFT_RECORD_EVENT_KINDS) {
      expect(isShiftRecordEventKind(kind)).toBe(true);
      expect(labelForShiftRecordEventKind(kind)).toBe(SHIFT_RECORD_EVENT_LABELS[kind]);
    }
    expect(isShiftRecordEventKind('created')).toBe(false);
    expect(labelForShiftRecordEventKind('mystery')).toBe('Sự kiện không đọc được');
  });
});

describe('shift RecordEvent timeline', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let employee: Caller;
  let director: Caller;
  let otherFacility: Caller;
  let shiftGroupId: string;
  let shiftTemplateId: string;

  const EMPLOYEE_USER_ID = 'shift-tl-employee';
  const DIRECTOR_USER_ID = 'shift-tl-director';
  const FUTURE_DATE = '2099-03-15';

  beforeEach(async () => {
    facilityA = await createTestFacility('ShiftTimeline-A');
    facilityB = await createTestFacility('ShiftTimeline-B');
    await seedAppUser({
      facilityId: facilityA.id,
      userId: EMPLOYEE_USER_ID,
      fullName: 'GV Timeline',
      roles: ['giao_vien'],
    });
    await seedAppUser({
      facilityId: facilityA.id,
      userId: DIRECTOR_USER_ID,
      fullName: 'GĐĐT Timeline',
      roles: ['giam_doc_dao_tao'],
    });
    employee = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: EMPLOYEE_USER_ID, roles: ['giao_vien'] }),
    );
    director = appRouter.createCaller(
      buildStaffContext({
        facilityId: facilityA.id,
        userId: DIRECTOR_USER_ID,
        roles: ['giam_doc_dao_tao'],
      }),
    );
    otherFacility = appRouter.createCaller(
      buildStaffContext({
        facilityId: facilityB.id,
        userId: 'shift-tl-other',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    const group = await testDbBypass((tx) =>
      tx.shiftGroup.create({
        data: {
          facilityId: facilityA.id,
          name: 'Ca GV TL',
          type: 'GIAO_VIEN',
          selectionMode: 'SINGLE',
        },
      }),
    );
    shiftGroupId = group.id;
    const template = await testDbBypass((tx) =>
      tx.shiftTemplate.create({
        data: {
          facilityId: facilityA.id,
          shiftGroupId,
          name: 'Ca Sáng',
          startTime: '09:00',
          endTime: '17:00',
        },
      }),
    );
    shiftTemplateId = template.id;
  });

  afterEach(async () => {
    if (facilityA) await cleanupFacility(facilityA.id);
    if (facilityB) await cleanupFacility(facilityB.id);
  });

  it('emits submitted then approved', async () => {
    const registration = await employee.shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });
    const page0 = await employee.shift.timeline({ registrationId: registration.id });
    expect(page0.items.map((item) => item.kind)).toEqual(['submitted']);
    expect(page0.items[0]?.payload).toEqual({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
    });

    await director.shift.approve({ registrationId: registration.id });
    const page = await director.shift.timeline({ registrationId: registration.id });
    expect(page.items.map((item) => item.kind)).toEqual(['approved', 'submitted']);
    expect(page.historySince).toBeNull();
  });

  it('rejects cross-facility timeline reads with NOT_FOUND', async () => {
    const registration = await employee.shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });
    await expect(
      otherFacility.shift.timeline({ registrationId: registration.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('unknown kind renders fallback label and omits raw payload', async () => {
    const registration = await employee.shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });
    await testDbBypass(async (tx) => {
      await tx.recordEvent.create({
        data: {
          facilityId: facilityA.id,
          entity: 'ShiftRegistration',
          entityId: registration.id,
          kind: 'mystery_future',
          actor: EMPLOYEE_USER_ID,
          payload: { token: 'nope' },
        },
      });
    });
    const page = await employee.shift.timeline({ registrationId: registration.id });
    const unknown = page.items.find((item) => item.kind === 'mystery_future');
    expect(unknown?.label).toBe('Sự kiện không đọc được');
    expect(unknown?.payload).toBeNull();
  });
});

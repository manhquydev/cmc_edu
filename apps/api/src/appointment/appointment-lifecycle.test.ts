// testAppointment lifecycle — redesigned in phase-07 (F5). Entrance tests
// attach to an OPPORTUNITY (pre-payment) and drive its stage O2→O3 (schedule)
// and O3→O4 (complete); periodic tests attach to a Student and never touch CRM.
// The old "entrance never mutates CRM" invariant is intentionally replaced.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, testDbBypass } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('testAppointment entrance↔opportunity + periodic↔student (phase-07)', () => {
  let facility: { id: string };
  let sale: Caller;
  let teacher: Caller;
  let phoneSeq = 0;

  beforeEach(async () => {
    facility = await createTestFacility('Appointment Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-appt-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-appt-1', roles: ['giao_vien'] }),
    );
    phoneSeq = 0;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  /** Creates an opportunity and advances it to `stage` (O1..O4). */
  async function oppAt(stage: 'O1_LEAD' | 'O2_CONTACTED' | 'O3_TEST_SCHEDULED' | 'O4_TESTED') {
    phoneSeq += 1;
    const opp = await sale.crm.opportunityCreate({
      contactName: `Appt Lead ${phoneSeq}`,
      phone: `09610000${String(phoneSeq).padStart(2, '0')}`,
    });
    const path = ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const;
    const target = path.indexOf(stage as (typeof path)[number]);
    for (let i = 0; i <= target; i += 1) {
      await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: path[i] });
    }
    return opp;
  }

  async function stageOf(opportunityId: string) {
    const opp = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }));
    return opp.stage;
  }

  it('entrance schedule on an O2 opp creates the appointment and advances the opp O2 → O3', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-01T09:00:00.000Z',
    });
    expect(appt.type).toBe('entrance');
    expect(appt.opportunityId).toBe(opp.id);
    expect(appt.studentId).toBeNull();
    expect(await stageOf(opp.id)).toBe('O3_TEST_SCHEDULED');

    const scheduledEvents = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { entityId: opp.id, kind: 'stage_advanced' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(scheduledEvents[0]?.payload).toEqual({
      fromStage: 'O2_CONTACTED',
      toStage: 'O3_TEST_SCHEDULED',
    });
  });

  it('entrance complete advances the opp O3 → O4', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-01T09:00:00.000Z',
    });
    expect(await stageOf(opp.id)).toBe('O3_TEST_SCHEDULED');

    const done = await sale.testAppointment.complete({ appointmentId: appt.id, notes: 'Passed.' });
    expect(done.status).toBe('done');
    expect(await stageOf(opp.id)).toBe('O4_TESTED');

    const advanced = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { entityId: opp.id, kind: 'stage_advanced' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(advanced[0]?.payload).toEqual({
      fromStage: 'O3_TEST_SCHEDULED',
      toStage: 'O4_TESTED',
    });
  });

  it('a never-enrolled lead can be scheduled, tested, and reach O4 purely via the appointment lifecycle', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-02T09:00:00.000Z',
    });
    await sale.testAppointment.complete({ appointmentId: appt.id });
    expect(await stageOf(opp.id)).toBe('O4_TESTED');
  });

  it('scheduling a SECOND entrance test on an already-O3 opp is a no-op advance (stays O3)', async () => {
    const opp = await oppAt('O3_TEST_SCHEDULED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-14T09:00:00.000Z',
    });
    expect(appt.opportunityId).toBe(opp.id);
    expect(await stageOf(opp.id)).toBe('O3_TEST_SCHEDULED'); // not double-advanced to O4
  });

  it('completing an entrance test still succeeds when the opp is past O3 (already O4) — sync is skipped, not fatal', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-15T09:00:00.000Z',
    }); // opp now O3
    // Advance the opp to O4 out of band before completing the appointment.
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });

    const done = await sale.testAppointment.complete({ appointmentId: appt.id });
    expect(done.status).toBe('done'); // completion not blocked by the skipped sync
    expect(await stageOf(opp.id)).toBe('O4_TESTED'); // unchanged
  });

  it('completing an entrance test still succeeds when the opp was marked LOST after scheduling', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-16T09:00:00.000Z',
    }); // opp now O3
    await sale.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'schedule_conflict' });

    const done = await sale.testAppointment.complete({ appointmentId: appt.id });
    expect(done.status).toBe('done'); // lost opp does not block completing the appointment record
    const after = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }));
    expect(after.lostReason).toBe('schedule_conflict'); // sync skipped — lost opp untouched
  });

  it('entrance no_show does NOT change the opp stage', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-03T09:00:00.000Z',
    });
    expect(await stageOf(opp.id)).toBe('O3_TEST_SCHEDULED'); // advanced by schedule
    await sale.testAppointment.noShow({ appointmentId: appt.id });
    expect(await stageOf(opp.id)).toBe('O3_TEST_SCHEDULED'); // unchanged by no_show
  });

  it('rejects scheduling an entrance test on an O1 opp — sale must mark O2 first', async () => {
    const opp = await oppAt('O1_LEAD');
    await expect(
      sale.testAppointment.schedule({ type: 'entrance', opportunityId: opp.id, scheduledAt: '2026-08-04T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects scheduling an entrance test on an O4 opp (already tested/past)', async () => {
    const opp = await oppAt('O4_TESTED');
    await expect(
      sale.testAppointment.schedule({ type: 'entrance', opportunityId: opp.id, scheduledAt: '2026-08-05T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects scheduling an entrance test on a LOST opp', async () => {
    const opp = await oppAt('O2_CONTACTED');
    await sale.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'no_response' });
    await expect(
      sale.testAppointment.schedule({ type: 'entrance', opportunityId: opp.id, scheduledAt: '2026-08-06T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects an entrance schedule with no opportunityId (zod refinement)', async () => {
    await expect(
      sale.testAppointment.schedule({ type: 'entrance', scheduledAt: '2026-08-07T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('schedules a periodic test against a Student and marks it no_show (no CRM involvement)', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Periodic Student' } }),
    );
    const appt = await sale.testAppointment.schedule({
      type: 'periodic',
      studentId: student.id,
      scheduledAt: '2026-08-08T09:00:00.000Z',
    });
    expect(appt.type).toBe('periodic');
    expect(appt.studentId).toBe(student.id);
    expect(appt.opportunityId).toBeNull();

    const noShow = await sale.testAppointment.noShow({ appointmentId: appt.id });
    expect(noShow.status).toBe('no_show');
  });

  it('rejects a periodic test for a withdrawn student', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Withdrawn Student', lifecycle: 'withdrawn' } }),
    );
    await expect(
      sale.testAppointment.schedule({ type: 'periodic', studentId: student.id, scheduledAt: '2026-08-09T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a periodic schedule with no studentId (zod refinement)', async () => {
    await expect(
      sale.testAppointment.schedule({ type: 'periodic', scheduledAt: '2026-08-10T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects completing an appointment that is not scheduled (already done)', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-11T09:00:00.000Z',
    });
    await sale.testAppointment.complete({ appointmentId: appt.id });
    await expect(sale.testAppointment.complete({ appointmentId: appt.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('serializes concurrent complete/no-show transitions so only one terminal state wins', async () => {
    const opp = await oppAt('O2_CONTACTED');
    const appt = await sale.testAppointment.schedule({
      type: 'entrance',
      opportunityId: opp.id,
      scheduledAt: '2026-08-17T09:00:00.000Z',
    });

    const outcomes = await Promise.allSettled([
      sale.testAppointment.complete({ appointmentId: appt.id }),
      sale.testAppointment.noShow({ appointmentId: appt.id }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);

    const finalAppointment = await testDbBypass((tx) =>
      tx.testAppointment.findUniqueOrThrow({ where: { id: appt.id } }),
    );
    expect(['done', 'no_show']).toContain(finalAppointment.status);
    expect(await stageOf(opp.id)).toBe(
      finalAppointment.status === 'done' ? 'O4_TESTED' : 'O3_TEST_SCHEDULED',
    );
  });

  it('forbids a role without testAppointment.manage permission', async () => {
    const opp = await oppAt('O2_CONTACTED');
    await expect(
      teacher.testAppointment.schedule({ type: 'entrance', opportunityId: opp.id, scheduledAt: '2026-08-12T09:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects scheduling for an opportunity outside the caller facility (RLS)', async () => {
    const otherFacility = await createTestFacility('Appointment Facility B');
    const saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'sale-appt-b', roles: ['sale'] }),
    );
    const otherOpp = await saleB.crm.opportunityCreate({ contactName: 'Cross Fac', phone: '0962000099' });
    await saleB.crm.opportunityAdvance({ opportunityId: otherOpp.id, toStage: 'O2_CONTACTED' });
    try {
      await expect(
        sale.testAppointment.schedule({ type: 'entrance', opportunityId: otherOpp.id, scheduledAt: '2026-08-13T09:00:00.000Z' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });
});

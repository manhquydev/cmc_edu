// Assessment integration tests — T3 (US-018, docs/26 WF-P2-07, TL13, TL19 §6b).
//
// Covers: draftComment · confirm · discard · listForChild (LMS) ·
//         reportCard.getForChild (LMS). Key invariants tested:
//   - Draft assessments NEVER appear in LMS responses.
//   - PII (student fullName) must NOT appear in the LLM prompt.
//   - Parent without an approved Guardian link → FORBIDDEN on all LMS reads.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedAppUser,
  seedClassBatch,
  seedClassSession,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

/** Deletes QualitativeAssessment rows for a facility before cleanupFacility.
 * Must use testDbBypass: QualitativeAssessment has RLS enabled and the
 * `cmc_app` role needs the bypass GUC set to delete across a facility scope
 * from test teardown (not a simulated facility session). */
async function cleanupAssessments(facilityId: string): Promise<void> {
  await testDbBypass((tx) =>
    tx.qualitativeAssessment.deleteMany({ where: { facilityId } }),
  );
}

describe('assessment (T3 US-018)', () => {
  let facility: { id: string };
  let teacher: Caller;
  let gddt: Caller;
  let parent: { id: string; phone: string };
  let classBatch: { id: string };
  let enrollment: { id: string; studentId: string; classBatchId: string };

  beforeEach(async () => {
    facility = await createTestFacility('Assessment Facility');
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-assess-1', roles: ['giao_vien'] }),
    );
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-assess-1', roles: ['giam_doc_dao_tao'] }),
    );

    classBatch = await seedClassBatch({ facilityId: facility.id });
    // Teacher class-scoping remediation (2026-07-15): draftComment/confirm/
    // discard now scope-check via classSessionId → classBatchId when a
    // session is given — assign this teacher to the class.
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-assess-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacherAppUser.id } }),
    );

    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);

    enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      studentName: 'Nguyễn Văn An',
    });
  });

  afterEach(async () => {
    await cleanupAssessments(facility.id);
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(parent.phone);
  });

  // -------------------------------------------------------------------------
  // draftComment
  // -------------------------------------------------------------------------

  it('draftComment creates a draft assessment with status=draft, draftedBy=ai', async () => {
    const result = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    expect(result.status).toBe('draft');
    expect(result.draftedBy).toBe('ai');
    expect(result.studentId).toBe(enrollment.studentId);
    expect(result.period).toBe('2026-08');
    expect(result.content).toBeTruthy();
    expect(result.confirmedAt).toBeNull();
  });

  it('draftComment: GDDT can also draft (perm assessment.draft includes giam_doc_dao_tao)', async () => {
    const result = await gddt.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    expect(result.status).toBe('draft');
  });

  it('draftComment: student fullName does NOT appear in logged LLM prompt (PII gate, TL13 §5)', async () => {
    const loggedLines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      loggedLines.push(args.join(' '));
    });

    try {
      await teacher.assessment.draftComment({
        studentId: enrollment.studentId,
        period: '2026-08',
      });
    } finally {
      spy.mockRestore();
    }

    // The stub logs the full prompt — verify fullName 'Nguyễn Văn An' is absent.
    const promptLine = loggedLines.find((l) => l.includes('draftAssessment prompt'));
    expect(promptLine).toBeDefined();
    expect(promptLine).not.toContain('Nguyễn Văn An');
    // studentId (non-PII token) SHOULD be present so the audit trail is useful.
    expect(promptLine).toContain(enrollment.studentId);
  });

  it('draftComment: rejects input with neither classSessionId nor period', async () => {
    await expect(
      teacher.assessment.draftComment({ studentId: enrollment.studentId }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('draftComment: rejects unknown student', async () => {
    await expect(
      teacher.assessment.draftComment({ studentId: randomUUID(), period: '2026-08' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // -------------------------------------------------------------------------
  // confirm
  // -------------------------------------------------------------------------

  it('confirm flips status to confirmed, sets confirmedAt and content', async () => {
    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    const confirmed = await teacher.assessment.confirm({
      assessmentId: draft.id,
      content: 'Bé học tốt, chăm chú.',
    });

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.content).toBe('Bé học tốt, chăm chú.');
    expect(confirmed.confirmedAt).not.toBeNull();
    expect(confirmed.confirmedById).toBe('teacher-assess-1');
  });

  it('confirm: cannot confirm an already-confirmed assessment', async () => {
    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    await teacher.assessment.confirm({ assessmentId: draft.id, content: 'Tốt.' });

    await expect(
      teacher.assessment.confirm({ assessmentId: draft.id, content: 'Sửa lại.' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('confirm: two concurrent confirms on the same draft — exactly one wins (atomic updateMany, single-winner)', async () => {
    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    // A second caller holding `assessment.confirm` (giao_vien only) races the
    // first. The atomic claim (updateMany WHERE status='draft') must let
    // exactly one win; the loser gets BAD_REQUEST (either the pre-check or
    // the `count === 0` concurrency guard) rather than overwriting the
    // winner's confirmed content.
    const teacher2 = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-assess-2', roles: ['giao_vien'] }),
    );
    const results = await Promise.allSettled([
      teacher.assessment.confirm({ assessmentId: draft.id, content: 'Bản của GV1.' }),
      teacher2.assessment.confirm({ assessmentId: draft.id, content: 'Bản của GV2.' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('BAD_REQUEST');

    // The assessment is confirmed exactly once, with the winner's content.
    const final = await testDbBypass((tx) =>
      tx.qualitativeAssessment.findUniqueOrThrow({ where: { id: draft.id } }),
    );
    expect(final.status).toBe('confirmed');
    expect([`Bản của GV1.`, `Bản của GV2.`]).toContain(final.content);
  });

  // -------------------------------------------------------------------------
  // discard
  // -------------------------------------------------------------------------

  it('discard marks assessment as discarded', async () => {
    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    const discarded = await teacher.assessment.discard({ assessmentId: draft.id });
    expect(discarded.status).toBe('discarded');
  });

  it('discard: cannot discard a non-draft assessment', async () => {
    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    await teacher.assessment.confirm({ assessmentId: draft.id, content: 'Tốt.' });

    await expect(
      teacher.assessment.discard({ assessmentId: draft.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // -------------------------------------------------------------------------
  // listBySession — staff read (HR remediation phase 5, R2 #C4)
  // -------------------------------------------------------------------------

  it('listBySession returns draft and confirmed assessments for the session, not discarded ones', async () => {
    const session = await seedClassSession({ facilityId: facility.id, classBatchId: classBatch.id });

    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      classSessionId: session.id,
    });

    const other = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      studentName: 'Học sinh khác',
    });
    const toConfirm = await teacher.assessment.draftComment({
      studentId: other.studentId,
      classSessionId: session.id,
    });
    await teacher.assessment.confirm({ assessmentId: toConfirm.id, content: 'Rất tốt.' });

    const toDiscard = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      classSessionId: session.id,
      period: '2026-08',
    });
    await teacher.assessment.discard({ assessmentId: toDiscard.id });

    const { items } = await teacher.assessment.listBySession({ classSessionId: session.id });
    const ids = items.map((i) => i.id);
    expect(ids).toContain(draft.id);
    expect(ids).toContain(toConfirm.id);
    expect(ids).not.toContain(toDiscard.id);
  });

  it('listBySession: role without assessment.draft permission is FORBIDDEN', async () => {
    const session = await seedClassSession({ facilityId: facility.id, classBatchId: classBatch.id });
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-assess-1', roles: ['sale'] }),
    );
    await expect(
      sale.assessment.listBySession({ classSessionId: session.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // -------------------------------------------------------------------------
  // listForChild (LMS) — draft must NEVER appear
  // -------------------------------------------------------------------------

  it('listForChild: returns ONLY confirmed assessments (draft not returned)', async () => {
    const lmsParent = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id }),
    );

    // Create a draft and a confirmed assessment.
    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    const confirmed = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    await teacher.assessment.confirm({ assessmentId: confirmed.id, content: 'Bé chăm học.' });

    const { items } = await lmsParent.assessment.listForChild({
      studentId: enrollment.studentId,
    });

    const ids = items.map((i) => i.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).toContain(confirmed.id);
    // Confirm no draft leaks regardless of field values.
    for (const item of items) {
      expect(item).not.toHaveProperty('status');
      expect(item).not.toHaveProperty('draftedBy');
    }
  });

  it('listForChild: period filter returns only matching period', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    const aug = await teacher.assessment.draftComment({ studentId: enrollment.studentId, period: '2026-08' });
    const sep = await teacher.assessment.draftComment({ studentId: enrollment.studentId, period: '2026-09' });
    await teacher.assessment.confirm({ assessmentId: aug.id, content: 'Tháng 8.' });
    await teacher.assessment.confirm({ assessmentId: sep.id, content: 'Tháng 9.' });

    const { items } = await lmsParent.assessment.listForChild({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    expect(items.map((i) => i.id)).toContain(aug.id);
    expect(items.map((i) => i.id)).not.toContain(sep.id);
  });

  it('listForChild: parent without Guardian link → FORBIDDEN', async () => {
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const otherParent = await seedParentAccount(otherPhone);
    const stranger = appRouter.createCaller(buildLmsContext({ parentAccountId: otherParent.id }));

    await expect(
      stranger.assessment.listForChild({ studentId: enrollment.studentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await testDb().parentAccount.deleteMany({ where: { phone: otherPhone } });
  });

  // -------------------------------------------------------------------------
  // reportCard.getForChild (LMS)
  // -------------------------------------------------------------------------

  it('reportCard.getForChild returns correct period aggregation', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    const draft = await teacher.assessment.draftComment({
      studentId: enrollment.studentId,
      period: '2026-08',
    });
    await teacher.assessment.confirm({ assessmentId: draft.id, content: 'Bé học rất tốt.' });

    const report = await lmsParent.reportCard.getForChild({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    expect(report.period).toBe('2026-08');
    expect(report.assessments).toHaveLength(1);
    expect(report.assessments[0]!.content).toBe('Bé học rất tốt.');
    expect(report.attendanceRate).toBeGreaterThanOrEqual(0);
    expect(report.attendanceRate).toBeLessThanOrEqual(1);
    // No FinalGrade seeded — should be null.
    expect(report.finalGrade).toBeNull();
  });

  it('reportCard.getForChild: draft assessments are NEVER returned', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    // Only create a draft — do NOT confirm it.
    await teacher.assessment.draftComment({ studentId: enrollment.studentId, period: '2026-08' });

    const report = await lmsParent.reportCard.getForChild({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    expect(report.assessments).toHaveLength(0);
  });

  it('reportCard.getForChild: includes attendanceRate computed from attendance rows', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    // Seed a ClassSession ending in 2026-08 ICT and mark attendance.
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-08-10T17:00:00.000Z'),
      startTime: new Date('2026-08-10T11:00:00.000Z'),
      endTime: new Date('2026-08-10T12:30:00.000Z'),
      status: 'confirmed',
    });

    // Mark attendance as present via staff caller.
    // attendance.mark takes { sessionId, enrollmentId, status }.
    await teacher.attendance.mark({
      sessionId: session.id,
      enrollmentId: enrollment.id,
      status: 'present',
    });

    const report = await lmsParent.reportCard.getForChild({
      studentId: enrollment.studentId,
      period: '2026-08',
    });

    // 1 session, 1 present → attendanceRate = 1.0.
    expect(report.attendanceRate).toBeCloseTo(1.0);
  });

  it('reportCard.getForChild: parent without Guardian link → FORBIDDEN', async () => {
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const otherParent = await seedParentAccount(otherPhone);
    const stranger = appRouter.createCaller(buildLmsContext({ parentAccountId: otherParent.id }));

    await expect(
      stranger.reportCard.getForChild({ studentId: enrollment.studentId, period: '2026-08' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await testDb().parentAccount.deleteMany({ where: { phone: otherPhone } });
  });
});

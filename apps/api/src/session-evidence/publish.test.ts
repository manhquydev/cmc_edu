// Session evidence + photo consent integration tests — T3 (US-019, WF-P2-08, C2).
//
// Covers: upsert · publish · listForChild (LMS) · guardian.setPhotoConsent.
// Key invariants tested:
//   - ONLY published evidence visible to parents.
//   - internalNote NEVER appears in LMS response (not null, not '', not present).
//   - Photos returned only when photoConsent=true AND revokedAt IS NULL.
//   - Parent without Guardian link → FORBIDDEN.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  seedClassSession,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

/** Cleanup for T3 tables before cleanupFacility (FK ordering: photos → evidence).
 * Uses testDbBypass: both tables have RLS enabled — `cmc_app` without the
 * facility GUC sees 0 rows, leaving stale rows that block ClassSession deletion. */
async function cleanupEvidenceTables(facilityId: string): Promise<void> {
  await testDbBypass(async (tx) => {
    await tx.sessionEvidencePhoto.deleteMany({ where: { facilityId } });
    await tx.sessionEvidence.deleteMany({ where: { facilityId } });
  });
}

describe('sessionEvidence (T3 US-019)', () => {
  let facility: { id: string };
  let teacher: Caller;
  let parent: { id: string; phone: string };
  let classBatch: { id: string };
  let enrollment: { id: string; studentId: string; classBatchId: string };
  let session: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('Evidence Facility');
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-evid-1', roles: ['giao_vien'] }),
    );

    classBatch = await seedClassBatch({ facilityId: facility.id });

    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);

    enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });

    session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-08-10T17:00:00.000Z'),
      startTime: new Date('2026-08-10T11:00:00.000Z'),
      endTime: new Date('2026-08-10T12:30:00.000Z'),
      status: 'confirmed',
    });
  });

  afterEach(async () => {
    await cleanupEvidenceTables(facility.id);
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(parent.phone);
  });

  // -------------------------------------------------------------------------
  // upsert
  // -------------------------------------------------------------------------

  it('upsert creates a new SessionEvidence record', async () => {
    const result = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Học sinh ôn tập chương 3.',
      internalNote: 'Cần nhắc nhở 2 em cuối lớp.',
    });

    expect(result.classSessionId).toBe(session.id);
    expect(result.summary).toBe('Học sinh ôn tập chương 3.');
    expect(result.internalNote).toBe('Cần nhắc nhở 2 em cuối lớp.');
    expect(result.status).toBe('draft');
    expect(result.publishedAt).toBeNull();
  });

  it('upsert updates an existing draft (idempotent on classSessionId)', async () => {
    await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Ban đầu.',
    });
    const updated = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Cập nhật.',
      internalNote: 'Ghi chú nội bộ mới.',
    });

    expect(updated.summary).toBe('Cập nhật.');
    expect(updated.internalNote).toBe('Ghi chú nội bộ mới.');
  });

  it('upsert: cannot update a published evidence record', async () => {
    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Tóm tắt.',
    });
    await teacher.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'photos/upsert-guard.jpg' });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    await expect(
      teacher.sessionEvidence.upsert({ classSessionId: session.id, summary: 'Sửa sau publish.' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // -------------------------------------------------------------------------
  // addPhoto
  // -------------------------------------------------------------------------

  it('addPhoto adds a photo to an evidence record', async () => {
    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Buổi học vui.',
    });
    const photo = await teacher.sessionEvidence.addPhoto({
      sessionEvidenceId: evidence.id,
      blobRef: 'photos/2026-08/class-img-001.jpg',
    });

    expect(photo.blobRef).toBe('photos/2026-08/class-img-001.jpg');
    expect(photo.id).toBeTruthy();
  });

  it('addPhoto: BAD_REQUEST when evidence is already published (immutable after publish)', async () => {
    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Buổi học đã kết thúc.',
    });
    await teacher.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'photos/pre-publish.jpg' });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    await expect(
      teacher.sessionEvidence.addPhoto({
        sessionEvidenceId: evidence.id,
        blobRef: 'photos/post-publish/illegal.jpg',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // -------------------------------------------------------------------------
  // publish
  // -------------------------------------------------------------------------

  it('publish sets status=published, publishedById, publishedAt', async () => {
    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Tóm tắt buổi học.',
    });
    await teacher.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'photos/publish-happy.jpg' });

    const published = await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
    expect(published.publishedById).toBe('teacher-evid-1');
  });

  it('publish: cannot publish twice', async () => {
    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Tóm tắt.',
    });
    await teacher.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'photos/publish-twice.jpg' });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    await expect(
      teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('publish: rejects publishing with 0 photos (HR remediation phase 7 — R2 #H5, was a dead end)', async () => {
    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Chưa có ảnh.',
    });

    await expect(
      teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // -------------------------------------------------------------------------
  // listForChild (LMS) — published only + internalNote invariant
  // -------------------------------------------------------------------------

  it('listForChild: returns ONLY published evidence', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    // Draft evidence — must NOT appear.
    await teacher.sessionEvidence.upsert({ classSessionId: session.id, summary: 'Nháp.' });

    const { items } = await lmsParent.sessionEvidence.listForChild({
      studentId: enrollment.studentId,
    });

    expect(items).toHaveLength(0);
  });

  it('listForChild: published evidence appears for student whose enrollment is in the batch', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Buổi học tuyệt vời.',
    });
    await teacher.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'photos/list-for-child.jpg' });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    const { items } = await lmsParent.sessionEvidence.listForChild({
      studentId: enrollment.studentId,
    });

    expect(items).toHaveLength(1);
    expect(items[0]!.classSessionId).toBe(session.id);
  });

  it('listForChild: internalNote is NEVER present in LMS response (field-level invariant)', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Tóm tắt cho PH.',
      internalNote: 'GHI CHÚ NỘI BỘ KHÔNG ĐƯỢC LỘ.',
    });
    await teacher.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'photos/internal-note-guard.jpg' });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    const { items } = await lmsParent.sessionEvidence.listForChild({
      studentId: enrollment.studentId,
    });

    expect(items).toHaveLength(1);
    const item = items[0]!;

    // The field must not exist at all — not null, not empty string, not present.
    expect(item).not.toHaveProperty('internalNote');

    // Belt-and-suspenders: verify the leaked value doesn't appear anywhere in
    // the serialized DTO regardless of key name.
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('GHI CHÚ NỘI BỘ KHÔNG ĐƯỢC LỘ');
    expect(serialized).not.toContain('internalNote');
  });

  it('listForChild: parent without Guardian link → FORBIDDEN', async () => {
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const otherParent = await seedParentAccount(otherPhone);
    const stranger = appRouter.createCaller(buildLmsContext({ parentAccountId: otherParent.id }));

    await expect(
      stranger.sessionEvidence.listForChild({ studentId: enrollment.studentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await testDb().parentAccount.deleteMany({ where: { phone: otherPhone } });
  });

  // -------------------------------------------------------------------------
  // Photo consent gate (C2, TL08 §7)
  // -------------------------------------------------------------------------

  it('listForChild: photos NOT returned when photoConsent=false (default)', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Buổi học có ảnh.',
    });
    await teacher.sessionEvidence.addPhoto({
      sessionEvidenceId: evidence.id,
      blobRef: 'photos/img001.jpg',
    });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    const { items } = await lmsParent.sessionEvidence.listForChild({
      studentId: enrollment.studentId,
    });

    expect(items).toHaveLength(1);
    // Default consent is false → no photos returned.
    expect(items[0]!.photos).toHaveLength(0);
  });

  it('listForChild: photos returned when photoConsent=true (active)', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    // Grant consent first.
    await lmsParent.guardian.setPhotoConsent({ studentId: enrollment.studentId, consent: true });

    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Buổi học có ảnh.',
    });
    await teacher.sessionEvidence.addPhoto({
      sessionEvidenceId: evidence.id,
      blobRef: 'photos/img002.jpg',
    });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    const { items } = await lmsParent.sessionEvidence.listForChild({
      studentId: enrollment.studentId,
    });

    expect(items).toHaveLength(1);
    expect(items[0]!.photos).toHaveLength(1);
    expect(items[0]!.photos[0]!.blobRef).toBe('photos/img002.jpg');
  });

  it('listForChild: photos hidden immediately on consent revocation', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    // Grant then revoke.
    await lmsParent.guardian.setPhotoConsent({ studentId: enrollment.studentId, consent: true });
    await lmsParent.guardian.setPhotoConsent({ studentId: enrollment.studentId, consent: false });

    const evidence = await teacher.sessionEvidence.upsert({
      classSessionId: session.id,
      summary: 'Buổi học có ảnh.',
    });
    await teacher.sessionEvidence.addPhoto({
      sessionEvidenceId: evidence.id,
      blobRef: 'photos/img003.jpg',
    });
    await teacher.sessionEvidence.publish({ sessionEvidenceId: evidence.id });

    const { items } = await lmsParent.sessionEvidence.listForChild({
      studentId: enrollment.studentId,
    });

    // After revocation photos must be hidden, same response shape but empty photos array.
    expect(items).toHaveLength(1);
    expect(items[0]!.photos).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // guardian.setPhotoConsent
  // -------------------------------------------------------------------------

  it('setPhotoConsent grants consent and sets photoConsentAt', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    const result = await lmsParent.guardian.setPhotoConsent({
      studentId: enrollment.studentId,
      consent: true,
    });

    expect(result.photoConsent).toBe(true);

    // Verify DB state.
    const guardian = await testDb().guardian.findUnique({
      where: { parentAccountId_studentId: { parentAccountId: parent.id, studentId: enrollment.studentId } },
    });
    expect(guardian?.photoConsent).toBe(true);
    expect(guardian?.photoConsentAt).not.toBeNull();
    expect(guardian?.photoConsentRevokedAt).toBeNull();
  });

  it('setPhotoConsent revokes consent and sets photoConsentRevokedAt', async () => {
    const lmsParent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));

    await lmsParent.guardian.setPhotoConsent({ studentId: enrollment.studentId, consent: true });
    const result = await lmsParent.guardian.setPhotoConsent({
      studentId: enrollment.studentId,
      consent: false,
    });

    expect(result.photoConsent).toBe(false);

    const guardian = await testDb().guardian.findUnique({
      where: { parentAccountId_studentId: { parentAccountId: parent.id, studentId: enrollment.studentId } },
    });
    expect(guardian?.photoConsent).toBe(false);
    expect(guardian?.photoConsentRevokedAt).not.toBeNull();
  });

  it('setPhotoConsent: parent without Guardian link → FORBIDDEN', async () => {
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const otherParent = await seedParentAccount(otherPhone);
    const stranger = appRouter.createCaller(buildLmsContext({ parentAccountId: otherParent.id }));

    await expect(
      stranger.guardian.setPhotoConsent({ studentId: enrollment.studentId, consent: true }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await testDb().parentAccount.deleteMany({ where: { phone: otherPhone } });
  });
});

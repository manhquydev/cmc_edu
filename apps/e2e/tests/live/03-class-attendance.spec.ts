// 03-class-attendance — REAL-ENVIRONMENT class + attendance (admin ERP).
//
// P2-01 + P2-02:
//   1. Course + ClassBatch have NO admin UI (PO-approved seed exception,
//      scout §6 / plan P5) → created over tRPC with the LIVE super-admin
//      session cookie (createLiveClass), with the giao_vien from
//      00-setup-roles assigned as teacher (assertTeacherOwnsClass gate).
//      The slot is pinned ~1h in the PAST so the teacher attendance window
//      (open 30min before start, 2h after end — enforced in production) is
//      always open when this spec reaches the attendance step.
//   2. The student from 02 (activated by receipt approval) must hold an
//      ACTIVE enrollment in the new class for the attendance gates — the
//      real money chain creates it: sale receiptCreate (with studentId,
//      H3 renewal reuse) → giam_doc_kinh_doanh receiptApprove, both via
//      tRPC with the real saved sessions (same mutations the UI drives).
//   3. giam_doc_dao_tao views the class through the real nav (Lớp học list,
//      found by the displayed class code).
//   4. giao_vien opens Điểm danh, picks class + session through the page's
//      own pickers, marks the student present and saves (P2-02).

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { createLiveClass, liveSuperAdminClient, liveStaffRoleClient } from '../../src/live/live-trcp.js';
import { readLiveState, updateLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
  runId,
  staffFullName,
} from './live-spec-utils.js';

const scratch = newScratch();

// ICT wall-clock HH:mm, `hours` in the past — UTC+7 fixed, host-locale independent.
function ictHhmmMinus(hours: number): string {
  const wall = new Date(Date.now() + 7 * 3_600_000);
  wall.setUTCHours(wall.getUTCHours() - hours);
  const hh = String(wall.getUTCHours()).padStart(2, '0');
  const mm = String(wall.getUTCMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}

test.describe('03-class-attendance — create class with schedule (P2-01), take attendance (P2-02)', () => {
  test('GĐĐT sees the new class; the teacher marks the student present on today\'s session', async ({ browser }) => {
    const state = readLiveState();
    const studentName = state.contactName;
    test.skip(!studentName, '02 did not provision a student — attendance needs an enrolled child.');

    // Warm the super-admin session so the tRPC cookie below is fresh.
    const warm = await openStaffSession(browser, 'superAdmin');
    await closeRoleSession(warm);

    // 1. teacher AppUser id (user.pickList, role giao_vien — match by name).
    const adminClient = liveSuperAdminClient();
    const teacherName = staffFullName('giao_vien');
    const pick = await adminClient.user.pickList.query({ role: 'giao_vien' });
    const teacher = (pick.items ?? []).find((t: { fullName: string }) => t.fullName === teacherName);
    expect(teacher, 'giao_vien from 00-setup-roles must be visible to user.pickList').toBeTruthy();
    const teacherAppUserId = (teacher as { id: string }).id;

    // 2. create the class with a schedule; slot ~1h in the past (window-safe).
    const startTime = ictHhmmMinus(1);
    const endTime = ictHhmmMinus(0);
    const created = await createLiveClass({
      courseName: 'Live Attendance Course ' + runId(),
      teacherAppUserId,
      slotOverride: { startTime, endTime },
    });
    const classCode = created.classBatch.code;
    const classBatchId = created.classBatch.id;
    updateLiveState((s) => { s.attendanceClassCode = classCode; });
    recordCreated(scratch, 'class-batch', 'attendance class code', classCode);
    recordCreated(scratch, 'course', 'course name', 'Live Attendance Course ' + runId());

    // 3. ACTIVE enrollment in the new class via the real money chain (tRPC
    //    with the saved sessions — same mutations the Xếp lớp/Phiếu thu UI drives).
    const saleClient = liveStaffRoleClient('sale');
    // student.lookup returns StudentLookupResultDto[] — the same read the
    // Xếp lớp screen drives (lookup by name, never by smuggled id).
    const lookup = await saleClient.student.lookup.query({ name: studentName! });
    const found = lookup.find((s) => s.fullName === studentName);
    expect(found, 'student from 02 must be findable via student.lookup').toBeTruthy();
    const studentId = found!.id;
    const receiptRes = await saleClient.finance.receiptCreate.mutate({
      studentId,
      studentName: studentName!,
      parentPhone: state.parentPhone ?? '0999999999',
      parentEmail: state.parentEmail ?? undefined,
      amount: 5000001,
      classBatchId,
    });
    // Mirror the local-harness narrowing pattern (lms-login.ui.spec.ts):
    // status !== 'success' throws, then TS narrows to the success variant.
    if (receiptRes.status !== 'success') {
      throw new Error('receiptCreate (class B activation) failed: ' + receiptRes.message);
    }
    const gdkdClient = liveStaffRoleClient('giam_doc_kinh_doanh');
    const approved = await gdkdClient.finance.receiptApprove.mutate({
      receiptId: receiptRes.receipt.id,
    });
    expect(approved.receipt.status).toBe('approved');
    recordCreated(scratch, 'receipt', 'class-B activation receipt', receiptRes.receipt.code);

    // 4. GĐĐT views the class through the real nav (found by code).
    const gddtSession = await openStaffSession(browser, 'giam_doc_dao_tao');
    attachErrors(gddtSession.page, scratch);
    try {
      await menuNav(gddtSession.page, 'Lớp & Học sinh', 'Lớp học', { role: 'giam_doc_dao_tao' });
      await expect(gddtSession.page).toHaveURL(/\/admin\/classes/);
      const classRow = await findInList(gddtSession.page, (text) => text.includes(classCode));
      await classRow.click();
      await expect(gddtSession.page).toHaveURL(/\/admin\/classes\/[0-9a-f-]{36}$/);
      await expect(gddtSession.page.getByText(classCode).first()).toBeVisible();
      await assertNoErrors(gddtSession.page, scratch.collectors[0]!, 'view class (P2-01)');
    } finally {
      await closeRoleSession(gddtSession);
    }

    // 5. giao_vien takes attendance through the real page pickers (P2-02).
    const teacherSession = await openStaffSession(browser, 'giao_vien');
    attachErrors(teacherSession.page, scratch);
    try {
      await menuNav(teacherSession.page, 'Giảng dạy', 'Điểm danh', { role: 'giao_vien' });
      await expect(teacherSession.page).toHaveURL(/\/teaching\/attendance/);
      await teacherSession.page.getByRole('combobox', { name: 'Chọn lớp học' }).click();
      await teacherSession.page.getByRole('option', { name: new RegExp(classCode) }).click();
      await teacherSession.page.getByRole('combobox', { name: 'Chọn buổi học' }).click();
      await teacherSession.page.getByRole('option').first().click();
      await expect(teacherSession.page.getByText(studentName!)).toBeVisible();
      // One student on the roster → one status toggle (Chưa điểm danh → Có mặt).
      await teacherSession.page.getByRole('button', { name: 'Chưa điểm danh' }).first().click();
      await teacherSession.page.getByRole('button', { name: 'Lưu điểm danh' }).click();
      await expect(teacherSession.page.getByText(/Điểm danh đã được lưu/)).toBeVisible();
      await assertNoErrors(teacherSession.page, scratch.collectors[1]!, 'mark attendance (P2-02)');
      recordCreated(scratch, 'attendance', 'session attendance (present)', studentName!);
    } finally {
      await closeRoleSession(teacherSession);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});

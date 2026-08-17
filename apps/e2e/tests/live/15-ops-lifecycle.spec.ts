// 15-ops-lifecycle — REAL-ENVIRONMENT student lifecycle (P4-05 E8: student.setLifecycle)
// on the live VPS. QĐ 0027 — only directors/super_admin may change lifecycle;
// the flow is a multi-step confirm (Selector + "Áp dụng" + confirm dialog).
//   active → blocked_lms (Khóa LMS) → assert badge + then back to active
//   (rollback in the same spec so the campaign's student stays usable).
//
// Precondition: 02-receipt-approve-enroll provisioned a Student
// (state.contactName); the id is resolved via student.lookup (staff read).

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { readLiveState } from '../../src/live/live-state.js';
import { liveStaffRoleClient } from '../../src/live/live-trcp.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrorsAll,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('15-ops-lifecycle — đổi trạng thái học viên (P4-05 E8, live)', () => {
  test('GĐKD đổi active→blocked_lms→active (rollback) qua /admin/students/:id', async ({ browser }) => {
    const state = readLiveState();
    const studentName = state.contactName;
    test.skip(!studentName, '02 did not provision a student — lifecycle needs a real student.');

    // Resolve the student id through the staff read (same lookup the UI drives).
    const gdClient = liveStaffRoleClient('giam_doc_kinh_doanh');
    const found = await gdClient.student.lookup.query({ name: studentName! });
    const student = found.find((s) => s.fullName === studentName);
    expect(student, 'student from 02 must be findable via student.lookup').toBeTruthy();
    const studentId = student!.id;

    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      // Deep-link to the student detail (the id came from the same staff read
      // the UI drives; list find by name is fragile across pagination).
      await gd.page.goto('/admin/students/' + studentId);
      await expect(gd.page).toHaveURL(new RegExp('/admin/students/' + studentId + '$'), { timeout: 15_000 });
      await expect(gd.page.getByText(studentName!, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

      // active → blocked_lms (Khóa LMS).
      await gd.page.getByRole('combobox', { name: 'Đổi trạng thái' }).click();
      await gd.page.getByRole('option', { name: 'Khóa LMS' }).click();
      await gd.page.getByRole('button', { name: 'Áp dụng' }).click();
      const confirmDialog = gd.page.getByRole('alertdialog');
      await confirmDialog.getByRole('button', { name: /Xác nhận|Áp dụng/ }).click();
      // M2 (code review): assert trạng thái THẬT qua tRPC readback (student.lookup trả
      // lifecycle) — text assertion có thể khớp vào Selector pending value, không phải badge.
      const afterBlock = await gdClient.student.lookup.query({ name: studentName! });
      expect(afterBlock.find((s) => s.fullName === studentName)?.lifecycle).toBe('blocked_lms');
      recordCreated(scratch, 'student-lifecycle', 'blocked_lms', studentId);
      console.log('[15-ops-lifecycle] student → blocked_lms');

      // Rollback: blocked_lms → active (Đang học).
      await gd.page.getByRole('combobox', { name: 'Đổi trạng thái' }).click();
      await gd.page.getByRole('option', { name: 'Đang học' }).click();
      await gd.page.getByRole('button', { name: 'Áp dụng' }).click();
      const confirmDialog2 = gd.page.getByRole('alertdialog');
      await confirmDialog2.getByRole('button', { name: /Xác nhận|Áp dụng/ }).click();
      const afterActive = await gdClient.student.lookup.query({ name: studentName! });
      expect(afterActive.find((s) => s.fullName === studentName)?.lifecycle).toBe('active');
      recordCreated(scratch, 'student-lifecycle', 'back-to-active', studentId);
      console.log('[15-ops-lifecycle] student → active (rollback)');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrorsAll(scratch, 'student lifecycle edge');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
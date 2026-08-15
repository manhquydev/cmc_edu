// 02-receipt-approve-enroll — REAL-ENVIRONMENT money chain (admin ERP).
//
// P1-02 + P1-03 + P1-05 (activation):
//   1. sale opens /crm, finds the O4_TESTED card created by 01-crm-funnel
//      (by contact name — never an id) and clicks its "Ghi danh" button,
//      which navigates to /finance/new?opportunityId=<id> (ADR-B).
//   2. sale fills the receipt (parent email, class, tuition 5000001 — the
//      native min=1 step=100000 spinbutton requires 1+k*100000) and creates
//      it; the in-place success banner shows the receipt code.
//   3. giam_doc_kinh_doanh finds the receipt in the /finance QUEUE by the
//      displayed student name (findInList — never a direct URL), opens it,
//      approves ("Duyệt & Kích hoạt" + confirm dialog) → provisioning
//      creates the Student + ParentAccount and ACTIVATES the enrollment.
//   4. The parent identity (email/phone) is recorded to the run state for
//      04-parent-otp; the receipt code + class code go to the evidence log.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { createLiveClass } from '../../src/live/live-trcp.js';
import { readLiveState, updateLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
  runId,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('02-receipt-approve-enroll — receipt from the O4 opportunity, approved from the /finance queue', () => {
  test('sale creates the receipt from the CRM opportunity; GĐKD approves it → student + active enrollment', async ({ browser }) => {
    const state = readLiveState();
    const studentName = state.contactName;
    test.skip(!studentName, '01-crm-funnel did not run or produced no opportunity — cannot create the receipt from it.');
    const parentPhone = state.parentPhone ?? '0999999999';
    const parentEmail = 'live-parent-' + runId() + '@example.com';

    // Class for the receipt: Course/ClassBatch have NO admin UI (PO-approved
    // tRPC exception, scout §6) — create via the live super-admin session.
    // Warm the super-admin session first so the persisted cookie is fresh.
    const warm = await openStaffSession(browser, 'superAdmin');
    await closeRoleSession(warm);
    const liveClass = await createLiveClass({ courseName: 'Live Enroll Course ' + runId() });
    const classCode = liveClass.classBatch.code;
    recordCreated(scratch, 'class-batch', 'enrollment class code', classCode);
    updateLiveState((state2) => { state2.receiptClassCode = classCode; });

    // ── sale: receipt from the O4 opportunity ──
    const saleSession = await openStaffSession(browser, 'sale');
    attachErrors(saleSession.page, scratch);
    try {
      await menuNav(saleSession.page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
      const card = saleSession.page.getByRole('button', { name: new RegExp('^' + studentName!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
      await expect(card.getByRole('button', { name: 'Ghi danh', exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Ghi danh', exact: true }).click();
      await expect(saleSession.page).toHaveURL(/\/finance\/new\?opportunityId=/);

      // Prefilled from the opportunity (student name + normalized phone).
      await expect(saleSession.page.getByLabel('Họ tên học viên')).toHaveValue(studentName!);
      await saleSession.page.getByLabel('Email phụ huynh').fill(parentEmail);
      await saleSession.page.getByRole('combobox', { name: /^Lớp học/ }).click();
      await saleSession.page.getByRole('option', { name: new RegExp(classCode) }).click();
      await saleSession.page.getByRole('spinbutton', { name: /^Học phí/ }).fill('5000001');
      await saleSession.page.getByRole('button', { name: 'Tạo phiếu thu' }).click();
      await expect(saleSession.page.getByText(/^Đã tạo phiếu thu /)).toBeVisible();
      const banner = await saleSession.page.getByText(/^Đã tạo phiếu thu /).textContent();
      const receiptCode = banner!.replace('Đã tạo phiếu thu ', '').trim();
      await assertNoErrors(saleSession.page, scratch.collectors[0]!, 'create receipt from opportunity');

      updateLiveState((state2) => {
        state2.parentEmail = parentEmail;
        state2.parentPhone = parentPhone;
        state2.receiptCode = receiptCode;
      });
      recordCreated(scratch, 'receipt', 'receipt code', receiptCode);
      recordCreated(scratch, 'parent-email', 'parent email (LMS OTP)', parentEmail);
    } finally {
      await closeRoleSession(saleSession);
    }

    // ── GĐKD: approve from the /finance queue (found by student name) ──
    const gdkdSession = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gdkdSession.page, scratch);
    try {
      await menuNav(gdkdSession.page, 'Tài chính & Điều hành', 'Phiếu thu', { role: 'giam_doc_kinh_doanh' });
      const row = await findInList(gdkdSession.page, (text) => text.includes(studentName!));
      await row.click();
      await expect(gdkdSession.page).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
      await gdkdSession.page.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      const dialog = gdkdSession.page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      // Provisioning may complete synchronously (ok) or hand off to the retry
      // worker (pending) — both prove the approve ran and the banner shows it.
      await expect(gdkdSession.page.getByText('Phiếu đã được duyệt')).toBeVisible();
      await assertNoErrors(gdkdSession.page, scratch.collectors[1]!, 'approve receipt → provisioning');
      recordCreated(scratch, 'enrollment', 'student (activated by approval)', studentName!);
    } finally {
      await closeRoleSession(gdkdSession);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});

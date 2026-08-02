// The real money chain that brings a student account into existence: a sale
// records a receipt for a named student, a director approves it, and
// provisioning turns that into a StudentAccount (default password, must-change
// flag) plus the Guardian link to the parent.
//
// Extracted because two journeys need exactly this preamble before they can
// test anything LMS-side (parent OTP login, student activation). Keeping it in
// one place also keeps the fee-value gotcha below fixed once rather than
// copy-pasted — see the comment on `feeVnd`.

import { randomUUID } from 'node:crypto';

import type { Browser } from '@playwright/test';
import { expect } from '@playwright/test';

import type { Role } from '@cmc/auth';
import { mintStaffCookie } from '../session-injection.js';
import { menuNav } from './menu-nav.js';
import { findInList } from './find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const ADMIN_URL = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

export interface ProvisionStudentOptions {
  facilityId: string;
  /** The class the receipt enrols into — from `seedClassBatch`. */
  classCode: string | RegExp;
  studentName: string;
  parentPhone: string;
  /** Recorded on the receipt so the parent can log in by email OTP —
   *  provisioning upserts it onto the ParentAccount. The receipt-create form
   *  now REQUIRES this field (it is the parent's LMS credential, see
   *  receipt-create.tsx's `validate`); when omitted here, this helper fills a
   *  generated `@e2e.cmc` address so the real "Tạo phiếu thu" submit is never
   *  blocked by client-side validation. */
  parentEmail?: string;
  /** Fee to enter, as the string the input receives. Default '3000001' — the
   *  trailing 1 is required (see the fill call). Pass a value > 20,000,000 to
   *  exercise the second-eye path; then `approverRole` must be a second-eye
   *  role or approval is refused. */
  feeVnd?: string;
  /** Role that approves the receipt. Default 'giam_doc_kinh_doanh'. A receipt
   *  over the second-eye threshold must be approved by 'giam_doc_dao_tao' or
   *  'super_admin', or the approve button never renders (canApprove=false). */
  approverRole?: Role;
  /** A short, unique tag mixed into the staff cookie user ids so parallel or
   *  repeated runs never collide. */
  runId?: string;
}

/**
 * Drives the sale→director receipt-approval chain through the real admin UI and
 * returns once provisioning has run. Data is created by each role in turn, menu
 * first, one browser context per role — no ids are passed between them.
 */
export async function provisionStudentViaReceipt(
  browser: Browser,
  options: ProvisionStudentOptions,
): Promise<{ receiptId: string }> {
  const runId = options.runId ?? randomUUID().slice(0, 8);
  const classCode = options.classCode instanceof RegExp ? options.classCode : new RegExp(options.classCode);
  const feeVnd = options.feeVnd ?? '3000001';
  const approverRole = options.approverRole ?? 'giam_doc_kinh_doanh';
  const parentEmail = options.parentEmail ?? `e2e-parent-${runId}@e2e.cmc`;

  // --- sale: create the receipt for this student ---
  const saleContext = await browser.newContext({ baseURL: ADMIN_URL });
  const salePage = await saleContext.newPage();
  await saleContext.addCookies(
    cookiePair(
      STAFF_COOKIE_NAME,
      mintStaffCookie({ userId: `e2e-prov-sale-${runId}`, roles: ['sale'], facilityId: options.facilityId }),
    ),
  );
  await salePage.goto('/cockpit');

  await menuNav(salePage, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
  await salePage.getByText('tạo phiếu thu mới').click();
  await expect(salePage).toHaveURL(/\/finance\/new/);

  await salePage.getByLabel('Họ tên học viên').fill(options.studentName);
  await salePage.getByLabel('SĐT phụ huynh').fill(options.parentPhone);
  await salePage.getByLabel('Email phụ huynh').fill(parentEmail);
  await salePage.getByRole('button', { name: /^Lớp học/ }).click();
  await salePage.getByRole('option', { name: classCode }).click();
  // The trailing 1 is load-bearing. The fee input is min={1} step={100000}, so
  // the browser only accepts 1 + n×100000 — a round 3000000 is a step mismatch
  // that lands in React state as NaN and silently blocks submit (verified
  // directly; recorded as a product finding). Keep any fee on that lattice.
  await salePage.getByRole('spinbutton', { name: /^Học phí/ }).fill(feeVnd);
  await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
  await expect(salePage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
  // The receipt id is the last path segment — the only place Playwright can
  // observe it (receiptCreate's response is not visible to the browser tests).
  const receiptId = new URL(salePage.url()).pathname.split('/').pop()!;
  await saleContext.close();

  // --- director: approve, which is what actually provisions the account ---
  const approverContext = await browser.newContext({ baseURL: ADMIN_URL });
  const approverPage = await approverContext.newPage();
  await approverContext.addCookies(
    cookiePair(
      STAFF_COOKIE_NAME,
      mintStaffCookie({
        userId: `e2e-prov-appr-${runId}`,
        roles: [approverRole],
        facilityId: options.facilityId,
      }),
    ),
  );
  await approverPage.goto('/cockpit');

  await menuNav(approverPage, 'Tài chính & Điều hành', 'Phiếu thu', { role: approverRole });
  const row = await findInList(approverPage, (text) => text.includes(options.studentName));
  await row.click();
  await approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
  const dialog = approverPage.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
  await expect(
    approverPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
  ).toBeVisible();
  await approverContext.close();

  return { receiptId };
}

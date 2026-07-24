// P1-07 journey — Đăng nhập xem con: a parent whose account was created by the
// real money flow logs into the LMS with an emailed one-time code.
//
// What this proves that lms-login.ui.spec.ts does not: that spec drives the
// login SCREEN in isolation (tabs, field hardening, the generic-error contract)
// against no real account. This journey proves the whole chain — sale records
// the parent's email on a receipt, a director approves it, provisioning turns
// that into a ParentAccount, and the address on it is the one that can actually
// receive a code and open the parent's own page.
//
// The email address is entered through the real UI. `/finance/new` has a
// "Email phụ huynh" field (receipt-create.tsx) whose value provisioning upserts
// onto the ParentAccount (provision-from-receipt.ts), so no seeding is needed
// anywhere in this flow.
//
// SCOPE HONESTY — read before treating a green here as "parents can log in".
// This proves code generation, enqueue and verification. It does NOT prove
// delivery: non-production runs use ConsoleEmailTransport, and the login screen
// itself carries a visible "[DEV ONLY — blocked-on-comms]" label. Real
// transports (Brevo/Graph) exist but are not exercised here. Green means the
// flow works up to the comms boundary, and no further.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { readOtpCodeByEmail, seedClassBatch, sweepParentIdentity } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const ADMIN_URL = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P1-07 journey — phụ huynh đăng nhập LMS bằng mã OTP qua email', () => {
  // A fresh identity per run. OTP rate limiting counts rows per identifier
  // (5 per 15 minutes), and provisioning finds-or-creates a ParentAccount by
  // phone — a shared identity would make this spec fail on the second run of
  // the day for reasons that have nothing to do with the flow.
  const runId = randomUUID().slice(0, 8);
  const parentEmail = `e2e-parent-${runId}@example.test`;
  const parentPhone = randomVnPhone();
  const studentName = `E2E P1-07 Student ${runId}`;

  test.beforeAll(async () => {
    // Before, not after: a run that dies halfway must not poison the next one.
    await sweepParentIdentity({ email: parentEmail, phone: parentPhone });
  });

  test.afterAll(async () => {
    await sweepParentIdentity({ email: parentEmail, phone: parentPhone });
  });

  test('a receipt carrying the parent email provisions an account that can log in with a real emailed code', async ({
    browser,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    // --- sale: create the receipt, recording the parent's email on it ---
    const saleContext = await browser.newContext({ baseURL: ADMIN_URL });
    const salePage = await saleContext.newPage();
    await saleContext.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId: `e2e-p107-sale-${runId}`, roles: ['sale'], facilityId }),
      ),
    );
    await salePage.goto('/cockpit');

    await menuNav(salePage, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
    await salePage.getByText('tạo phiếu thu mới').click();
    await expect(salePage).toHaveURL(/\/finance\/new/);

    await salePage.getByLabel('Họ tên học viên').fill(studentName);
    await salePage.getByLabel('SĐT phụ huynh').fill(parentPhone);
    await salePage.getByLabel('Email phụ huynh').fill(parentEmail);
    await salePage.getByRole('button', { name: /^Lớp học/ }).click();
    await salePage.getByRole('option', { name: new RegExp(seeded.code) }).click();
    // The trailing 1 is load-bearing, not a typo. The fee input is min={1}
    // step={100000}, so the only values the browser accepts are 1 + n×100000 —
    // a round 3000000 is a step mismatch, lands in React state as NaN, and the
    // form silently refuses to submit. Verified directly: 3000000 never
    // submits, 3000001 does. Recorded as a product finding; do not "tidy" this
    // to a round number.
    await salePage.getByRole('spinbutton', { name: /^Học phí/ }).fill('3000001');
    await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    await expect(salePage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
    await saleContext.close();

    // --- director: approve, which is what actually provisions the account ---
    const approverContext = await browser.newContext({ baseURL: ADMIN_URL });
    const approverPage = await approverContext.newPage();
    await approverContext.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p107-gdkd-${runId}`,
          roles: ['giam_doc_kinh_doanh'],
          facilityId,
        }),
      ),
    );
    await approverPage.goto('/cockpit');

    await menuNav(approverPage, 'Tài chính & Điều hành', 'Phiếu thu', {
      role: 'giam_doc_kinh_doanh',
    });
    const row = await findInList(approverPage, (text) => text.includes(studentName));
    await row.click();
    await approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    const dialog = approverPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    await expect(
      approverPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeVisible();
    await approverContext.close();

    // --- parent: the real login screen, on the LMS origin ---
    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await parentPage.goto('/login');
    await parentPage.getByRole('button', { name: /phụ huynh/i }).click();

    // FALSIFICATION FIRST — a wrong code must be refused, and must not reveal
    // whether the address exists. Asserted before the happy path so a broken
    // gate cannot hide behind a passing login.
    await parentPage.getByLabel('Email phụ huynh').fill(parentEmail);
    await parentPage.getByRole('button', { name: 'Gửi mã OTP' }).click();
    await parentPage.getByLabel('Mã OTP (6 số)').fill('000000');
    await parentPage.getByRole('button', { name: /xác nhận|đăng nhập/i }).click();
    await expect(parentPage.getByText(/không đúng|hết hạn/i)).toBeVisible();
    await expect(parentPage).not.toHaveURL(/\/parent/);

    // Now the real code, read from the email the system actually queued.
    const code = await readOtpCodeByEmail(parentEmail);
    expect(code).toMatch(/^\d{6}$/);

    await parentPage.getByLabel('Mã OTP (6 số)').fill(code);
    await parentPage.getByRole('button', { name: /xác nhận|đăng nhập/i }).click();

    // The parent lands on their own page and sees the child the money flow
    // created — the name is the proof the account is linked to the right child,
    // and it was never passed between roles: sale typed it, the parent reads it.
    await expect(parentPage).toHaveURL(/\/parent/);
    // The child picker chip specifically: the name also appears in the page
    // body, and asserting the chip proves the parent can actually SELECT this
    // child, not merely that the string rendered somewhere.
    await expect(parentPage.getByRole('button', { name: studentName })).toBeVisible();

    await parentContext.close();
  });
});

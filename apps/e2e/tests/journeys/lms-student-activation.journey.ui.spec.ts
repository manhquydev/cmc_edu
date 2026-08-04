// P1-04 journey — Sinh tài khoản khi thu tiền, xét từ phía học sinh: the
// account provisioning creates must force a password change before it is usable,
// and only the parent can clear that gate.
//
// The choreography is ordered the way the app actually behaves (red-team RT-5):
// `resetChildPassword` sets mustChangePassword=false, so the gate can only be
// observed BEFORE the parent resets, never after. Sequence:
//   1. provision via the real receipt chain → account with the default password
//      and mustChangePassword=true
//   2. student logs in with the default password → is held at the change-password
//      gate (logout-only; there is deliberately no student self-service reset)
//   3. parent, on their own page, resets the child's password → clears the gate
//   4. student logs in with the NEW password → reaches their home
//   5. falsification: the OLD default no longer works after the reset
//
// On the default password: `Cmc2026@` is not a secret this spec invented. It is
// the value provisioning hashes into every new account (provision-from-receipt.ts,
// student/router.ts) and the LMS prints it on both the login screen and the
// change-password screen. A first login is impossible without it, so the spec
// references it through the single named constant below rather than as a
// scattered literal. That it lives as a duplicated literal in the app, not one
// shared constant, is recorded as a product finding.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { withFacility } from '@cmc/db';

import { findParentAccountIdByPhone, getDb, seedClassBatch, sweepParentIdentity } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { provisionStudentViaReceipt } from '../../src/journey/provision-student-via-receipt.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { mintLmsSession } from '../../src/journey/mint-lms-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

// The password provisioning sets on every new account — published to the user
// on the login and change-password screens (login.tsx, change-password.tsx).
const PROVISIONING_DEFAULT_PASSWORD = 'Cmc2026@';

test.describe('P1-04 journey — kích hoạt học sinh: cổng đổi mật khẩu + phụ huynh đặt lại', () => {
  const runId = randomUUID().slice(0, 8);
  const parentPhone = randomVnPhone();
  const studentName = `E2E P1-04 Student ${runId}`;
  const newPassword = `Reset-${runId}!`;

  test.beforeAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });

  test.afterAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });

  test('a provisioned student is held at the password gate until the parent resets it', async ({
    browser,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    await provisionStudentViaReceipt(browser, {
      facilityId,
      classCode: seeded.code,
      studentName,
      parentPhone,
      runId,
    });

    // --- student: first login with the default password hits the gate ---
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/login');
    // Student tab is the default. Login is by the PARENT phone + the student's
    // password (loginStudent resolves the child by password under that phone).
    await studentPage.getByLabel('Số điện thoại phụ huynh').fill(parentPhone);
    await studentPage.getByLabel('Mật khẩu', { exact: true }).fill(PROVISIONING_DEFAULT_PASSWORD);
    await studentPage.getByRole('button', { name: 'Đăng nhập' }).click();

    // The gate: held at change-password, and it is logout-only — there is no
    // student self-service password form here, the parent must do the reset.
    await expect(studentPage).toHaveURL(/\/student\/change-password/);
    await expect(
      studentPage.getByRole('button', { name: /Đăng xuất và quay lại đăng nhập/i }),
    ).toBeVisible();
    await expect(studentPage.getByLabel('Mật khẩu mới')).toHaveCount(0);
    await studentContext.close();

    // --- parent: reach the reset screen through their own home, reset the child ---
    const parentAccountId = await findParentAccountIdByPhone(parentPhone);
    expect(parentAccountId, 'provisioning must have created a ParentAccount').not.toBeNull();

    const parentContext = await browser.newContext();
    await mintLmsSession(parentContext, { kind: 'parent', parentAccountId: parentAccountId! });
    const parentPage = await parentContext.newPage();
    await parentPage.goto('/parent/home');

    // The parent sees their child and navigates to the reset screen the same
    // way a real parent would — clicking the child's own action, no id typed.
    await parentPage.getByRole('button', { name: /Đặt lại mật khẩu học sinh/i }).click();
    await expect(parentPage).toHaveURL(/\/parent\/reset-password\//);
    // exact: "Mật khẩu mới" is otherwise a substring of "Xác nhận mật khẩu mới".
    await parentPage.getByLabel('Mật khẩu mới', { exact: true }).fill(newPassword);
    await parentPage.getByLabel('Xác nhận mật khẩu mới').fill(newPassword);
    await parentPage.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(parentPage.getByText(/Đặt lại mật khẩu thành công/i)).toBeVisible();
    await parentContext.close();

    // --- student: the new password works and the gate is gone ---
    const afterContext = await browser.newContext();
    const afterPage = await afterContext.newPage();
    await afterPage.goto('/login');
    await afterPage.getByLabel('Số điện thoại phụ huynh').fill(parentPhone);
    await afterPage.getByLabel('Mật khẩu', { exact: true }).fill(newPassword);
    await afterPage.getByRole('button', { name: 'Đăng nhập' }).click();
    // Straight to home: the reset cleared mustChangePassword.
    await expect(afterPage).toHaveURL(/\/student\/home/);
    await afterContext.close();

    // --- falsification: the old default must no longer work after the reset ---
    const oldPwContext = await browser.newContext();
    const oldPwPage = await oldPwContext.newPage();
    await oldPwPage.goto('/login');
    await oldPwPage.getByLabel('Số điện thoại phụ huynh').fill(parentPhone);
    await oldPwPage.getByLabel('Mật khẩu', { exact: true }).fill(PROVISIONING_DEFAULT_PASSWORD);
    await oldPwPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(oldPwPage.getByText(/không đúng/i)).toBeVisible();
    await expect(oldPwPage).not.toHaveURL(/\/student\/(home|change-password)/);
    await oldPwContext.close();

    // ── business invariant ──
    // The login flows above prove the account is USABLE; they do not prove
    // provisioning wired it to the right people. The receipt carried only a
    // studentName and a parentPhone; provisioning (provision-from-receipt.ts)
    // find-or-creates the ParentAccount by that phone and links a StudentAccount
    // to both the new Student and that ParentAccount. This reads the account back
    // by its STUDENT side (unique studentName) and asserts its PARENT side equals
    // the ParentAccount that owns parentPhone (resolved independently above) — a
    // join-integrity check across the money-chain's output, not an echo of any
    // typed value. mustChangePassword is deliberately NOT asserted: the parent
    // reset earlier in this flow cleared it, so the stable provisioned linkage is
    // the correct invariant. No staff/LMS read-proc exposes StudentAccount
    // linkage, so this uses the getDb() RLS-bypass seam. Turns P1-04 from
    // reachable-only into verified-correct.
    const studentAccount = await withFacility(
      getDb(),
      null,
      (tx) =>
        tx.studentAccount.findFirst({
          where: { student: { facilityId, fullName: studentName } },
          select: { parentAccountId: true, student: { select: { fullName: true } } },
        }),
      { bypass: true },
    );
    expect(studentAccount, 'provisioning phải tạo StudentAccount cho học sinh này').not.toBeNull();
    assertBusinessInvariant(
      'tài khoản LMS được liên kết đúng phụ huynh đã đóng phí (StudentAccount → ParentAccount)',
      studentAccount!.parentAccountId,
      parentAccountId,
    );
  });
});

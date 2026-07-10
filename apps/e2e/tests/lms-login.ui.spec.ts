// LMS login UI safety net (Phase 1 of the Astryx UI migration).
//
// Captures CURRENT (Mantine) login-page behavior via real browser assertions
// BEFORE any component is migrated: 2-tab switch, BLOCKED-ON-COMMS notice,
// generic error messages (no-leak contract), and the mustChangePassword
// redirect. Selectors use role/label/text, not Mantine CSS classes.
//
// Plan drift note (found while writing this spec, 2026-07-10): the phase-02
// doc describes testing a "deep-link ?tab=student" query param. No such
// query-param handling exists in apps/lms/src/pages/login.tsx today (Tabs
// always defaultValue="student", no useSearchParams anywhere in apps/lms) —
// this spec tests the tab switch via click instead, matching actual current
// behavior. A safety net must capture what exists, not what the plan assumed
// existed; add deep-link support as a real feature request if still wanted.

import { test, expect } from '@playwright/test';
import { randomVnPhone } from '../src/random-vn-phone.js';
import { createE2eStaffClient } from '../src/trpc-client.js';
import { cleanupParentAccountsByPhone } from '../src/db.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

/** Seeds a ParentAccount + StudentAccount via the real provisioning pipeline
 * (course -> classBatch -> opportunity -> receipt -> approve). The student's
 * login identifier is the parent's phone; password is always the
 * "Cmc2026@" default with mustChangePassword=true — trimmed down from
 * lms-auth.spec.ts's seedStudentViaProvisioning (that version also recovers
 * the parent OTP session, which this UI spec doesn't need). */
async function seedStudentForLogin(parentPhone: string): Promise<void> {
  const gddt = createE2eStaffClient(baseUrl, {
    userId: 'e2e-lmslogin-gddt',
    roles: ['giam_doc_dao_tao'],
    facilityId,
  });
  const sale = createE2eStaffClient(baseUrl, {
    userId: 'e2e-lmslogin-sale',
    roles: ['sale'],
    facilityId,
  });
  const gdkd = createE2eStaffClient(baseUrl, {
    userId: 'e2e-lmslogin-gdkd',
    roles: ['giam_doc_kinh_doanh'],
    facilityId,
  });

  const course = await gddt.course.create.mutate({
    program: 'UCREA',
    name: `LmsLoginUi Course ${parentPhone}`,
  });
  const classBatch = await gddt.classBatch.create.mutate({
    courseId: course.id,
    startDate: '2026-08-01',
    endDate: '2026-08-01',
    slots: [{ weekday: 6, startTime: '10:00', endTime: '11:00' }],
  });
  const opp = await sale.crm.opportunityCreate.mutate({
    contactName: `${parentPhone} parent`,
    phone: parentPhone,
  });
  for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
    await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
  }
  const receiptResult = await sale.finance.receiptCreate.mutate({
    opportunityId: opp.id,
    studentName: 'LMS Login UI Spec Student',
    parentPhone,
    amount: 5_000_000,
    classBatchId: classBatch.classBatch.id,
  });
  if (receiptResult.status !== 'success') {
    throw new Error(`receiptCreate failed: ${receiptResult.message}`);
  }
  const approved = await gdkd.finance.receiptApprove.mutate({ receiptId: receiptResult.receipt.id });
  expect(approved.receipt.status).toBe('approved');
}

test.describe('lms login (UI safety net)', () => {
  const parentPhone = randomVnPhone();

  test.beforeAll(async () => {
    await seedStudentForLogin(parentPhone);
  });

  test.afterAll(async () => {
    const { normalizeLoginPhone } = await import('@cmc/domain-identity');
    await cleanupParentAccountsByPhone(normalizeLoginPhone(parentPhone));
  });

  test('two tabs switch, student is default, parent tab shows blocked-on-comms notice', async ({ page }) => {
    await page.goto('/login');

    // Student tab is the default (Tabs defaultValue="student" in login.tsx).
    await expect(page.getByLabel('Số điện thoại phụ huynh')).toBeVisible();

    await page.getByRole('tab', { name: /phụ huynh/i }).click();
    await expect(page.getByText('[DEV ONLY — blocked-on-comms]')).toBeVisible();
    await expect(page.getByLabel('Email phụ huynh')).toBeVisible();

    await page.getByRole('tab', { name: /học sinh/i }).click();
    await expect(page.getByLabel('Số điện thoại phụ huynh')).toBeVisible();
  });

  test('wrong student credentials show a generic error (no-leak contract)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Số điện thoại phụ huynh').fill('0999999999');
    await page.getByLabel('Mật khẩu').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page.getByText('Thông tin đăng nhập không đúng.')).toBeVisible();
    // No-leak contract: the message must not vary by failure reason (unknown
    // phone vs wrong password vs locked account all render identically) —
    // this assertion only proves the generic path renders; the actual
    // no-leak guarantee is covered server-side by lms-auth.spec.ts.
  });

  // KNOWN BUG (found 2026-07-10 while writing this safety net — the first
  // browser-driven test of this flow): loginStudent's tRPC response DOES
  // return mustChangePassword: true (verified via response capture), but
  // apps/lms/src/pages/student/change-password.tsx:30 immediately bounces
  // back to /student/home — `if (session && !session.mustChangePassword)`
  // reads useSession()'s context state, which appears to not yet reflect
  // the just-set session on first render after the login-triggered
  // navigate(). Pre-existing bug, unrelated to the Astryx migration (this
  // file is untouched Mantine code) — out of scope to fix here; tracked as
  // fixme so the safety net accurately reflects "known broken" instead of
  // silently passing or blocking unrelated work.
  test.fixme('correct default-password login redirects to mustChangePassword', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Số điện thoại phụ huynh').fill(parentPhone);
    await page.getByLabel('Mật khẩu').fill('Cmc2026@');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(/\/student\/change-password/);
  });
});

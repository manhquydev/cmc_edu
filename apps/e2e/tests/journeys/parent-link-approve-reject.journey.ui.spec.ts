// P1-06 journey — the parent↔child link lifecycle. A real parent account raises
// two link requests (guardian.requestLink), then staff approve one
// (guardian.approveLink) and reject the other (guardian.rejectLink) on
// /admin/parents, with guardian.listPendingLinks as the evidence surface.
//
// TWO GAPS THIS FLOW HAS, both found by writing this spec and both recorded
// rather than worked around silently (this plan measures, it does not fix):
//
//   1. `guardian.requestLink` has NO UI anywhere. Scanned apps/lms/src for
//      requestLink/guardian/linkRequest/studentRef — the parent app only has
//      setPhotoConsent, and parent/home.tsx:149 tells parents in so many words
//      to "Liên hệ nhân viên để yêu cầu duyệt liên kết". So the request is
//      raised here through the REAL procedure over a real parent LMS session
//      (createLmsClient), not seeded into the database — the procedure exists
//      and is exercised, only the screen is missing.
//
//   2. `/admin/parents` is ORPHANED FROM THE NAVIGATION. The route is
//      registered (apps/admin/src/routes/admin.routes.tsx:58) and the screen is
//      fully built, but no entry in shell/nav-registry.ts points at it —
//      verified against the complete list of nav paths. No menu can reach it, so
//      this spec navigates by URL. That is not a shortcut around a menu: it is
//      the only route a real user has either.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import {
  findParentAccountIdByPhone,
  seedClassBatch,
  seedStudent,
  sweepParentIdentity,
} from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { createLmsClient } from '../../src/trpc-client.js';
import { provisionStudentViaReceipt } from '../../src/journey/provision-student-via-receipt.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P1-06 journey — liên kết phụ huynh–con: yêu cầu → duyệt / từ chối', () => {
  test.use({ baseURL: 'http://localhost:4173' });
  test.setTimeout(180_000);

  const runId = randomUUID().slice(0, 8);
  const parentPhone = randomVnPhone();
  const provisionedChild = `E2E P106 Con A ${runId}`;
  const childToApprove = `E2E P106 Con B ${runId}`;
  const childToReject = `E2E P106 Con C ${runId}`;

  // Provisioning finds-or-creates a ParentAccount by phone, and that row is
  // global rather than facility-scoped, so it outlives this run's facility
  // teardown. Sweep it on both sides.
  test.beforeAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });
  test.afterAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });

  test('a parent requests two links and staff approve one and reject the other', async ({ browser }) => {
    // --- the only path that creates a ParentAccount: the real money chain ---
    const seeded = await seedClassBatch({ facilityId });
    await provisionStudentViaReceipt(browser, {
      facilityId,
      classCode: seeded.code,
      studentName: provisionedChild,
      parentPhone,
      runId,
    });

    // Two further children, NOT linked to this parent. They must differ from the
    // provisioned one: requestLink answers `already_linked` for a child the
    // parent is already a guardian of, which would raise no request at all.
    const childB = await seedStudent({ facilityId, studentName: childToApprove });
    const childC = await seedStudent({ facilityId, studentName: childToReject });

    // --- the parent raises both requests through the real procedure ---
    const parentAccountId = await findParentAccountIdByPhone(parentPhone);
    expect(parentAccountId, 'provisioning should have created the ParentAccount').not.toBeNull();
    const parentClient = createLmsClient(process.env.E2E_BASE_URL!, { parentAccountId: parentAccountId! });
    const requestB = await parentClient.guardian.requestLink.mutate({ studentRef: childB.studentId });
    const requestC = await parentClient.guardian.requestLink.mutate({ studentRef: childC.studentId });
    expect(requestB.status).toBe('created');
    expect(requestC.status).toBe('created');

    // --- staff open the (nav-less) screen and see both pending ---
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p106-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await page.goto('/admin/parents');
    const rowB = page.getByRole('row', { name: new RegExp(childToApprove) });
    const rowC = page.getByRole('row', { name: new RegExp(childToReject) });
    await expect(rowB).toBeVisible();
    await expect(rowC).toBeVisible();

    // --- approve B (the dialog also records the relationship) ---
    await rowB.getByRole('button', { name: 'Duyệt' }).click();
    const approveDialog = page.getByRole('dialog');
    await expect(approveDialog).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('guardian.approveLink') && r.status() === 200),
      approveDialog.getByRole('button', { name: 'Xác nhận duyệt' }).click(),
    ]);

    // --- reject C (a direct mutation, no dialog) ---
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('guardian.rejectLink') && r.status() === 200),
      rowC.getByRole('button', { name: 'Từ chối' }).click(),
    ]);

    // Both left the pending list. Absence alone is weak evidence, so each is then
    // found again under its own status filter — that is what distinguishes a real
    // transition from a row that merely stopped rendering.
    await expect(page.getByRole('row', { name: new RegExp(childToApprove) })).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(childToReject) })).toHaveCount(0);

    await selectLinkFilter(page, 'Đã duyệt');
    await expect(page.getByRole('row', { name: new RegExp(childToApprove) })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(childToReject) })).toHaveCount(0);

    await selectLinkFilter(page, 'Từ chối');
    await expect(page.getByRole('row', { name: new RegExp(childToReject) })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(childToApprove) })).toHaveCount(0);

    await context.close();
  });
});

/** Switches the link-request status filter (label is visually hidden). */
async function selectLinkFilter(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Lọc theo trạng thái' }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

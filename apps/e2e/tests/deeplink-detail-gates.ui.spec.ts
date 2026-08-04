// Phase 2a: PermissionGate on detail routes + cold-nav for all 4 entity detail pages.
// Complements deeplink-return-to.ui.spec.ts (Phase 1 form-login returnTo).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../src/session-injection.js';
import { createE2eStaffClient } from '../src/trpc-client.js';
import { seedClassBatch, seedStudent } from '../src/db.js';
import { randomVnPhone } from '../src/random-vn-phone.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const baseUrl = process.env.E2E_BASE_URL!;
const ADMIN_ORIGIN = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('detail-route PermissionGate + entity cold-nav', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  test('role without crm.opportunityList sees 403 EmptyState on opportunity URL', async ({
    browser,
  }) => {
    const runId = randomUUID().slice(0, 8);
    // Fixture owned by a sale; viewer is giao_vien (no CRM list permission).
    const sale = createE2eStaffClient(baseUrl, {
      userId: `e2e-p2a-sale-${runId}`,
      roles: ['sale'],
      facilityId,
    });
    const opp = await sale.crm.opportunityCreate.mutate({
      contactName: `E2E P2a Gate Lead ${runId}`,
      phone: randomVnPhone(),
    });

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p2a-gv-${runId}`,
          roles: ['giao_vien'],
          facilityId,
        }),
      ),
    );

    await page.goto(`/crm/opportunities/${opp.id}`);
    await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
    await expect(page.getByText(/crm\.opportunityList/)).toBeVisible();
    await context.close();
  });

  test('student detail cold-navigates by id (no location.state)', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    const studentName = `E2E P2a Student ${runId}`;
    const { studentId } = await seedStudent({ facilityId, studentName });

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    // sale has student.lookup — opens detail without coming from the list.
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p2a-sale-stu-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );

    await page.goto(`/admin/students/${studentId}`);
    // Must render the real name, not the fallback "ID: <uuid>" placeholder.
    await expect(page.getByText(studentName).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`ID:\\s*${studentId}`))).toHaveCount(0);
    await context.close();
  });

  test('receipt detail cold-navigates by id (receiptGet holder)', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    const { classBatchId } = await seedClassBatch({ facilityId });
    const sale = createE2eStaffClient(baseUrl, {
      userId: `e2e-p2a-sale-rcpt-${runId}`,
      roles: ['sale'],
      facilityId,
    });
    const parentPhone = randomVnPhone();
    const opp = await sale.crm.opportunityCreate.mutate({
      contactName: `E2E Cold Rcpt Parent ${runId}`,
      phone: parentPhone,
    });
    for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
      await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
    }
    const created = await sale.finance.receiptCreate.mutate({
      opportunityId: opp.id,
      studentName: `E2E Cold Rcpt Student ${runId}`,
      parentPhone,
      amount: 5_000_000,
      classBatchId,
    });
    if (created.status !== 'success') {
      throw new Error(`receiptCreate failed: ${created.message}`);
    }
    const receiptId = created.receipt.id;
    const receiptCode = created.receipt.code;

    // sale cannot receiptGet — open as giam_doc_kinh_doanh (has finance.receiptGet).
    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p2a-gdkd-rcpt-${runId}`,
          roles: ['giam_doc_kinh_doanh'],
          facilityId,
        }),
      ),
    );

    await page.goto(`/finance/${receiptId}`);
    await expect(page.getByText(receiptCode).first()).toBeVisible();
    await context.close();
  });

  test('class detail cold-navigates by id (class.create holder)', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    // seedClassBatch is facility-scoped; page also requires class.create (GĐĐT),
    // which is narrower than the route PermissionGate (class.read).
    const { classBatchId, code } = await seedClassBatch({ facilityId });

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p2a-gddt-cls-${runId}`,
          roles: ['giam_doc_dao_tao'],
          facilityId,
        }),
      ),
    );

    await page.goto(`/admin/classes/${classBatchId}`);
    await expect(page.getByText(code).first()).toBeVisible();
    await context.close();
  });
});

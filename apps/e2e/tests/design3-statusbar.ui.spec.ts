// Design3 — DetailPage thin statusbar sticky contract (list-click entry).
// PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium tests/design3-statusbar.ui.spec.ts

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../src/session-injection.js';
import { createE2eStaffClient } from '../src/trpc-client.js';
import { seedClassBatch } from '../src/db.js';
import { randomVnPhone } from '../src/random-vn-phone.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';
import {
  assertStickyStatusbar,
  measureDetailStatusbar,
  openSeededDetail,
} from '../src/design3/open-seeded-detail.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const baseUrl = process.env.E2E_BASE_URL!;
const ADMIN_ORIGIN = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('design3 detail statusbar grammar', () => {
  test.use({
    baseURL: ADMIN_ORIGIN,
    viewport: { width: 1280, height: 900 },
  });

  test('receipt + opportunity: list click → sticky statusbar, summary not sticky', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = randomUUID().slice(0, 8);
    const contactName = `E2E D3 SB Lead ${runId}`;
    const studentName = `E2E D3 SB Student ${runId}`;

    const { classBatchId } = await seedClassBatch({ facilityId });
    const sale = createE2eStaffClient(baseUrl, {
      userId: `e2e-d3-sb-sale-${runId}`,
      roles: ['sale'],
      facilityId,
    });
    const parentPhone = randomVnPhone();
    const opp = await sale.crm.opportunityCreate.mutate({
      contactName,
      phone: parentPhone,
    });
    for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
      await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
    }
    const created = await sale.finance.receiptCreate.mutate({
      opportunityId: opp.id,
      studentName,
      parentPhone,
      amount: 5_000_000,
      classBatchId,
    });
    if (created.status !== 'success') {
      throw new Error(`receiptCreate failed: ${created.message}`);
    }
    const receiptCode = created.receipt.code;

    const context = await browser.newContext({
      baseURL: ADMIN_ORIGIN,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-d3-sb-gdkd-${runId}`,
          roles: ['giam_doc_kinh_doanh'],
          facilityId,
        }),
      ),
    );

    const receiptOpen = await openSeededDetail(page, 'receipt', { matchText: receiptCode });
    expect(receiptOpen.path).toMatch(/\/finance\/[0-9a-f-]{36}$/i);
    await expect(page.locator('.o-detail-statusbar')).toBeVisible();
    const receiptMeasure = await measureDetailStatusbar(page);
    assertStickyStatusbar(receiptMeasure);

    const oppOpen = await openSeededDetail(page, 'opportunity', { matchText: contactName });
    expect(oppOpen.path).toMatch(/\/crm\/opportunities\/[0-9a-f-]{36}$/i);
    await expect(page.locator('.o-detail-statusbar')).toBeVisible();
    const oppMeasure = await measureDetailStatusbar(page);
    assertStickyStatusbar(oppMeasure);

    await context.close();
  });
});

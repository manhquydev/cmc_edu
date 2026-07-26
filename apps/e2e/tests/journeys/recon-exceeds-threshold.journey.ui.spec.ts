// P1-09 journey — Giám sát bất thường tài chính: a large receipt is created and
// approved through the real money flow, the reconciliation worker detects it,
// and a director sees the anomaly flagged on the Đối soát screen.
//
// Why exceeds_threshold and not self_approved: the triage's first idea was for
// one GĐKD to create AND approve their own receipt (rule 1, self_approved). That
// is not reachable through the UI — the server sets canApprove = notSelf && …
// (finance/router.ts) and receipt-detail hides the approve button whenever the
// viewer drafted the receipt, so a single person can never self-approve on
// screen. Rule 2 (exceeds_threshold) is the triage's own documented fallback and
// is fully UI-drivable: any approved receipt over 20,000,000đ is flagged, so a
// sale drafts a large receipt and a second-eye director (GĐĐT) approves it.
//
// The flag only appears after the worker runs — asserted directly below as the
// living falsification: the receipt's flag is ABSENT before runReconcileFinanceFlagsOnce
// and PRESENT after. Nothing is seeded; the worker reads real data the UI created.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedClassBatch, runReconcileFinanceFlagsOnce } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { provisionStudentViaReceipt } from '../../src/journey/provision-student-via-receipt.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

// Over the 20,000,000đ second-eye threshold, on the min=1 step=100000 lattice
// the fee input requires (25000001 − 1 = 25,000,000 = 250 × 100000).
const OVER_THRESHOLD_FEE = '25000001';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P1-09 journey — giám sát bất thường tài chính (phiếu vượt ngưỡng)', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const studentName = `E2E P1-09 Student ${runId}`;
  const parentPhone = randomVnPhone();

  test('a large approved receipt is flagged by the recon worker and surfaces on Đối soát', async ({
    browser,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    // A sale drafts a receipt over the threshold; a GĐĐT (second-eye) approves
    // it — the only approver allowed above the threshold.
    const { receiptId } = await provisionStudentViaReceipt(browser, {
      facilityId,
      classCode: seeded.code,
      studentName,
      parentPhone,
      feeVnd: OVER_THRESHOLD_FEE,
      approverRole: 'giam_doc_dao_tao',
      runId,
    });

    // A director opens the reconciliation screen. The deep link to this exact
    // receipt is the discriminator — other runs' flags may share the page.
    const reviewerContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const reviewerPage = await reviewerContext.newPage();
    await reviewerContext.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId: `e2e-p109-gdkd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId }),
      ),
    );
    await reviewerPage.goto('/cockpit');
    await menuNav(reviewerPage, 'Tài chính & Điều hành', 'Đối soát', { role: 'giam_doc_kinh_doanh' });
    await expect(reviewerPage).toHaveURL(/\/ops\/recon/);

    const flagLink = reviewerPage.locator(`a[href*="${receiptId}"]`);

    // FALSIFICATION: the worker has not run, so this receipt is not yet flagged.
    await expect(flagLink).toHaveCount(0);

    // Run the real reconciliation worker once.
    const result = await runReconcileFinanceFlagsOnce();
    expect(result.flagsCreated).toBeGreaterThan(0);

    // Reload — the anomaly now shows, labelled and linked to this receipt.
    await reviewerPage.reload();
    await expect(flagLink).toBeVisible();
    // The label, scoped to THIS receipt's card. Every match is an ancestor of
    // this receipt's link that also contains the label text; the only one that
    // could hold a DIFFERENT card's label is the page-level list wrapper, which
    // is the outermost — so `.last()` (the innermost) is this receipt's own
    // card. That proves the flag is the exceeds-threshold kind AND belongs to
    // this receipt, not merely that some exceeds-threshold flag exists. (A bare
    // getByText would also match the hidden kind-filter options.)
    const flagCard = reviewerPage
      .locator('div')
      .filter({ has: flagLink })
      .filter({ hasText: 'Vượt ngưỡng phê duyệt' });
    await expect(flagCard.last()).toBeVisible();

    await reviewerContext.close();
  });
});

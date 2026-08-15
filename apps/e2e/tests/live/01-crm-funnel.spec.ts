// 01-crm-funnel — REAL-ENVIRONMENT CRM funnel (admin ERP, role: sale).
//
// P1-01: a real sale drives the real CRM pipeline on /crm — creates an
// opportunity (O1_LEAD) through the "Thêm cơ hội" dialog and advances it
// O1 → O2 → O3 → O4_TESTED with three real "Chuyển lên" clicks (the
// opportunityAdvance state machine rejects non-adjacent jumps server-side,
// so three clicks landing on O4 is the proof). The contact name + phone are
// recorded to the shared run state so 02-receipt-approve-enroll can create
// the receipt from THIS opportunity ("Ghi danh" → /finance/new).

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { updateLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
  runId,
  freshParentPhone,
} from './live-spec-utils.js';

const scratch = newScratch();

function escapeRegExp(value: string): string {
  return value.replace(/([^a-zA-Z0-9 ])/g, '\\$1');
}

test.describe('01-crm-funnel — sale drives an opportunity O1 → O4 on the CRM pipeline', () => {
  test('sale creates a lead on /crm and advances it to O4_TESTED with real clicks', async ({ browser }) => {
    const contactName = 'Live Lead ' + runId();
    const contactPhone = freshParentPhone();

    const session = await openStaffSession(browser, 'sale');
    attachErrors(session.page, scratch);
    try {
      await menuNav(session.page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
      await expect(session.page).toHaveURL(/\/crm$/);

      // --- create the lead (O1_LEAD) ---
      await session.page.getByRole('button', { name: 'Thêm cơ hội' }).click();
      await session.page.getByLabel('Họ tên').fill(contactName);
      await session.page.getByLabel('Số điện thoại').fill(contactPhone);
      await session.page.getByRole('button', { name: 'Tạo', exact: true }).click();
      await expect(session.page.getByText(contactName)).toBeVisible();
      await assertNoErrors(session.page, scratch.collectors[0]!, 'create lead O1');

      // --- advance O1 → O2 → O3 → O4_TESTED, one real click at a time ---
      // The card shell is role="button" whose accessible name includes the
      // contact; the real action buttons inside it match exact:true.
      const contactCardName = new RegExp('^' + escapeRegExp(contactName));
      for (let step = 0; step < 3; step += 1) {
        const card = session.page.getByRole('button', { name: contactCardName });
        const advance = card.getByRole('button', { name: 'Chuyển lên', exact: true });
        await expect(advance).toBeVisible();
        await advance.click();
        await expect(session.page.getByText(contactName)).toBeVisible();
      }

      // O4_TESTED renders the card's "Ghi danh" button — its visibility IS the
      // proof all three one-step advances landed exactly on stage.
      const card = session.page.getByRole('button', { name: contactCardName });
      await expect(card.getByRole('button', { name: 'Ghi danh', exact: true })).toBeVisible();
      await assertNoErrors(session.page, scratch.collectors[0]!, 'advance O1→O4');

      // Record for the next spec (receipt from THIS opportunity).
      updateLiveState((state) => {
        state.contactName = contactName;
        state.parentPhone = contactPhone;
      });
      recordCreated(scratch, 'opportunity', 'lead name (→ student name)', contactName);
      recordCreated(scratch, 'opportunity', 'lead phone', contactPhone);
    } finally {
      await closeRoleSession(session);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});

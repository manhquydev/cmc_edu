// 05-audit-log — REAL-ENVIRONMENT audit visibility (admin ERP, super_admin).
//
// ADM-04 on live: opens the real Nhật ký hệ thống (/admin/audit-log) and
// proves the campaign's earlier actions are visible to the auditor:
//   - filter by action 'user.updateRoles' → a row appears (spec 00's staff
//     creation writes user.updateRoles/user.resetPassword, actor = super admin);
//   - when 02 ran, filter by action 'finance.receiptApprove' → a row appears
//     (the money chain's approval is audited).
// The audit.list query is newest-first and NOT facility-scoped, so the action
// filter is what isolates the campaign's entries from any other activity.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { readLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  assertNoErrors,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('05-audit-log — the audit log lists the campaign actions', () => {
  test('super admin filters the audit log by action and sees the campaign\'s entries', async ({ browser }) => {
    const session = await openStaffSession(browser, 'superAdmin');
    attachErrors(session.page, scratch);
    try {
      await menuNav(session.page, 'Quản trị', 'Nhật ký hệ thống', { role: 'super_admin' });
      await expect(session.page).toHaveURL(/\/admin\/audit-log/);

      // 1. Guaranteed by 00-setup-roles: staff creation is audited.
      await session.page.getByLabel('Loại việc').fill('user.updateRoles');
      await expect(session.page.getByRole('row', { name: /user\.updateRoles/ }).first()).toBeVisible();
      await assertNoErrors(session.page, scratch.collectors[0]!, 'audit filter user.updateRoles');

      // 2. When 02 ran, the receipt approval trail must be visible too.
      const state = readLiveState();
      if (state.receiptCode) {
        await session.page.getByLabel('Loại việc').fill('finance.receiptApprove');
        await expect(session.page.getByRole('row', { name: /finance\.receiptApprove/ }).first()).toBeVisible();
        await assertNoErrors(session.page, scratch.collectors[0]!, 'audit filter finance.receiptApprove');
      } else {
        // eslint-disable-next-line no-console
        console.log('[05-audit-log] 02 did not run — skipping the receiptApprove audit assertion');
      }
    } finally {
      await closeRoleSession(session);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});

// 00-setup-roles — REAL-ENVIRONMENT campaign bootstrap (admin ERP).
//
// What this spec does (all on https://erp.clawcmc.io.vn):
//   1. Opens a super-admin session: reuses the persisted 8h session cookie,
//      or performs the REAL UI login — the FIRST super-admin login ever
//      (nobody has logged into the fresh cmc_prod yet) is forced through
//      /change-password; live-auth persists the rotated password + cookie to
//      apps/e2e/.live-credentials.json so reruns never re-rotate.
//   2. Creates the 4 staff accounts the campaign's roles need — sale /
//      giam_doc_kinh_doanh / giam_doc_dao_tao / giao_vien — through the real
//      canonical /hr/staff/new create form, each with a temp password (first
//      login of each role then rotates it, handled by live-auth in the later
//      specs).
//
// Pacing: this is the ONLY spec that may perform the bootstrap login; later
// specs reuse the saved cookie or the rotated password. rotateRun() at the
// start gives every campaign run a fresh runId → fresh emails → no AppUser
// unique collisions on reruns.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { openStaffPage, createStaffInForm } from '../../src/live/live-ui.js';
import { updateCredentialsFile } from '../../src/live/live-credentials.js';
import { rotateRun, updateLiveState, liveRunId } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
  staffIdentity,
  staffFullName,
  STAFF_ROLES,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('00-setup-roles — bootstrap super admin + create the 4 staff accounts', () => {
  test.beforeAll(() => {
    // Fresh run identity for this campaign (fresh emails/names, no collisions).
    rotateRun();
  });

  test('super admin logs in (forced rotation on the very first login) and creates sale/GĐKD/GĐĐT/GV via the canonical /hr/staff surface', async ({
    browser,
  }) => {
    const session = await openStaffSession(browser, 'superAdmin');
    attachErrors(session.page, scratch);
    try {
      await openStaffPage(session.page);
      await expect(session.page).toHaveURL(/\/hr\/staff/);

      const rid = liveRunId();
      for (const spec of STAFF_ROLES) {
        const identity = staffIdentity(spec.key);
        const fullName = staffFullName(spec.key);

        // Create through the dedicated /hr/staff/new form; create-success
        // navigates (replace) to the created profile URL.
        await session.page.goto('/hr/staff/new');
        await createStaffInForm(session.page, {
          userId: identity.userId,
          fullName,
          email: identity.email,
          role: spec.role,
          position: spec.position,
          tempPassword: identity.tempPassword,
        });

        // Persist the account so later specs can log in (temp password →
        // rotation on their first login) and the coordinator can clean up.
        updateCredentialsFile((file) => {
          file.staff[spec.key] = {
            email: identity.email,
            password: identity.tempPassword,
            userId: identity.userId,
            changedAt: new Date().toISOString(),
          };
        });
        updateLiveState((state) => {
          state.staffUserIds ??= {};
          state.staffUserIds![spec.key] = identity.userId;
        });
        recordCreated(scratch, 'staff-account', spec.key + ' email', identity.email);
        recordCreated(scratch, 'staff-account', spec.key + ' userId', identity.userId);

        // eslint-disable-next-line no-console
        console.log('[00-setup-roles] created ' + spec.key + ' (' + identity.email + ', run ' + rid + ')');
      }

      await assertNoErrors(session.page, scratch.collectors[0]!, 'create 4 staff accounts');
    } finally {
      await closeRoleSession(session);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});

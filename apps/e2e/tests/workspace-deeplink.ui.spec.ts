// Phase 4: workspace deep-link hydrate (session-evidence; grading/payroll covered by unit).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../src/session-injection.js';
import { seedClassBatch } from '../src/db.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const ADMIN_ORIGIN = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('workspace deep-link hydrate (Phase 4)', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  test('session-evidence URL hydrates class + session selectors', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    const { classBatchId, code, sessionIds } = await seedClassBatch({ facilityId });
    const sessionId = sessionIds[0]!;

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-ev-dl-${runId}`,
          roles: ['giao_vien'],
          facilityId,
        }),
      ),
    );

    await page.goto(
      `/teaching/session-evidence?classBatchId=${classBatchId}&sessionId=${sessionId}`,
    );

    await expect(page.getByText(new RegExp(code)).first()).toBeVisible();
    await expect(page.getByLabel('Tóm tắt buổi học')).toBeVisible();
    await context.close();
  });
});

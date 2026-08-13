// P2-09 — Xếp dãy bài cho lớp. UI already ships at
// /teaching/classes/:classBatchId/exercise-sequence. This spec proves GĐĐT
// can open that screen for a real class. It does not freeze a sequence
// (library picker + save is a longer path covered by RTL).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedClassBatch } from '../../src/db.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P2-09 journey — xếp dãy bài cho lớp', () => {
  const runId = randomUUID().slice(0, 8);
  let classBatchId = '';

  test.beforeAll(async () => {
    const seeded = await seedClassBatch({
      facilityId,
      courseName: `E2E P2-09 ${runId}`,
    });
    classBatchId = seeded.classBatchId;
  });

  test('GĐĐT opens the class sequence workspace', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p209-gddt-${runId}`,
          roles: ['giam_doc_dao_tao'],
          facilityId,
        }),
      ),
    );

    await page.goto(`/teaching/classes/${classBatchId}/exercise-sequence`);
    await expect(page.getByRole('heading', { name: 'Xếp dãy bài' })).toBeVisible();
    await context.close();
  });
});

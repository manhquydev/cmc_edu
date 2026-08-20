// Phase 1 relational hops — session attendance → student, session class →
// class, class teacher → staff. Asserts the RecordLink href, not a full
// click-through. Seeds via existing e2e helpers; dual-gate roster needs a
// stamped unit + covering range or GĐĐT sees an empty attendance list.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { withFacility } from '@cmc/db';

import { mintStaffCookie } from '../../src/session-injection.js';
import {
  getDb,
  seedActiveEnrollment,
  seedAppUser,
  seedClassBatch,
  seedPresentAttendance,
} from '../../src/db.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const ADMIN_ORIGIN = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('relational hops', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  test('session and class overview expose student, class, and staff links', async ({
    browser,
  }) => {
    const runId = randomUUID().slice(0, 8);
    const teacherName = `E2E Rel Teacher ${runId}`;
    const studentName = `E2E Rel Student ${runId}`;

    const teacher = await seedAppUser({
      facilityId,
      userId: `e2e-rel-teacher-${runId}`,
      fullName: teacherName,
      roles: ['giao_vien'],
    });
    const { classBatchId, sessionIds } = await seedClassBatch({
      facilityId,
      teacherAppUserId: teacher.id,
    });
    const sessionId = sessionIds[0]!;
    const { enrollmentId, studentId } = await seedActiveEnrollment({
      facilityId,
      classBatchId,
      studentName,
    });
    await seedPresentAttendance({
      facilityId,
      classSessionId: sessionId,
      enrollmentId,
      studentId,
    });

    await withFacility(
      getDb(),
      null,
      async (tx) => {
        const unit = await tx.curriculumUnit.findFirst({
          where: { program: 'UCREA' },
          select: { id: true, orderGlobal: true },
        });
        if (!unit) {
          throw new Error('relational hops: no UCREA curriculum unit to stamp the session.');
        }
        await tx.classSession.update({
          where: { id: sessionId },
          data: { curriculumUnitId: unit.id },
        });
        await tx.enrollmentUnitRange.create({
          data: {
            facilityId,
            enrollmentId,
            fromOrderGlobal: unit.orderGlobal,
            toOrderGlobal: unit.orderGlobal,
          },
        });
      },
      { bypass: true },
    );

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-rel-gddt-${runId}`,
          roles: ['giam_doc_dao_tao'],
          facilityId,
        }),
      ),
    );

    await page.goto(`/teaching/sessions/${sessionId}?tab=attendance`);
    const studentLink = page.locator(`a[href="/admin/students/${studentId}"]`);
    await expect(studentLink).toBeVisible();

    await page.goto(`/teaching/sessions/${sessionId}?tab=overview`);
    const classLink = page.locator(`a[href="/admin/classes/${classBatchId}"]`);
    await expect(classLink).toBeVisible();

    await page.goto(`/admin/classes/${classBatchId}/overview`);
    const teacherLink = page.locator(`a[href="/hr/staff/${teacher.id}"]`);
    await expect(teacherLink).toBeVisible();

    await context.close();
  });
});

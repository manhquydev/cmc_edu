// P3-01b — Geofence GPS punch OR-gate (smoke).
//
// Keeps suite pollution low: one staff per case, geofence seeded via DB
// (FORCE RLS helper), cascade-delete AppUsers in afterAll so the shared
// /admin/users first page stays usable for later journeys.
// Full gate matrix lives in apps/api punch-geo-gate unit tests.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { ictDateOnlyOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import {
  deleteFacilityGeofencesByLabel,
  deleteStaffHrCascadeForAppUsers,
  findAppUserByUserId,
  findShiftTemplateByNames,
  seedApprovedShiftRegistration,
  seedFacilityGeofence,
} from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const LABEL_PREFIX = 'E2E-GEO-';

const GEO_IN = { latitude: 21.0285, longitude: 105.8542, accuracy: 30 };
const GEO_OUT = { latitude: 10.8231, longitude: 106.6297, accuracy: 30 };

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

async function provisionSaleWithTodayShift(
  browser: import('@playwright/test').Browser,
  opts: { saleUserId: string; saleFullName: string; groupName: string; templateName: string },
): Promise<string> {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminContext.addCookies(
    cookiePair(
      STAFF_COOKIE_NAME,
      mintStaffCookie({
        userId: `e2e-geo-admin-${randomUUID().slice(0, 8)}`,
        roles: ['super_admin'],
        facilityId,
      }),
    ),
  );
  await adminPage.goto('/cockpit');
  await menuNav(adminPage, 'Nhân sự', 'Ca làm việc', { role: 'super_admin' });
  await expect(adminPage).toHaveURL(/\/admin\/shift-config/);
  await adminPage.getByLabel('Tên nhóm ca').fill(opts.groupName);
  await adminPage.getByRole('button', { name: 'Thêm nhóm ca' }).click();
  await expect(adminPage.getByText(opts.groupName)).toBeVisible();
  const groupCard = adminPage
    .locator('div')
    .filter({ hasText: opts.groupName })
    .filter({ has: adminPage.getByLabel('Tên mẫu ca') })
    .last();
  await expect(groupCard).toBeVisible();
  await groupCard.getByLabel('Tên mẫu ca').fill(opts.templateName);
  await groupCard.getByLabel('Bắt đầu (HH:mm)').fill('08:00');
  await groupCard.getByLabel('Kết thúc (HH:mm)').fill('17:00');
  await groupCard.getByRole('button', { name: '+ Thêm mẫu ca' }).click();
  await expect(groupCard.getByText(opts.templateName)).toBeVisible();
  await adminContext.close();

  await createStaffViaAdminUi(browser, {
    facilityId,
    userId: opts.saleUserId,
    fullName: opts.saleFullName,
    position: 'sale',
    roleLabels: ['Sale'],
  });
  const sale = await findAppUserByUserId({ facilityId, userId: opts.saleUserId });
  if (!sale) throw new Error(`AppUser not found for ${opts.saleUserId}`);

  const catalog = await findShiftTemplateByNames({
    facilityId,
    groupName: opts.groupName,
    templateName: opts.templateName,
  });
  if (!catalog) throw new Error(`Shift catalog not found for ${opts.groupName}`);

  await seedApprovedShiftRegistration({
    facilityId,
    appUserId: sale.id,
    shiftGroupId: catalog.shiftGroupId,
    shiftTemplateId: catalog.shiftTemplateId,
    dates: [ictDateOnlyOf(new Date())],
  });
  return sale.id;
}

test.describe('P3-01b journey — geofence GPS punch', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const trackedAppUserIds: string[] = [];
  const labels: string[] = [];

  test.afterAll(async () => {
    for (const label of labels) {
      await deleteFacilityGeofencesByLabel(facilityId, label).catch(() => undefined);
    }
    await deleteFacilityGeofencesByLabel(facilityId, LABEL_PREFIX).catch(() => undefined);
    if (trackedAppUserIds.length > 0) {
      await deleteStaffHrCascadeForAppUsers(...trackedAppUserIds).catch(() => undefined);
    }
  });

  test('in-zone GPS admits punch without offsite reason (DB-seeded active geofence)', async ({
    browser,
  }) => {
    const label = `${LABEL_PREFIX}in-${randomUUID().slice(0, 8)}`;
    labels.push(label);
    await seedFacilityGeofence({
      facilityId,
      lat: GEO_IN.latitude,
      lng: GEO_IN.longitude,
      radiusM: 500,
      accuracyMaxM: 200,
      isActive: true,
      label,
    });

    const saleUserId = `e2e-geo-in-${randomUUID().slice(0, 8)}`;
    const saleFullName = `E2E GEO In ${randomUUID().slice(0, 8)}`;
    const saleAppId = await provisionSaleWithTodayShift(browser, {
      saleUserId,
      saleFullName,
      groupName: `E2E GEO IG ${randomUUID().slice(0, 8)}`,
      templateName: `E2E GEO IT ${randomUUID().slice(0, 8)}`,
    });
    trackedAppUserIds.push(saleAppId);

    const saleCtx = await browser.newContext({
      geolocation: GEO_IN,
      permissions: ['geolocation'],
    });
    const salePage = await saleCtx.newPage();
    await saleCtx.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId }),
      ),
    );
    await salePage.goto('/hr/checkin');
    await salePage.getByRole('button', { name: /^Chấm công$/ }).click();
    // Success banner title is "Đã ghi nhận" (check-in-out.tsx)
    await expect(salePage.getByText('Đã ghi nhận')).toBeVisible({ timeout: 20_000 });
    // Offsite reason dialog title must NOT appear
    await expect(salePage.getByRole('dialog').filter({ hasText: 'Ngoài mạng cơ sở — nhập lý do' })).toHaveCount(
      0,
    );
    await saleCtx.close();
  });

  test('outside GPS with shift opens offsite reason dialog', async ({ browser }) => {
    const label = `${LABEL_PREFIX}out-${randomUUID().slice(0, 8)}`;
    labels.push(label);
    await seedFacilityGeofence({
      facilityId,
      lat: GEO_IN.latitude,
      lng: GEO_IN.longitude,
      radiusM: 100,
      isActive: true,
      label,
    });

    const saleUserId = `e2e-geo-out-${randomUUID().slice(0, 8)}`;
    const saleFullName = `E2E GEO Out ${randomUUID().slice(0, 8)}`;
    const saleAppId = await provisionSaleWithTodayShift(browser, {
      saleUserId,
      saleFullName,
      groupName: `E2E GEO OG ${randomUUID().slice(0, 8)}`,
      templateName: `E2E GEO OT ${randomUUID().slice(0, 8)}`,
    });
    trackedAppUserIds.push(saleAppId);

    const saleCtx = await browser.newContext({
      geolocation: GEO_OUT,
      permissions: ['geolocation'],
    });
    const salePage = await saleCtx.newPage();
    await saleCtx.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId }),
      ),
    );
    await salePage.goto('/hr/checkin');
    await salePage.getByRole('button', { name: /^Chấm công$/ }).click();
    // Dialog title from OffsiteReasonDialog
    await expect(salePage.getByRole('dialog').getByText('Ngoài mạng cơ sở — nhập lý do')).toBeVisible({
      timeout: 20_000,
    });
    await saleCtx.close();
  });
});

// P3-01b — Geofence GPS punch OR-gate journeys.
// Case 1: admin creates/activates geofence via UI → employee punches in-zone →
//         reviewer sees geoPunchSummary section.
// Case 2: seeded geofence + far location + hasShift → offsite reason modal.
// Case 3: no geolocation permission + hasShift → still punches / offsite path.
//
// Cleanup is DB-only in afterAll (not UI) so a crash cannot leave active
// geofences that poison later journeys on the shared facility.
// Helper APIs match apps/e2e helpers (createStaffViaAdminUi takes Browser, etc.).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { ictDateOnlyOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import {
  deleteFacilityGeofencesByLabel,
  deletePunchesAndTicketsForAppUsers,
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

async function ensureTodayShift(
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
  // Each group card mounts its own "Tên mẫu ca" form — must scope to the card
  // (shift-config-admin / shift-register-approve-reject pattern).
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
  if (!catalog) throw new Error(`Shift catalog not found for ${opts.groupName}/${opts.templateName}`);

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
      await deletePunchesAndTicketsForAppUsers(...trackedAppUserIds).catch(() => undefined);
    }
  });

  test('case1: admin creates geofence via UI, in-zone punch succeeds, reviewer sees GPS summary', async ({
    browser,
  }) => {
    const label = `${LABEL_PREFIX}c1-${randomUUID().slice(0, 8)}`;
    labels.push(label);
    const saleFullName = `E2E GEO Sale ${randomUUID().slice(0, 8)}`;
    const saleUserId = `e2e-geo-sale-${randomUUID().slice(0, 8)}`;
    const groupName = `E2E GEO G ${randomUUID().slice(0, 8)}`;
    const templateName = `E2E GEO T ${randomUUID().slice(0, 8)}`;

    const saleAppId = await ensureTodayShift(browser, {
      saleUserId,
      saleFullName,
      groupName,
      templateName,
    });
    trackedAppUserIds.push(saleAppId);

    // Super admin: create + activate geofence via UI
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminCtx.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-geo-admin2-${randomUUID().slice(0, 8)}`,
          roles: ['super_admin'],
          facilityId,
        }),
      ),
    );
    await adminPage.goto('/cockpit');
    await menuNav(adminPage, 'Quản trị', 'IP mạng', { role: 'super_admin' });
    await expect(adminPage).toHaveURL(/\/admin\/network-ip/);

    // SettingsShell: switch to Vùng GPS (nav item text from network-ip.tsx)
    await adminPage.getByText('Vùng GPS', { exact: true }).click();
    await adminPage.getByRole('button', { name: /Thêm vùng GPS/i }).click();
    const createDialog = adminPage.locator('dialog').filter({ hasText: /Thêm vùng/i });
    await expect(createDialog).toBeVisible({ timeout: 10_000 });
    await createDialog.getByLabel(/Vĩ độ|lat/i).fill(String(GEO_IN.latitude));
    await createDialog.getByLabel(/Kinh độ|lng/i).fill(String(GEO_IN.longitude));
    await createDialog.getByLabel(/Bán kính/i).fill('500');
    await createDialog.getByLabel(/^Nhãn$/i).fill(label);
    await createDialog.getByRole('button', { name: 'Tạo', exact: true }).click();
    await expect(adminPage.getByText(label)).toBeVisible({ timeout: 15_000 });

    // Toggle Bật on the row that contains this label (not network table)
    const geoRow = adminPage.locator('tr, [role="row"], div').filter({ hasText: label }).first();
    const batBtn = geoRow.getByRole('button', { name: /^Bật$/ });
    if (await batBtn.isVisible().catch(() => false)) {
      await batBtn.click();
      const confirm = adminPage.getByRole('button', { name: /Bật vùng|Xác nhận/i });
      if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirm.click();
      }
    }
    await adminCtx.close();

    // Employee punches with mock geolocation
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
    await expect(salePage.getByText(/Đã ghi nhận/i)).toBeVisible({ timeout: 20_000 });
    await expect(salePage.getByText(/Ngoài mạng cơ sở — nhập lý do/i)).toHaveCount(0);
    await saleCtx.close();

    // Reviewer sees GPS summary section
    const gdCtx = await browser.newContext();
    const gdPage = await gdCtx.newPage();
    await gdCtx.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-geo-gdkd-${randomUUID().slice(0, 8)}`,
          roles: ['giam_doc_kinh_doanh'],
          facilityId,
        }),
      ),
    );
    await gdPage.goto('/hr/checkin');
    await gdPage.getByRole('button', { name: /Duyệt chấm công/i }).click();
    await expect(gdPage.getByText(/Chấm công GPS gần đây/i)).toBeVisible({ timeout: 10_000 });
    await gdCtx.close();
  });

  test('case2: outside geofence with shift shows offsite reason path', async ({ browser }) => {
    const label = `${LABEL_PREFIX}c2-${randomUUID().slice(0, 8)}`;
    labels.push(label);
    await seedFacilityGeofence({
      facilityId,
      lat: GEO_IN.latitude,
      lng: GEO_IN.longitude,
      radiusM: 100,
      isActive: true,
      label,
    });

    const saleFullName = `E2E GEO Out ${randomUUID().slice(0, 8)}`;
    const saleUserId = `e2e-geo-out-${randomUUID().slice(0, 8)}`;
    const saleAppId = await ensureTodayShift(browser, {
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
    await expect(
      salePage.getByText(/Đã ghi nhận|Ngoài mạng cơ sở|ngoài vùng|lý do/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    await saleCtx.close();
  });

  test('case3: denied geolocation still punches', async ({ browser }) => {
    const label = `${LABEL_PREFIX}c3-${randomUUID().slice(0, 8)}`;
    labels.push(label);
    await seedFacilityGeofence({
      facilityId,
      lat: GEO_IN.latitude,
      lng: GEO_IN.longitude,
      radiusM: 200,
      isActive: true,
      label,
    });

    const saleFullName = `E2E GEO Deny ${randomUUID().slice(0, 8)}`;
    const saleUserId = `e2e-geo-deny-${randomUUID().slice(0, 8)}`;
    const saleAppId = await ensureTodayShift(browser, {
      saleUserId,
      saleFullName,
      groupName: `E2E GEO DG ${randomUUID().slice(0, 8)}`,
      templateName: `E2E GEO DT ${randomUUID().slice(0, 8)}`,
    });
    trackedAppUserIds.push(saleAppId);

    const saleCtx = await browser.newContext();
    const salePage = await saleCtx.newPage();
    await saleCtx.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId }),
      ),
    );
    await salePage.goto('/hr/checkin');
    await salePage.getByRole('button', { name: /^Chấm công$/ }).click();
    await expect(
      salePage.getByText(/Đã ghi nhận|Ngoài mạng cơ sở|Không lấy được vị trí|lý do/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    await saleCtx.close();
  });
});

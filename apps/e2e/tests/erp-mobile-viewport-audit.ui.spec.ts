import { test, expect, type TestInfo, type ViewportSize } from '@playwright/test';

import { mintStaffCookie } from '../src/session-injection.js';
import { seedAppUser } from '../src/db.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';
import { ACTIVE_ROLES, can, type Role } from '@cmc/auth';
import { collectMobileViewportAudit } from '../src/mobile-viewport-audit.js';
import { buildErpMobileRouteAudit, visibleNavigationForRole } from '../src/erp-mobile-route-audit.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const ADMIN_ORIGIN = 'http://localhost:4173';
const REQUIRED_SHELL_CONTROLS = [
  'button[aria-label="Mở app switcher"]',
  'button[aria-label="Tìm (⌘K)"]',
  'button[aria-label="Đăng xuất"]',
] as const;

function cookiePair(value: string) {
  return [
    { name: STAFF_COOKIE_NAME, value, domain: '127.0.0.1', path: '/' },
    { name: STAFF_COOKIE_NAME, value, domain: 'localhost', path: '/' },
  ];
}

function projectViewport(testInfo: TestInfo): ViewportSize {
  const viewport = testInfo.project.use.viewport;
  if (
    !viewport ||
    typeof viewport !== 'object' ||
    typeof viewport.width !== 'number' ||
    typeof viewport.height !== 'number' ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    throw new Error(`ERP mobile audit project ${testInfo.project.name} requires an explicit positive viewport`);
  }

  return { width: viewport.width, height: viewport.height };
}

function requiredShellControls(role: Role): readonly string[] {
  return can({ userId: 'erp-mobile-audit', roles: [role] }, 'finance', 'receiptCreate')
    ? [...REQUIRED_SHELL_CONTROLS, 'button[aria-label="Ghi danh"]']
    : REQUIRED_SHELL_CONTROLS;
}

test.describe('ERP mobile viewport baseline audit', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  for (const role of ACTIVE_ROLES) {
    test(`captures shell baseline for ${role}`, async ({ browser }, testInfo) => {
      const userId = `erp-mobile-audit-${role}`;
      await seedAppUser({ facilityId, userId, roles: [role], position: role });

      const context = await browser.newContext({
        baseURL: ADMIN_ORIGIN,
        viewport: projectViewport(testInfo),
      });
      await context.addCookies(
        cookiePair(mintStaffCookie({ userId, roles: [role as Role], facilityId })),
      );
      const page = await context.newPage();
      await page.goto('/cockpit');

      await expect(page.getByRole('main')).toBeVisible();
      const visibleNav = visibleNavigationForRole(role);
      const metrics = await collectMobileViewportAudit(page, {
        requiredControls: requiredShellControls(role),
      });
      const routeAudit = buildErpMobileRouteAudit().filter((entry) => entry.role === role);

      await testInfo.attach('erp-mobile-viewport-baseline.json', {
        body: JSON.stringify(
          {
            role,
            visibleNavigation: visibleNav.map((entry) => ({
              moduleId: entry.module.id,
              declaredLandingPath: entry.declaredLandingPath,
              recommendedLandingPath: entry.recommendedLandingPath,
              landingStatus: entry.landingStatus,
              children: entry.children.map((child) => child.path),
            })),
            metrics,
            routeAudit,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });

      await context.close();
    });
  }
});

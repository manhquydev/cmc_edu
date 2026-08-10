import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTIVE_ROLES } from '@cmc/auth';

import { scanAdminUiRoutesDetailed } from '../../../scripts/acceptance-report/scanners/route-scanner.js';
import { buildErpMobileRouteAudit, visibleNavigationForRole } from './erp-mobile-route-audit.js';

test('uses the first permitted child as the module landing when the declared landing is forbidden', () => {
  const finance = visibleNavigationForRole('sale').find((entry) => entry.module.id === 'finance-ops');

  assert.equal(finance?.declaredLandingPath, '/finance');
  assert.equal(finance?.recommendedLandingPath, '/crm');
  assert.equal(finance?.landingStatus, 'requires-shell-landing-resolution');
  assert.ok(finance?.children.some((child) => child.path === '/crm'));
  assert.ok(!finance?.children.some((child) => child.path === '/finance'));

  const row = buildErpMobileRouteAudit().find(
    (entry) => entry.role === 'sale' && entry.moduleId === 'finance-ops' && entry.source === 'module-landing',
  );
  assert.equal(row?.accessExpectation, 'needs-product-decision');
  assert.equal(row?.disposition, 'unsafe-module-landing');
});

test('keeps super_admin as an explicit mobile-audit role and resolves its admin module to a real child', () => {
  const admin = visibleNavigationForRole('super_admin').find((entry) => entry.module.id === 'admin');

  assert.equal(admin?.recommendedLandingPath, '/admin/users');

  const rows = buildErpMobileRouteAudit();
  assert.ok(rows.some((entry) => entry.role === 'super_admin' && entry.roleAuthorization === 'super-admin-bypass'));
});

test('records every supported role and never treats an unresolved direct link as captured success', () => {
  const rows = buildErpMobileRouteAudit();
  assert.deepEqual(
    new Set(rows.map((entry) => entry.role)),
    new Set(ACTIVE_ROLES),
  );

  const receiptCreate = rows.find(
    (entry) => entry.role === 'sale' && entry.path === '/finance/new' && entry.source === 'direct-link',
  );
  assert.equal(receiptCreate?.accessExpectation, 'needs-product-decision');
  assert.equal(receiptCreate?.disposition, 'unresolved-direct-link');
  assert.equal(receiptCreate?.fixtureStatus, 'unresolved-direct-link');
  assert.equal(receiptCreate?.evidenceStatus, 'policy-required');
});

test('emits route and fixture evidence for every Admin route-role pair', () => {
  const routes = scanAdminUiRoutesDetailed();
  const rows = buildErpMobileRouteAudit(routes);

  for (const role of ACTIVE_ROLES) {
    for (const path of routes.keys()) {
      assert.ok(
        rows.some((entry) => entry.role === role && entry.path === path),
        `missing ${role} × ${path} audit row`,
      );
    }
  }

  for (const path of [...routes.keys()].filter((entry) => entry.includes(':'))) {
    for (const role of ACTIVE_ROLES) {
      const directLink = rows.find(
        (entry) => entry.role === role && entry.path === path && entry.source === 'direct-link',
      );
      assert.equal(directLink?.fixtureStatus, 'needs-journey-fixture');
      assert.equal(directLink?.evidenceStatus, 'fixture-required');
    }
  }
});

test('classifies the dynamic Go resolver as redirect policy but leaves its direct link unresolved', () => {
  const rows = buildErpMobileRouteAudit();
  const goResolver = rows.find(
    (entry) => entry.role === 'sale' && entry.path === '/go/:entity/:id' && entry.source === 'direct-link',
  );

  assert.equal(goResolver?.routeKind, 'dynamic-redirect');
  assert.equal(goResolver?.redirectPolicy, 'entity-resolved');
  assert.equal(goResolver?.accessExpectation, 'needs-product-decision');
  assert.equal(goResolver?.disposition, 'redirect-policy');
  assert.equal(goResolver?.fixtureStatus, 'needs-journey-fixture');
  assert.equal(goResolver?.evidenceStatus, 'fixture-required');
});

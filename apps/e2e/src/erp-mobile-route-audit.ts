import { ACTIVE_ROLES, can, type Role } from '@cmc/auth';

import { scanAdminUiRoutesDetailed, type UiRouteInfo, type UiRouteKind } from '../../../scripts/acceptance-report/scanners/route-scanner.js';
import { scanNavModules, type ScannedNavChild, type ScannedNavModule } from './scan-nav-entries.js';

export type ErpAuditAccessExpectation =
  | 'authorized'
  | 'redirect'
  | 'placeholder'
  | 'needs-product-decision';

export type ErpAuditSource = 'module-landing' | 'navigation-child' | 'direct-link';

export type ErpAuditDisposition =
  | 'navigation-expected'
  | 'redirect-policy'
  | 'placeholder'
  | 'unsafe-module-landing'
  | 'unresolved-direct-link';

export type ErpAuditFixtureStatus =
  | 'not-required'
  | 'needs-journey-fixture'
  | 'unresolved-direct-link';

export type ErpAuditEvidenceStatus =
  | 'not-captured'
  | 'fixture-required'
  | 'policy-required';

export interface ErpMobileRouteAuditRow {
  path: string;
  role: Role;
  roleAuthorization: 'registry' | 'super-admin-bypass';
  routeKind: UiRouteKind;
  accessExpectation: ErpAuditAccessExpectation;
  source: ErpAuditSource;
  disposition: ErpAuditDisposition;
  fixtureStatus: ErpAuditFixtureStatus;
  evidenceStatus: ErpAuditEvidenceStatus;
  redirectPolicy?: 'static' | 'entity-resolved';
  moduleId?: string;
  sourcePath?: string;
  declaredLandingPath?: string;
  moduleLandingStatus?: 'declared-landing-visible' | 'requires-shell-landing-resolution';
}

export interface VisibleModuleAudit {
  module: ScannedNavModule;
  children: readonly ScannedNavChild[];
  declaredLandingPath: string;
  recommendedLandingPath: string;
  landingStatus: 'declared-landing-visible' | 'requires-shell-landing-resolution';
}

function isChildVisible(role: Role, child: ScannedNavChild): boolean {
  return !child.permission || can({ userId: 'erp-mobile-audit', roles: [role] }, child.permission.module, child.permission.action);
}

/** Mirrors `visibleModulesFor` and `isNavChildVisible` over the canonical
 * registry representation parsed above. A mobile surface must consume the same
 * role and child gates; it must not invent a parallel registry. */
export function visibleNavigationForRole(
  role: Role,
  modules: readonly ScannedNavModule[] = scanNavModules(),
): VisibleModuleAudit[] {
  return modules.flatMap((module) => {
    if (module.roles?.length && !module.roles.includes(role)) return [];

    const children = module.children.filter((child) => isChildVisible(role, child));
    if (module.children.length > 0 && children.length === 0) return [];

    // Prefer the module's own permitted child. Otherwise use the first visible
    // child — this is the safe landing policy for a module such as Finance
    // where Sale can reach CRM but not the receipt-list root.
    const recommendedLandingPath =
      children.find((child) => child.path === module.path)?.path ??
      children[0]?.path ??
      module.path;

    return [{
      module,
      children,
      declaredLandingPath: module.path,
      recommendedLandingPath,
      landingStatus:
        recommendedLandingPath === module.path
          ? 'declared-landing-visible'
          : 'requires-shell-landing-resolution',
    }];
  });
}

function expectationFor(info: UiRouteInfo | undefined): ErpAuditAccessExpectation {
  if (info?.kind === 'redirect') return 'redirect';
  if (info?.kind === 'placeholder') return 'placeholder';
  if (info?.kind === 'dynamic-redirect') return 'needs-product-decision';
  return info ? 'authorized' : 'needs-product-decision';
}

const GO_RESOLVER_PATH = '/go/:entity/:id';

function auditRouteClassification(
  path: string,
  info: UiRouteInfo | undefined,
): Pick<ErpMobileRouteAuditRow, 'routeKind' | 'redirectPolicy'> {
  // Valid GoResolver inputs redirect to a target whose authorization must be
  // proved by a seeded journey. Its invalid-ID EmptyState fallback is route
  // policy, not a placeholder screen.
  if (
    path === GO_RESOLVER_PATH &&
    info?.app === 'admin' &&
    info.kind === 'dynamic-redirect' &&
    info.fallbackKind === 'invalid-id-empty-state'
  ) {
    return {
      routeKind: 'dynamic-redirect',
      redirectPolicy: 'entity-resolved',
    };
  }

  if (info?.kind === 'redirect') {
    return { routeKind: 'redirect', redirectPolicy: 'static' };
  }

  return { routeKind: info?.kind ?? 'screen' };
}

function dispositionFor(
  source: ErpAuditSource,
  routeKind: UiRouteKind,
  moduleLandingStatus?: ErpMobileRouteAuditRow['moduleLandingStatus'],
): ErpAuditDisposition {
  if (moduleLandingStatus === 'requires-shell-landing-resolution') return 'unsafe-module-landing';
  if (routeKind === 'redirect' || routeKind === 'dynamic-redirect') return 'redirect-policy';
  if (routeKind === 'placeholder') return 'placeholder';
  return source === 'direct-link' ? 'unresolved-direct-link' : 'navigation-expected';
}

function fixtureStatusFor(
  path: string,
  source: ErpAuditSource,
): ErpAuditFixtureStatus {
  if (path.includes(':')) return 'needs-journey-fixture';
  return source === 'direct-link' ? 'unresolved-direct-link' : 'not-required';
}

function row(
  path: string,
  role: Role,
  source: ErpAuditSource,
  info: UiRouteInfo | undefined,
  details: Pick<ErpMobileRouteAuditRow, 'moduleId' | 'sourcePath' | 'declaredLandingPath' | 'moduleLandingStatus'> = {},
): ErpMobileRouteAuditRow {
  const classification = auditRouteClassification(path, info);
  const expectation = classification.routeKind === 'redirect'
    ? 'redirect'
    : classification.routeKind === 'placeholder'
      ? 'placeholder'
      : expectationFor(info);
  const accessExpectation =
    details.moduleLandingStatus === 'requires-shell-landing-resolution' ||
    source === 'direct-link' && expectation === 'authorized'
      ? 'needs-product-decision'
      : expectation;
  const fixtureStatus = fixtureStatusFor(path, source);
  return {
    path,
    role,
    roleAuthorization: role === 'super_admin' ? 'super-admin-bypass' : 'registry',
    ...classification,
    accessExpectation,
    source,
    disposition: dispositionFor(source, classification.routeKind, details.moduleLandingStatus),
    fixtureStatus,
    // The matrix records expectations, not execution success. Runtime capture
    // can only promote this after it proves a non-empty, non-no-access screen.
    evidenceStatus:
      fixtureStatus === 'needs-journey-fixture'
        ? 'fixture-required'
        : fixtureStatus === 'unresolved-direct-link'
          ? 'policy-required'
          : 'not-captured',
    ...details,
  };
}

/** A complete Admin-only route × role ledger. A direct URL is deliberately
 * classified as needing a policy decision until a seeded journey proves its
 * route/action authorization; no generic no-access page can become a pass by
 * omission. */
export function buildErpMobileRouteAudit(
  routes: ReadonlyMap<string, UiRouteInfo> = scanAdminUiRoutesDetailed(),
  modules: readonly ScannedNavModule[] = scanNavModules(),
  roles: readonly Role[] = ACTIVE_ROLES,
): ErpMobileRouteAuditRow[] {
  const rows: ErpMobileRouteAuditRow[] = [];

  for (const role of roles) {
    const navigationPaths = new Set<string>();

    for (const visible of visibleNavigationForRole(role, modules)) {
      navigationPaths.add(visible.recommendedLandingPath);
      rows.push(
        row(visible.recommendedLandingPath, role, 'module-landing', routes.get(visible.recommendedLandingPath), {
          moduleId: visible.module.id,
          sourcePath: visible.recommendedLandingPath,
          declaredLandingPath: visible.declaredLandingPath,
          moduleLandingStatus: visible.landingStatus,
        }),
      );

      for (const child of visible.children) {
        navigationPaths.add(child.path);
        rows.push(
          row(child.path, role, 'navigation-child', routes.get(child.path), {
            moduleId: visible.module.id,
            sourcePath: child.path,
          }),
        );
      }
    }

    for (const [path, info] of routes) {
      if (!navigationPaths.has(path)) rows.push(row(path, role, 'direct-link', info));
    }
  }

  return rows;
}

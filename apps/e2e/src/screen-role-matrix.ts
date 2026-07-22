// Which (screen, role) pairs the runtime capture opens.
//
// The screen axis comes from the route tree, NOT the nav registry. Those answer
// different questions: the route tree says which screens exist, the nav registry
// says who sees a menu entry. `/finance/new` — the screen where the tuition
// receipt is drafted — has no nav entry at all, so a matrix built from the menu
// would never open it, and would never have found that no business role could
// complete that flow.
//
// The role axis: for a screen with a nav entry, the roles whose menu shows it,
// plus every business role for a screen with no entry — nothing declares who is
// supposed to reach those, which is exactly why they need looking at.
//
// `super_admin` is excluded throughout: it bypasses the permission registry, so
// it can open everything and proves nothing about authorization.

import { ACTIVE_ROLES, can, type Role } from '@cmc/auth';

/** The five active roles minus `super_admin` — the ones whose access is
 *  actually decided by the registry. */
export const BUSINESS_ROLES: readonly Role[] = ACTIVE_ROLES.filter((r) => r !== 'super_admin');

/** Routes belonging to the parent/student app rather than the admin app.
 *  They must not be opened against the admin preview server: the admin router
 *  has no such routes, so the page would no-match, fire no request, and be
 *  recorded as clean — 15 screens passing for the wrong reason. */
export function isLmsRoute(routePath: string): boolean {
  return routePath === '/' || routePath === '/login' || routePath.startsWith('/parent') || routePath.startsWith('/student');
}

export interface NavEntryLike {
  path: string;
  permission?: { module: string; action: string };
}

export interface ScreenRolePair {
  path: string;
  role: Role;
  /** Whether a menu entry points at this screen — a screen with none is
   *  reachable only by typing the URL, and nothing states who may do that. */
  hasNavEntry: boolean;
  /** Route carries a `:param`, so the capture needs a real id to open it. */
  needsParam: boolean;
}

/**
 * Builds the admin-app matrix.
 *
 * `routes` is expected to come from the route scanner, never a hand-written
 * list: a screen the capture silently never opens is the worst failure mode
 * here, because the report still looks complete.
 */
export function buildScreenRoleMatrix(
  routes: Iterable<string>,
  navEntries: readonly NavEntryLike[],
  roles: readonly Role[] = BUSINESS_ROLES,
): ScreenRolePair[] {
  const navByPath = new Map(navEntries.map((entry) => [entry.path, entry]));
  const pairs: ScreenRolePair[] = [];

  for (const path of [...routes].sort()) {
    if (isLmsRoute(path)) continue;

    const navEntry = navByPath.get(path);
    const needsParam = path.includes(':');

    for (const role of roles) {
      // A screen with a menu entry is opened by the roles whose menu shows it;
      // a screen with none is opened by every business role, because no gate
      // has an opinion about who belongs there.
      if (navEntry?.permission && !can({ userId: 'matrix', roles: [role] }, navEntry.permission.module, navEntry.permission.action)) {
        continue;
      }
      pairs.push({ path, role, hasNavEntry: navEntry !== undefined, needsParam });
    }
  }

  return pairs;
}

// @vitest-environment jsdom
//
// Does every menu entry name a path the router actually serves?
//
// A nav entry naming a path no route serves fails silently: the router ends in
// `path: '*'` rendering ComingSoon, so the click looks like an unbuilt feature
// rather than a broken menu, and nothing in the app or the test suite said
// otherwise. That is how a Gắn kết module row pointing at the unrouted
// `/admin/engagement` got as far as review — no test covered this class of bug.
//
// Scope, so this is not read as more than it is: it proves REGISTRATION, not
// that a real screen sits behind the path. `/admin` and `/hr` are registered
// and pass here while their index routes render ComingSoon outright. Catching
// that needs an assertion about the element, not the path.
//
// The route side is read from the assembled `router` rather than a list written
// here, so a route file that stops being imported into the tree is caught too;
// a hand-kept copy would just agree with itself. jsdom is required because
// `createBrowserRouter` reads `window.history` at module load.
import { describe, expect, it } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { NAV_MODULES } from './nav-registry.js';
import { router } from '../routes/index.js';

/** Full URL paths the router serves. Route files use relative segments composed
 *  by their parent (`{ path: 'finance', children: financeRoutes }`), so the
 *  prefix has to be carried down the walk. */
function registeredPaths(routes: readonly RouteObject[], prefix = ''): string[] {
  const found: string[] = [];

  for (const route of routes) {
    const segment = route.path ?? '';
    const composed = segment.startsWith('/')
      ? segment
      : `${prefix}/${segment}`.replace(/\/{2,}/g, '/');
    const full = composed.replace(/\/$/, '') || '/';

    if (route.path) found.push(full);
    // An index route renders at its parent's path and adds no segment of its own.
    if (route.children) found.push(...registeredPaths(route.children, route.path ? full : prefix));
  }

  return found;
}

const NAV_PATHS = NAV_MODULES.flatMap((mod) => [
  // The module row is clickable in its own right (`side-nav` navigates to it),
  // so it needs a route just as much as the children do.
  { id: mod.id, path: mod.path },
  ...(mod.children ?? []).map((child) => ({ id: `${mod.id} › ${child.id}`, path: child.path })),
]);

describe('every nav path resolves to a registered route', () => {
  const routes = registeredPaths(router.routes);

  it('finds the route tree at all', () => {
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain('/cockpit');
  });

  it.each(NAV_PATHS)('$id → $path', ({ path }) => {
    expect(routes).toContain(path);
  });
});

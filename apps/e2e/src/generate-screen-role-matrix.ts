// Emits the (screen, role) matrix the capture spec consumes.
//
// Kept out of the spec so the matrix can be inspected and diffed on its own,
// and so the count the capture actually runs can be checked against the count
// generated here — a screen quietly missing from the run is the failure mode
// that would make the whole report untrustworthy while still looking complete.
//
// Run: pnpm --filter @cmc/e2e exec tsx src/generate-screen-role-matrix.ts

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanUiRoutes } from '../../../scripts/acceptance-report/scanners/route-scanner.js';
import { scanNavEntries } from './scan-nav-entries.js';
import { buildScreenRoleMatrix, isLmsRoute } from './screen-role-matrix.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MATRIX_PATH = path.join(here, '..', 'screen-role-matrix.json');

export function generateMatrix(): void {
  const routes = scanUiRoutes();
  const navEntries = scanNavEntries();
  const pairs = buildScreenRoleMatrix(routes, navEntries);

  const adminRoutes = [...routes].filter((r) => !isLmsRoute(r));
  const payload = {
    generatedAt: new Date().toISOString(),
    routeCount: routes.size,
    adminRouteCount: adminRoutes.length,
    lmsRouteCountExcluded: routes.size - adminRoutes.length,
    paramRoutes: adminRoutes.filter((r) => r.includes(':')).sort(),
    pairCount: pairs.length,
    pairs,
  };

  writeFileSync(MATRIX_PATH, JSON.stringify(payload, null, 2));
  console.log(
    `screen-role-matrix — ${routes.size} routes scanned, ${adminRoutes.length} admin ` +
      `(${payload.lmsRouteCountExcluded} LMS excluded), ${payload.paramRoutes.length} with :params, ` +
      `${pairs.length} (screen, role) pairs -> ${MATRIX_PATH}`,
  );
}

generateMatrix();

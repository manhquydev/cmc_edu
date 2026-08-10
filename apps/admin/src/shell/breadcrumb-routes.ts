import type { Breadcrumb } from '@cmc/ui';
import { NAV_MODULES } from './nav-registry.js';

const BREADCRUMB_ALIASES: ReadonlyMap<string, string> = new Map([
  // Legacy page chrome still calls the loyalty module "Engagement"; the module
  // landing route is its safe default for every role that can open the group.
  ['Engagement', '/admin/engagement/rewards'],
  // The payroll route is named after the operational action in nav, while the
  // page chrome uses the user's record-oriented label.
  ['Bảng lương', '/hr/payroll'],
  // The route is named CRM while the page chrome preserves the domain term
  // "Pipeline CRM".
  ['Pipeline CRM', '/crm'],
]);

// `/admin` has no landing page of its own, so a generic "Quản trị" crumb must
// stay informational instead of sending the user to ComingSoon.
const NON_NAVIGABLE_MODULE_LABELS = new Set(['Quản trị']);

function indexNavPaths(): ReadonlyMap<string, string> {
  const paths = new Map<string, string>();
  const ambiguousLabels = new Set<string>();

  const add = (label: string, path: string) => {
    const current = paths.get(label);
    if (current && current !== path) {
      paths.delete(label);
      ambiguousLabels.add(label);
      return;
    }
    if (!ambiguousLabels.has(label)) paths.set(label, path);
  };

  for (const module of NAV_MODULES) {
    if (!NON_NAVIGABLE_MODULE_LABELS.has(module.label)) add(module.label, module.path);
    for (const child of module.children ?? []) add(child.label, child.path);
  }

  return paths;
}

const NAV_PATHS_BY_LABEL = indexNavPaths();

/**
 * Provides a navigable parent only when the label has one unambiguous admin
 * route. Callers can always supply `href` for labels such as "Kinh doanh",
 * whose destination depends on the current workflow.
 */
export function resolveAdminBreadcrumbHref({ label }: Breadcrumb): string | undefined {
  return BREADCRUMB_ALIASES.get(label) ?? NAV_PATHS_BY_LABEL.get(label);
}

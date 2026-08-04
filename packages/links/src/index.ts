// Shared entity → URL builders for ERP admin deep links.
// Pure TypeScript — no runtime deps — importable from apps/admin (Vite) and
// (later) apps/api (Node). Workspace builders for attendance/etc. land in
// later phases; this module owns entity detail paths + the /go resolver.

/** UUID v1–v5 shape used at every deep-link id boundary. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const links = {
  opportunity: (id: string) => `/crm/opportunities/${id}`,
  receipt: (id: string) => `/finance/${id}`,
  student: (id: string) => `/admin/students/${id}`,
  classBatch: (id: string) => `/admin/classes/${id}`,
} as const;

export type LinkEntity = keyof typeof links;

export const goPath = (entity: LinkEntity, id: string): string =>
  `/go/${entity}/${id}`;

/**
 * Resolve a canonical `/go/:entity/:id` into a real admin path.
 * Returns null for unknown entity keys (incl. prototype names), non-UUID ids,
 * or empty input — never throws.
 */
export function resolveGo(entity: string, id: string): string | null {
  // Object.hasOwn — never `in` (prototype chain: 'toString' in links === true).
  if (!Object.hasOwn(links, entity)) return null;
  if (!UUID_RE.test(id)) return null;
  return links[entity as LinkEntity](id);
}

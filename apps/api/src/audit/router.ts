// audit.list — phase-04 super-admin-completion. Read-only view over the
// global AuditLog (populated by the middleware in ../trpc.ts). No RLS/
// facilityId on AuditLog (platform-level, not itself facility-scoped) —
// plain ctx.db calls, not withFacility, same posture as facility/router.ts.
//
// Phase 4B adds an entityId filter and server-proven safe detail links: a
// row earns a linkEntity only when its target still exists in the CALLER'S
// current facility. Other-facility, deleted, unknown-entity and non-UUID
// targets render as plain text downstream — the viewer never emits a link
// it cannot stand behind.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import type { Prisma } from '@cmc/db';
import { requirePermission, router } from '../trpc.js';

const listInput = z.object({
  actor: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  entity: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Audit `entity` values are tRPC router segments. Each entry maps one to
 *  the facility-scoped table that owns the record and the @cmc/links entity
 *  key the admin client resolves into a real path. Deliberately tiny: only
 *  entities with BOTH a registered link builder and a resolvable owner table
 *  belong here — new entries require both, never just one. */
const SAFE_LINK_TARGETS = {
  user: { table: 'appUser', linkEntity: 'staff' },
  afterSale: { table: 'afterSaleCase', linkEntity: 'afterSaleCase' },
  parentAccount: { table: 'parentAccount', linkEntity: 'parentAccount' },
} as const;

type SafeLinkTarget = (typeof SAFE_LINK_TARGETS)[keyof typeof SAFE_LINK_TARGETS];

type AuditRowLike = { id: string; entity: string; entityId: string };

/** Resolve linkEntity per row. Returns null for every row whose target is
 *  not provably resolvable in the caller's facility — the client renders
 *  those as plain text. */
async function resolveSafeLinkEntities(
  db: Prisma.TransactionClient,
  facilityId: string,
  rows: AuditRowLike[],
): Promise<Map<string, string>> {
  const byTable = new Map<SafeLinkTarget['table'], { rowIds: string[]; entityIds: string[]; linkEntity: string }>();
  for (const row of rows) {
    const target = Object.hasOwn(SAFE_LINK_TARGETS, row.entity)
      ? SAFE_LINK_TARGETS[row.entity as keyof typeof SAFE_LINK_TARGETS]
      : undefined;
    if (!target || !UUID_RE.test(row.entityId)) continue;
    const bucket = byTable.get(target.table) ?? {
      rowIds: [],
      entityIds: [],
      linkEntity: target.linkEntity,
    };
    bucket.rowIds.push(row.id);
    bucket.entityIds.push(row.entityId);
    byTable.set(target.table, bucket);
  }

  const resolved = new Map<string, string>();
  for (const [table, bucket] of byTable) {
    // Union of per-model findMany signatures is not callable; the three
    // targets share the exact same {id, facilityId} shape, so one structural
    // view of the delegate is sound here.
    const findMany = db[table].findMany as unknown as (
      args: { where: { id: { in: string[] }; facilityId: string }; select: { id: true } },
    ) => Promise<Array<{ id: string }>>;
    const found = await findMany({
      where: { id: { in: bucket.entityIds }, facilityId },
      select: { id: true },
    });
    const foundIds = new Set(found.map((r) => r.id));
    bucket.rowIds.forEach((rowId, i) => {
      if (foundIds.has(bucket.entityIds[i])) resolved.set(rowId, bucket.linkEntity);
    });
  }
  return resolved;
}

export const auditRouter = router({
  list: requirePermission('audit', 'list')
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.actor !== undefined ? { actor: input.actor } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.entity !== undefined ? { entity: input.entity } : {}),
        ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
        ...(input.createdFrom !== undefined || input.createdTo !== undefined
          ? {
              createdAt: {
                ...(input.createdFrom !== undefined ? { gte: new Date(input.createdFrom) } : {}),
                ...(input.createdTo !== undefined ? { lte: new Date(input.createdTo) } : {}),
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        ctx.db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.auditLog.count({ where }),
      ]);

      // Super-admin viewer enrichment: prove current-facility resolvability
      // before any row may carry a detail link. The target tables ARE
      // facility-RLS'd, so the existence probes run inside withFacility; no
      // facility context → every row stays plain text.
      const links = ctx.facilityId
        ? await withFacility(ctx.db, ctx.facilityId, (tx) => resolveSafeLinkEntities(tx, ctx.facilityId!, rows))
        : new Map<string, string>();

      return {
        items: rows.map((row) => ({
          ...row,
          linkEntity: links.get(row.id) ?? null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});

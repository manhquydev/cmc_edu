// audit.list — phase-04 super-admin-completion. Read-only view over the
// global AuditLog (populated by the middleware in ../trpc.ts). No RLS/
// facilityId on AuditLog (platform-level, not itself facility-scoped) —
// plain ctx.db calls, not withFacility, same posture as facility/router.ts.

import { z } from 'zod';
import { requirePermission, router } from '../trpc.js';

const listInput = z.object({
  actor: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  entity: z.string().min(1).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const auditRouter = router({
  list: requirePermission('audit', 'list')
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.actor !== undefined ? { actor: input.actor } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.entity !== undefined ? { entity: input.entity } : {}),
        ...(input.createdFrom !== undefined || input.createdTo !== undefined
          ? {
              createdAt: {
                ...(input.createdFrom !== undefined ? { gte: new Date(input.createdFrom) } : {}),
                ...(input.createdTo !== undefined ? { lte: new Date(input.createdTo) } : {}),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.auditLog.count({ where }),
      ]);

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),
});

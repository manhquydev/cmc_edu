// facility router — K7 remediation (deep-review consolidated report): P1 had
// no writer for `Facility` at all (grep: zero create/list procedures) — the
// product had no way to create a facility. This router adds the missing
// admin surface. The boundary REJECT for an unknown/forged `facilityId`
// lives in ../trpc.ts (`requireValidFacility`, applied to every
// `protectedProcedure`), not here — this file only creates/lists the
// `Facility` catalog itself.
//
// super_admin only: `Facility` management has no entry in the @cmc/auth
// `PERMISSIONS` registry — only `super_admin`'s registry bypass (`can()`,
// packages/auth) passes; every other role is FORBIDDEN. `Facility` carries no
// RLS policy (it is the platform-level catalog, not itself facility-scoped —
// schema.prisma), so these are plain `ctx.db` calls, not `withFacility`.

import { z } from 'zod';
import { requirePermission, router } from '../trpc.js';

const facilityCreateInput = z.object({
  name: z.string().min(1),
});

const facilityListInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export interface FacilityDto {
  id: string;
  name: string;
  createdAt: Date;
}

export const facilityRouter = router({
  create: requirePermission('facility', 'create')
    .input(facilityCreateInput)
    .mutation(async ({ ctx, input }): Promise<FacilityDto> => {
      const facility = await ctx.db.facility.create({ data: { name: input.name } });

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facility.create',
          entity: 'Facility',
          entityId: facility.id,
          data: { name: facility.name },
        },
      });

      return facility;
    }),

  list: requirePermission('facility', 'list')
    .input(facilityListInput)
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.db.facility.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.facility.count(),
      ]);

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),
});

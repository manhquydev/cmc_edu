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

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { badRequest } from '../errors.js';
import { requirePermission, router } from '../trpc.js';

const facilityCreateInput = z.object({
  name: z.string().min(1),
  /** P2-Foundation addition (QĐ 0036): the class-code prefix (e.g. "HN").
   * Optional — omitted callers (every P1 caller/test) get one auto-derived
   * from `name` below, so no existing `facility.create` caller breaks. */
  code: z.string().min(1).max(20).optional(),
});

const facilityListInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  /** Matches name or code (case-insensitive) — G1 FilterBar on admin facilities. */
  search: z.string().trim().min(1).max(100).optional(),
});

const facilityUpdateInput = z.object({
  id: z.string().min(1),
  /** `code` is deliberately NOT accepted here — it is baked into every
   * already-issued class-code (`{facility.code}-...`), so it is immutable
   * after creation. Only `name` may change. */
  name: z.string().min(1),
});

function isPrismaP2002(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

export interface FacilityDto {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
}

/** Derives a short, unique-enough code from `name` when the caller omits one
 * — e.g. "Facility Created By Test" -> "FACILI-3F2A9C1B". Collision-safe via
 * a random suffix (this is a fallback path, not the primary real-facility
 * naming flow, which is expected to pass an explicit `code`). */
function deriveFacilityCode(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'FAC';
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${base}-${suffix}`;
}

export const facilityRouter = router({
  create: requirePermission('facility', 'create')
    .input(facilityCreateInput)
    .mutation(async ({ ctx, input }): Promise<FacilityDto> => {
      const code = input.code ?? deriveFacilityCode(input.name);
      let facility;
      try {
        facility = await ctx.db.facility.create({ data: { name: input.name, code } });
      } catch (err: unknown) {
        if (isPrismaP2002(err)) {
          throw badRequest('Mã cơ sở đã tồn tại. Vui lòng chọn mã khác.');
        }
        throw err;
      }

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facility.create',
          entity: 'Facility',
          entityId: facility.id,
          data: { name: facility.name, code: facility.code },
        },
      });

      return facility;
    }),

  update: requirePermission('facility', 'manage')
    .input(facilityUpdateInput)
    .mutation(async ({ ctx, input }): Promise<FacilityDto> => {
      const facility = await ctx.db.facility.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facility.update',
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
      const term = input.search;
      const where = term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { code: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        ctx.db.facility.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.facility.count({ where }),
      ]);

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),
});

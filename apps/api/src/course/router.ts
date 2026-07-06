// course router -- minimal curriculum catalog (docs/19 SS1). `course.create`/
// `course.list` are the only P2-Foundation procedures for this model; the
// full level x month structure is deferred to a later curriculum phase.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { PROGRAM_VALUES } from '../class/program.js';
import { requirePermission, router, scoped } from '../trpc.js';

const courseCreateInput = z.object({
  program: z.enum(PROGRAM_VALUES),
  name: z.string().min(1),
});

const courseListInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export interface CourseDto {
  id: string;
  program: string;
  name: string;
  createdAt: Date;
}

export const courseRouter = router({
  create: requirePermission('course', 'manage')
    .input(courseCreateInput)
    .mutation(async ({ ctx, input }): Promise<CourseDto> => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.course.create({
          data: { facilityId, program: input.program, name: input.name },
        }),
      );
    }),

  list: requirePermission('course', 'manage')
    .input(courseListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const where = { facilityId };
        const [items, total] = await Promise.all([
          tx.course.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.course.count({ where }),
        ]);
        return { items, total, page: input.page, pageSize: input.pageSize };
      });
    }),
});

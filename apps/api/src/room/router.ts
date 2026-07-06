// room router -- minimal room catalog, used by `classBatch.create`'s
// room+time double-booking check (docs/26 WF-P2-01).

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { requirePermission, router, scoped } from '../trpc.js';

const roomCreateInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

const roomListInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export interface RoomDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

export const roomRouter = router({
  create: requirePermission('room', 'manage')
    .input(roomCreateInput)
    .mutation(async ({ ctx, input }): Promise<RoomDto> => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.room.create({
          data: { facilityId, code: input.code, name: input.name },
        }),
      );
    }),

  list: requirePermission('room', 'manage')
    .input(roomListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const where = { facilityId };
        const [items, total] = await Promise.all([
          tx.room.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.room.count({ where }),
        ]);
        return { items, total, page: input.page, pageSize: input.pageSize };
      });
    }),
});

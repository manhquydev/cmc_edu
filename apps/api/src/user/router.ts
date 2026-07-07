// AppUser router — P3-I HR/identity (US-020, WF-P3-01).
//
// `user.create`  — provision a staff member (super_admin only via user.manage).
//   Generates an atomic `CMC####` employeeCode via EmployeeCodeCounter.
// `user.list`    — list staff for the calling facility.
// `user.update`  — mutate position/email/managerId/isActive.
//
// All writes are facility-scoped via `withFacility` (ADR 0042).
// EmployeeCodeCounter is global (no RLS) — it is accessed in the same
// `withFacility` transaction; RLS does not apply to it.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

const createInput = z.object({
  userId: z.string().min(1).max(200),
  email: z.string().email().max(200),
  fullName: z.string().min(1).max(200),
  position: z.string().min(1).max(100),
  managerId: z.string().uuid().optional(),
});

const updateInput = z.object({
  appUserId: z.string().uuid(),
  email: z.string().email().max(200).optional(),
  fullName: z.string().min(1).max(200).optional(),
  position: z.string().min(1).max(100).optional(),
  managerId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export interface AppUserDto {
  id: string;
  facilityId: string;
  userId: string;
  email: string;
  fullName: string;
  position: string;
  managerId: string | null;
  employeeCode: string;
  isActive: boolean;
}

export const userRouter = router({
  create: requirePermission('user', 'manage')
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        if (input.managerId) {
          const mgr = await tx.appUser.findFirst({ where: { id: input.managerId, facilityId } });
          if (!mgr) throw notFound('Manager not found in this facility.');
        }
        // Atomic counter increment — Prisma's update locks the row for the
        // duration of the transaction, preventing duplicate code generation
        // under concurrent calls.
        const counter = await tx.employeeCodeCounter.update({
          where: { id: 1 },
          data: { next: { increment: 1 } },
        });
        const employeeCode = `CMC${String(counter.next - 1).padStart(4, '0')}`;
        let user;
        try {
          user = await tx.appUser.create({
            data: {
              facilityId,
              userId: input.userId,
              email: input.email,
              fullName: input.fullName,
              position: input.position,
              managerId: input.managerId ?? null,
              employeeCode,
            },
          });
        } catch (err: unknown) {
          // P2002 = userId unique constraint: one auth identity → one staff profile.
          if (
            err !== null &&
            typeof err === 'object' &&
            'code' in err &&
            (err as { code: unknown }).code === 'P2002'
          ) {
            throw badRequest('A staff profile already exists for this userId.');
          }
          throw err;
        }
        return user as AppUserDto;
      });
    }),

  list: requirePermission('user', 'manage')
    .query(async ({ ctx }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const items = await tx.appUser.findMany({
          where: { facilityId },
          orderBy: { createdAt: 'asc' },
        });
        return { items: items as AppUserDto[] };
      });
    }),

  update: requirePermission('user', 'manage')
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const existing = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!existing) throw notFound('AppUser not found.');

        if (input.managerId !== undefined && input.managerId !== null) {
          if (input.managerId === input.appUserId) {
            throw badRequest('A user cannot be their own manager.');
          }
          const mgr = await tx.appUser.findFirst({ where: { id: input.managerId, facilityId } });
          if (!mgr) throw notFound('Manager not found in this facility.');
          // Prevent A↔B direct cycle: if setting managerId=M, M.managerId must
          // not already be this user (only checks depth-1 cycle per spec).
          if (mgr.managerId === input.appUserId) {
            throw badRequest('Circular management chain detected (A↔B).');
          }
        }

        const updated = await tx.appUser.update({
          where: { id: input.appUserId },
          data: {
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
        return updated as AppUserDto;
      });
    }),
});

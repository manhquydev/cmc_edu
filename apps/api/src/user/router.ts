// AppUser router — P3-I HR/identity (US-020, WF-P3-01).
//
// `user.create`      — provision a staff member (super_admin only via user.manage).
//   Generates an atomic `CMC####` employeeCode via EmployeeCodeCounter.
// `user.list`        — list staff for the calling facility.
// `user.update`      — mutate position/email/managerId/isActive.
// `user.updateRoles` — assign roles array to a staff member (S1: role substrate).
//
// All writes are facility-scoped via `withFacility` (ADR 0042).
// EmployeeCodeCounter is global (no RLS) — it is accessed in the same
// `withFacility` transaction; RLS does not apply to it.

import { z } from 'zod';
import { withFacility, Role as DbRole } from '@cmc/db';
import { ROLES } from '@cmc/auth';
import type { Role as AuthRole } from '@cmc/auth';
import { badRequest, forbidden, notFound } from '../errors.js';
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
  roles: AuthRole[];
  isActive: boolean;
}

function isPrismaP2002(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

function p2002Target(err: unknown): string[] {
  if (
    err !== null &&
    typeof err === 'object' &&
    'meta' in err &&
    (err as { meta: unknown }).meta !== null &&
    typeof (err as { meta: unknown }).meta === 'object'
  ) {
    const target = ((err as { meta: { target?: unknown } }).meta).target;
    if (Array.isArray(target)) return target as string[];
  }
  return [];
}

const VALID_ROLES = ROLES as readonly string[];
// max(9): exactly 9 valid roles, duplicates deduped before DB write.
const roleArraySchema = z
  .array(z.string().refine((r) => VALID_ROLES.includes(r), { message: 'Unknown role' }))
  .max(9)
  .transform((arr) => [...new Set(arr)] as AuthRole[]);

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
          if (isPrismaP2002(err)) {
            const target = p2002Target(err);
            if (target.includes('email')) {
              throw badRequest('This email is already in use by another staff member.');
            }
            // userId or employeeCode constraint
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

        let updated;
        try {
          updated = await tx.appUser.update({
            where: { id: input.appUserId },
            data: {
              ...(input.email !== undefined ? { email: input.email } : {}),
              ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
              ...(input.position !== undefined ? { position: input.position } : {}),
              ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
              ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
          });
        } catch (err: unknown) {
          if (isPrismaP2002(err)) {
            throw badRequest('This email is already in use by another staff member.');
          }
          throw err;
        }
        return updated as AppUserDto;
      });
    }),

  updateRoles: requirePermission('user', 'manage')
    .input(
      z.object({
        appUserId: z.string().uuid(),
        roles: roleArraySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const existing = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
          select: { id: true, userId: true, roles: true },
        });
        if (!existing) throw notFound('AppUser not found.');

        // Guard self-demotion: caller may not remove their own super_admin role.
        // Once SSO wires AppUser.roles → ctx.subject.roles, self-lockout becomes live.
        // A last-super-admin check should land before that SSO integration (phase S2).
        if (
          ctx.subject.userId === existing.userId &&
          !input.roles.includes('super_admin') &&
          (existing.roles as string[]).includes('super_admin')
        ) {
          throw forbidden('Cannot remove your own super_admin role.');
        }

        // Skip write + audit when roles are unchanged.
        const beforeSorted = [...(existing.roles as string[])].sort().join(',');
        const afterSorted = [...input.roles].sort().join(',');
        if (beforeSorted === afterSorted) {
          return (await tx.appUser.findFirst({ where: { id: input.appUserId } })) as AppUserDto;
        }

        const updated = await tx.appUser.update({
          where: { id: input.appUserId },
          // AuthRole === DbRole at runtime; drift-assertion test locks the values.
          data: { roles: input.roles as unknown as DbRole[] },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'user.updateRoles',
            entity: 'AppUser',
            entityId: input.appUserId,
            data: { before: existing.roles, after: input.roles },
          },
        });

        return updated as AppUserDto;
      });
    }),
});

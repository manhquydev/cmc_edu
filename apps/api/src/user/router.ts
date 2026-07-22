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
import { ACTIVE_ROLES } from '@cmc/auth';
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

const pickListInput = z.object({
  /** Narrows the list to one staff role — a teacher picker must not offer
   *  people who do not teach. */
  role: z.enum(ACTIVE_ROLES).optional(),
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

// ADR-D amendment: only 5 active roles can be assigned. DB enum keeps 9
// values but dormant roles (ke_toan/cskh/ctv_mkt/hr) are not assignable.
// This applies to ALL callers including super_admin (business rule, not
// a privilege — seed scripts bypass zod by design).
const VALID_ROLES = ACTIVE_ROLES as readonly string[];
const roleArraySchema = z
  .array(z.string().refine((r) => VALID_ROLES.includes(r), { message: 'Unknown role' }))
  .max(ACTIVE_ROLES.length)
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

  // Deliberately separate from `list`: the screens that only need to fill a
  // staff dropdown (payroll, salary tiers, teacher assignment) are run by the
  // two directors, while `list` returns the whole staff profile and stays
  // super_admin-only. Same reason the key is `staff.pickList` and not a
  // payroll permission — see the registry comment.
  pickList: requirePermission('staff', 'pickList')
    .input(pickListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const items = await tx.appUser.findMany({
          // No `isActive` filter, matching `list`: payroll still has to reach a
          // staff member who was deactivated mid-period to finalize their last
          // payslip. This procedure narrows *fields*, not *rows*.
          where: {
            facilityId,
            ...(input.role ? { roles: { has: input.role as DbRole } } : {}),
          },
          select: { id: true, fullName: true, employeeCode: true, position: true, roles: true },
          orderBy: { fullName: 'asc' },
        });
        return { items };
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
        if (
          ctx.subject.userId === existing.userId &&
          !input.roles.includes('super_admin') &&
          (existing.roles as string[]).includes('super_admin')
        ) {
          throw forbidden('Cannot remove your own super_admin role.');
        }

        // Guard last-super-admin: prevent removing super_admin from the last
        // active admin in the system (SSO already wires AppUser.roles into session).
        // NOTE: count-then-update under READ COMMITTED has a narrow TOCTOU window
        // if two concurrent requests both target the last two admins. Acceptable
        // for single-facility/admin-panel usage; harden with SERIALIZABLE or
        // advisory lock if multi-facility concurrent admin ops become real.
        if (
          (existing.roles as string[]).includes('super_admin') &&
          !input.roles.includes('super_admin')
        ) {
          const otherAdmins = await tx.appUser.count({
            where: {
              id: { not: input.appUserId },
              isActive: true,
              roles: { has: 'super_admin' as DbRole },
            },
          });
          if (otherAdmins === 0) {
            throw forbidden('Cannot remove super_admin from the last active admin.');
          }
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

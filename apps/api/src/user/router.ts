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
import { hashPassword, verifyPassword } from '../lms-auth/password-hash.js';
import {
  MAX_STAFF_LOGIN_ATTEMPTS,
  STAFF_LOCKOUT_MINUTES,
} from '../auth/password-routes.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { protectedProcedure, requirePermission, router, scoped } from '../trpc.js';
import { listRecordEventPage } from '../record-event/store.js';
import {
  emitStaffRecordEvent,
  isStaffRecordEventKind,
  labelForStaffRecordEventKind,
  STAFF_RECORD_EVENT_ENTITY,
  STAFF_RECORD_EVENT_HISTORY_SINCE,
} from './record-event.js';

const pickListInput = z.object({
  /** Narrows the list to one staff role — a teacher picker must not offer
   *  people who do not teach. */
  role: z.enum(ACTIVE_ROLES).optional(),
  /** Payroll / pickers: fullName, employeeCode, position (case-insensitive). */
  search: z.string().trim().min(1).max(100).optional(),
});

/** Operational timeline read — parent AppUser is authorized in the handler
 *  before any event row is touched; entity is fixed server-side. */
const userTimelineInput = z.object({
  appUserId: z.string().uuid(),
  cursor: z.string().min(1).optional(),
  take: z.number().int().min(1).max(50).default(20),
});

/** Staff directory search — G1 FilterBar on admin users list. */
const userListInput = z.object({
  /** Matches fullName / email (case-insensitive), employeeCode, or userId. */
  search: z.string().trim().min(1).max(100).optional(),
});

// Same minimum as the LMS password procedures (lms-auth/router.ts).
const PASSWORD_MIN_LENGTH = 8;

const changeOwnPasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

const resetPasswordInput = z.object({
  appUserId: z.string().uuid(),
  tempPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
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

/** Safe manager identity for the staff form — id + display fields only, never
 *  credential columns. Rendered as "fullName (employeeCode)" in selects. */
export interface AppUserManagerSummary {
  id: string;
  fullName: string;
  employeeCode: string;
}

/** `user.get` response: the browser-safe AppUser row plus the manager summary
 *  the profile form needs to show the current manager without a second query. */
export interface AppUserDetailDto extends AppUserDto {
  manager: AppUserManagerSummary | null;
}

const MANAGER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  employeeCode: true,
} as const;

const getUserInput = z.object({
  appUserId: z.string().uuid(),
});

/**
 * Every procedure that returns AppUser rows to the admin client MUST use this
 * select: AppUser now carries credential columns (passwordHash, lockout
 * fields) that must never serialize over tRPC — a bare row + `as AppUserDto`
 * cast would leak them into browser cache/devtools/HAR captures.
 */
const APP_USER_SELECT = {
  id: true,
  facilityId: true,
  userId: true,
  email: true,
  fullName: true,
  position: true,
  managerId: true,
  employeeCode: true,
  roles: true,
  isActive: true,
} as const;

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
    // Expression indexes (e.g. the partial unique index on lower(email))
    // surface as a string index name, not a column array.
    if (typeof target === 'string') return [target];
  }
  return [];
}

/** True when a P2002 target (column list or index name) involves email. */
function p2002IsEmail(err: unknown): boolean {
  return p2002Target(err).some((t) => t.toLowerCase().includes('email'));
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

// Declared after roleArraySchema/PASSWORD_MIN_LENGTH because it reuses both.
const createInput = z.object({
  userId: z.string().min(1).max(200),
  email: z.string().email().max(200),
  fullName: z.string().min(1).max(200),
  position: z.string().min(1).max(100),
  managerId: z.string().uuid().optional(),
  // Roles and the first password belong to provisioning, not to follow-up
  // work: a profile with neither cannot sign in, and once it can it may still
  // do nothing. Both optional so existing callers keep working; updateRoles
  // and resetPassword remain the way to change either one later.
  roles: roleArraySchema.optional(),
  tempPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200).optional(),
});

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
        // Escalation guard: directors hold user.manage for staff provisioning but
        // must not mint a platform admin — only a super_admin may create another.
        const callerIsSuperAdmin = ctx.subject.roles.includes('super_admin');
        if (!callerIsSuperAdmin && input.roles?.includes('super_admin')) {
          throw forbidden('Only a super admin can create a super_admin account.');
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
              roles: (input.roles ?? []) as DbRole[],
              // Same contract as resetPassword: an admin-set password is
              // temporary and must be rotated at first login.
              ...(input.tempPassword
                ? { passwordHash: hashPassword(input.tempPassword), mustChangePassword: true }
                : {}),
            },
            select: APP_USER_SELECT,
          });
        } catch (err: unknown) {
          if (isPrismaP2002(err)) {
            if (p2002IsEmail(err)) {
              throw badRequest('This email is already in use by another staff member.');
            }
            // userId or employeeCode constraint
            throw badRequest('A staff profile already exists for this userId.');
          }
          throw err;
        }
        // Emit operational staff timeline events in the same transaction
        await emitStaffRecordEvent(tx, {
          facilityId,
          appUserId: user.id,
          actor: ctx.subject.userId,
          kind: 'created',
        });

        // Roles and password granted at creation are the same privileged
        // changes updateRoles/resetPassword audit, so they leave the same
        // trail — an auditor reading only `user.create` would otherwise never
        // see who handed out a role.
        if (input.roles?.length) {
          await emitStaffRecordEvent(tx, {
            facilityId,
            appUserId: user.id,
            actor: ctx.subject.userId,
            kind: 'roles_updated',
            roles: input.roles,
          });
          await tx.auditLog.create({
            data: {
              actor: ctx.subject.userId,
              action: 'user.updateRoles',
              entity: 'AppUser',
              entityId: user.id,
              data: { targetUserId: user.userId, before: [], after: input.roles },
            },
          });
        }
        if (input.tempPassword) {
          await emitStaffRecordEvent(tx, {
            facilityId,
            appUserId: user.id,
            actor: ctx.subject.userId,
            kind: 'password_reset',
          });
          await tx.auditLog.create({
            data: {
              actor: ctx.subject.userId,
              action: 'user.resetPassword',
              entity: 'AppUser',
              entityId: user.id,
              data: { targetUserId: user.userId },
            },
          });
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
      const term = input.search;
      return withFacility(ctx.db, facilityId, async (tx) => {
        const items = await tx.appUser.findMany({
          // No `isActive` filter, matching `list`: payroll still has to reach a
          // staff member who was deactivated mid-period to finalize their last
          // payslip. This procedure narrows *fields*, not *rows*.
          where: {
            facilityId,
            ...(input.role ? { roles: { has: input.role as DbRole } } : {}),
            ...(term
              ? {
                  OR: [
                    { fullName: { contains: term, mode: 'insensitive' } },
                    { employeeCode: { contains: term, mode: 'insensitive' } },
                    { position: { contains: term, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          select: { id: true, fullName: true, employeeCode: true, position: true, roles: true },
          orderBy: { fullName: 'asc' },
        });
        return { items };
      });
    }),

  /** Manager dropdown for the staff profile form: same-facility staff who
   *  may be assigned as a manager. A non-super-admin caller (director) must not
   *  be offered a `super_admin` target — the platform admin is read-only for
   *  them, so a super_admin can never be their staff member's manager. Unlike
   *  `pickList` (teacher/payroll dropdowns, `staff.pickList` key), this is the
   *  manager-eligibility roster under the same `user.manage` authority as the
   *  rest of the staff surface. */
  managerPickList: requirePermission('user', 'manage')
    .query(async ({ ctx }) => {
      const { facilityId } = scoped(ctx);
      const callerIsSuperAdmin = ctx.subject.roles.includes('super_admin');
      return withFacility(ctx.db, facilityId, async (tx) => {
        const items = await tx.appUser.findMany({
          where: {
            facilityId,
            // Directors see every other same-facility staff (incl. peer
            // directors) as eligible; only super_admin targets are excluded
            // (the platform admin is read-only for a director, so it can
            // never be assigned as a staff member's manager).
            ...(callerIsSuperAdmin
              ? {}
              : { NOT: { roles: { has: 'super_admin' as DbRole } } }),
          },
          select: { id: true, fullName: true, employeeCode: true, position: true, roles: true },
          orderBy: { fullName: 'asc' },
        });
        return { items };
      });
    }),

  list: requirePermission('user', 'manage')
    .input(userListInput.default({}))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const term = input.search;
      return withFacility(ctx.db, facilityId, async (tx) => {
        const items = await tx.appUser.findMany({
          where: {
            facilityId,
            ...(term
              ? {
                  OR: [
                    { fullName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                    { employeeCode: { contains: term, mode: 'insensitive' } },
                    { userId: { contains: term, mode: 'insensitive' } },
                    { position: { contains: term, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: 'asc' },
          select: APP_USER_SELECT,
        });
        return { items: items as AppUserDto[] };
      });
    }),

  /** Cold-start fetch for one staff record: the detail page and profile form
   *  hydrate from this without a list cache. Facility-scoped like every other
   *  procedure; a cross-facility or unknown target is NOT_FOUND (never an
   *  existence-leaking FORBIDDEN). Same `user.manage` roster as `list` —
   *  directors may READ a same-facility super_admin profile (read-only);
   *  mutations stay guarded by their own escalation checks. */
  get: requirePermission('user', 'manage')
    .input(getUserInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const user = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
          select: {
            ...APP_USER_SELECT,
            // The manager join needs no facility filter of its own: every
            // write path that sets managerId (create/update) validates it
            // against the SAME facility first, so an AppUser's manager is
            // always in the caller's facility and never leaks a cross-facility
            // identity.
            manager: { select: MANAGER_SUMMARY_SELECT },
          },
        });
        if (!user) throw notFound('AppUser not found.');
        return {
          id: user.id,
          facilityId: user.facilityId,
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          position: user.position,
          managerId: user.managerId,
          employeeCode: user.employeeCode,
          roles: user.roles as AuthRole[],
          isActive: user.isActive,
          manager: user.manager
            ? {
                id: user.manager.id,
                fullName: user.manager.fullName,
                employeeCode: user.manager.employeeCode,
              }
            : null,
        } satisfies AppUserDetailDto;
      });
    }),

  /** Operational activity timeline for a staff record (Phase 4A).
   *  Parent record authorized before reading events; entity fixed server-side;
   *  actor identity safely projected for non-super-admin callers. */
  timeline: requirePermission('user', 'manage')
    .input(userTimelineInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const callerIsSuperAdmin = ctx.subject.roles.includes('super_admin');
      return withFacility(ctx.db, facilityId, async (tx) => {
        const staff = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
          select: { id: true },
        });
        if (!staff) throw notFound('AppUser not found.');

        const eventWhere = {
          facilityId,
          entity: STAFF_RECORD_EVENT_ENTITY,
          entityId: staff.id,
        };

        const [{ rows, nextCursor }, createdEvent] = await Promise.all([
          listRecordEventPage(tx, eventWhere, input.cursor ?? null, input.take),
          tx.recordEvent.findFirst({
            where: { ...eventWhere, kind: 'created' },
            select: { id: true },
          }),
        ]);

        // Resolve actors safely
        const actorUserIds = [...new Set(rows.map((r) => r.actor).filter(Boolean))];
        const actorStaffRows = actorUserIds.length > 0
          ? await tx.appUser.findMany({
              where: {
                facilityId,
                userId: { in: actorUserIds },
              },
              select: {
                userId: true,
                fullName: true,
                employeeCode: true,
                roles: true,
              },
            })
          : [];

        const actorMap = new Map(
          actorStaffRows.map((s) => [s.userId, s]),
        );

        return {
          items: rows.map((row) => {
            const known = isStaffRecordEventKind(row.kind);
            let actorLabel: string;
            const staffRecord = actorMap.get(row.actor);

            if (staffRecord) {
              const isTargetSuperAdmin = staffRecord.roles.includes('super_admin' as DbRole);
              if (isTargetSuperAdmin && !callerIsSuperAdmin) {
                actorLabel = 'Quản trị hệ thống';
              } else {
                actorLabel = staffRecord.fullName || staffRecord.employeeCode || staffRecord.userId;
              }
            } else if (row.actor === 'anonymous') {
              actorLabel = 'Hệ thống';
            } else {
              actorLabel = callerIsSuperAdmin ? row.actor : 'Hệ thống';
            }

            return {
              id: row.id,
              kind: row.kind,
              actor: actorLabel,
              payload: known ? row.payload : null,
              createdAt: row.createdAt,
              label: labelForStaffRecordEventKind(row.kind),
            };
          }),
          nextCursor,
          historySince: createdEvent ? null : STAFF_RECORD_EVENT_HISTORY_SINCE,
        };
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

        // Escalation guard: a director must not deactivate or re-email a super
        // admin (that would let them lock out or redirect the platform admin).
        if (!ctx.subject.roles.includes('super_admin') && (existing.roles as string[]).includes('super_admin')) {
          throw forbidden('Only a super admin can update another super admin account.');
        }

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
            select: APP_USER_SELECT,
          });
        } catch (err: unknown) {
          if (isPrismaP2002(err)) {
            throw badRequest('This email is already in use by another staff member.');
          }
          throw err;
        }
        // Compute field diffs for operational events
        const profileFields: Array<'email' | 'fullName' | 'position'> = [];
        if (input.email !== undefined && input.email !== existing.email) profileFields.push('email');
        if (input.fullName !== undefined && input.fullName !== existing.fullName) profileFields.push('fullName');
        if (input.position !== undefined && input.position !== existing.position) profileFields.push('position');

        if (profileFields.length > 0) {
          await emitStaffRecordEvent(tx, {
            facilityId,
            appUserId: existing.id,
            actor: ctx.subject.userId,
            kind: 'profile_updated',
            fields: profileFields,
          });
        }

        if (input.managerId !== undefined && input.managerId !== existing.managerId) {
          await emitStaffRecordEvent(tx, {
            facilityId,
            appUserId: existing.id,
            actor: ctx.subject.userId,
            kind: 'manager_changed',
            managerId: input.managerId,
          });
        }

        if (input.isActive !== undefined && input.isActive !== existing.isActive) {
          await emitStaffRecordEvent(tx, {
            facilityId,
            appUserId: existing.id,
            actor: ctx.subject.userId,
            kind: input.isActive ? 'activated' : 'deactivated',
          });
        }

        return updated as AppUserDto;
      });
    }),

  // Both password procedures are in AUDIT_EXCLUDED_PATHS (trpc.ts): their raw
  // input carries plaintext passwords, which must never depend on field-name
  // sanitization alone to stay out of AuditLog — each writes its own
  // secret-free audit row inline instead.

  /** Any authenticated staff member rotates their own password (also clears
   *  the admin-provisioned mustChangePassword flag). */
  changeOwnPassword: protectedProcedure
    .input(changeOwnPasswordInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      // The failure paths MUST NOT throw inside the withFacility transaction:
      // a throw rolls the transaction back, which would silently undo the
      // lockout bookkeeping written on the wrong-password branch. Resolve an
      // outcome inside, throw after commit.
      const outcome = await withFacility(ctx.db, facilityId, async (tx) => {
        const me = await tx.appUser.findFirst({
          where: { userId: ctx.subject.userId, facilityId },
        });
        if (!me || !me.passwordHash) {
          return 'no-password-login' as const;
        }
        // Same lockout counters as /auth/staff-login: without this, a
        // hijacked session could brute-force the current password through
        // this procedure and sidestep the login lockout entirely.
        const now = new Date();
        if (me.loginLockedUntil && me.loginLockedUntil > now) {
          return 'wrong-password' as const;
        }
        if (!verifyPassword(input.currentPassword, me.passwordHash)) {
          const attempts = me.loginAttempts + 1;
          await tx.appUser.update({
            where: { id: me.id },
            data: {
              loginAttempts: attempts,
              loginLockedUntil:
                attempts >= MAX_STAFF_LOGIN_ATTEMPTS
                  ? new Date(now.getTime() + STAFF_LOCKOUT_MINUTES * 60_000)
                  : null,
            },
          });
          return 'wrong-password' as const;
        }
        await tx.appUser.update({
          where: { id: me.id },
          data: {
            passwordHash: hashPassword(input.newPassword),
            mustChangePassword: false,
            loginAttempts: 0,
            loginLockedUntil: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'user.changeOwnPassword',
            entity: 'AppUser',
            entityId: me.id,
          },
        });
        return 'ok' as const;
      });

      if (outcome === 'no-password-login') {
        throw badRequest('Password login is not enabled for this account.');
      }
      if (outcome === 'wrong-password') {
        throw badRequest('Current password is incorrect.');
      }
      return { ok: true };
    }),

  /** Admin provisions/resets a staff member's password to a temporary value;
   *  the target is forced to change it at their next login. */
  resetPassword: requirePermission('user', 'manage')
    .input(resetPasswordInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const existing = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!existing) throw notFound('AppUser not found.');
        if (!existing.email) {
          throw badRequest('Set a login email before enabling password login.');
        }
        // Escalation guard: a director must not reset a super_admin's password
        // (that would let them lock out or take over the platform admin).
        if (!ctx.subject.roles.includes('super_admin') && (existing.roles as string[]).includes('super_admin')) {
          throw forbidden("Only a super admin can reset another super admin's password.");
        }
        await tx.appUser.update({
          where: { id: existing.id },
          data: {
            passwordHash: hashPassword(input.tempPassword),
            mustChangePassword: true,
            loginAttempts: 0,
            loginLockedUntil: null,
          },
        });
        await emitStaffRecordEvent(tx, {
          facilityId,
          appUserId: existing.id,
          actor: ctx.subject.userId,
          kind: 'password_reset',
        });
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'user.resetPassword',
            entity: 'AppUser',
            entityId: existing.id,
            data: { targetUserId: existing.userId },
          },
        });
        return { ok: true };
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

        // Escalation guard: directors may manage staff roles but cannot grant or
        // revoke super_admin — that stays the platform admin's exclusive power.
        if (
          !ctx.subject.roles.includes('super_admin') &&
          ((existing.roles as string[]).includes('super_admin') || input.roles.includes('super_admin'))
        ) {
          throw forbidden('Only a super admin can grant or revoke the super_admin role.');
        }

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
          return (await tx.appUser.findFirst({
            where: { id: input.appUserId },
            select: APP_USER_SELECT,
          })) as AppUserDto;
        }

        await emitStaffRecordEvent(tx, {
          facilityId,
          appUserId: input.appUserId,
          actor: ctx.subject.userId,
          kind: 'roles_updated',
          roles: input.roles,
        });

        const updated = await tx.appUser.update({
          where: { id: input.appUserId },
          // AuthRole === DbRole at runtime; drift-assertion test locks the values.
          data: { roles: input.roles as unknown as DbRole[] },
          select: APP_USER_SELECT,
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

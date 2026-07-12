// Shift router — P3-II HR shifts (WF-P3-03/04, ADR 0040).
//
// shift.createGroup   — create a ShiftGroup (admin setup).
// shift.createTemplate — create a ShiftTemplate within a group.
// shift.submit        — employee submits a shift registration.
//   - Ticket-lock: at most 1 submitted registration per appUser at a time.
//   - fromDate must be a future ICT date (at submission time).
//   - SINGLE mode: at most 1 entry per calendar day.
//   - All entries' shiftTemplateIds must belong to the submitted shiftGroup.
//   - Validates: shiftGroup type matches employee's position-derived type.
// shift.approve       — director approves (anti-self-approve, group-type scoped).
//   - GIAO_VIEN registrations: caller must have giam_doc_dao_tao role.
//   - KINH_DOANH registrations: caller must have giam_doc_kinh_doanh role.
//   - super_admin bypasses the group-type check.
//   - cancelled status is terminal — cannot be approved.
// shift.reject        — director rejects (same gate as approve); requires a
//   reason (min 3 chars, stored in `rejectReason`); frees the ticket-lock
//   (rejected ∉ the partial unique index's `WHERE status='submitted'`).
// shift.cancel        — owner or director cancels (approved state cancellable).
// shift.listGroups     — any active staff session: groups + nested templates.
// shift.myRegistrations — self-scoped read: caller's own registrations + entries.
// shift.pendingForApproval — key `shift.approve`: submitted registrations
//   scoped to the caller's group-type (super_admin sees both).
//
// All writes are facility-scoped via `withFacility` (ADR 0042).

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import { ictToUtc, resolveShiftGroup } from '@cmc/domain-time';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { protectedProcedure, requirePermission, router, scoped, type Context } from '../trpc.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createGroupInput = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['KINH_DOANH', 'GIAO_VIEN']),
  selectionMode: z.enum(['SINGLE', 'MULTIPLE']),
});

const createTemplateInput = z.object({
  shiftGroupId: z.string().uuid(),
  name: z.string().min(1).max(200),
  startTime: z.string().regex(TIME_RE, 'Expected HH:mm'),
  endTime: z.string().regex(TIME_RE, 'Expected HH:mm'),
});

const submitInput = z.object({
  shiftGroupId: z.string().uuid(),
  fromDate: z.string().regex(DATE_RE, 'Expected YYYY-MM-DD'),
  toDate: z.string().regex(DATE_RE, 'Expected YYYY-MM-DD'),
  entries: z
    .array(
      z.object({
        date: z.string().regex(DATE_RE, 'Expected YYYY-MM-DD'),
        shiftTemplateId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(366),
});

const approveInput = z.object({
  registrationId: z.string().uuid(),
});

const rejectInput = z.object({
  registrationId: z.string().uuid(),
  reason: z.string().min(3),
});

const cancelInput = z.object({
  registrationId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Shared review gate (approve + reject)
// ---------------------------------------------------------------------------

/**
 * Anti-self-review + group-type gate shared by `shift.approve` and
 * `shift.reject`: caller cannot review their own registration, and (unless
 * super_admin) must hold the director role matching the registration's
 * shift-group type.
 */
async function assertCanReview(
  tx: Prisma.TransactionClient,
  ctx: Context,
  facilityId: string,
  registration: { appUserId: string; shiftGroup: { type: 'KINH_DOANH' | 'GIAO_VIEN' } },
  action: 'approve' | 'reject',
): Promise<void> {
  const reviewer = await tx.appUser.findFirst({
    where: { userId: ctx.subject!.userId, facilityId },
  });
  if (reviewer && reviewer.id === registration.appUserId) {
    throw forbidden(`Cannot ${action} your own shift registration.`);
  }

  const roles = ctx.subject!.roles;
  if (!roles.includes('super_admin')) {
    const groupType = registration.shiftGroup.type;
    if (groupType === 'GIAO_VIEN' && !roles.includes('giam_doc_dao_tao')) {
      throw forbidden('GIAO_VIEN shift registrations require giam_doc_dao_tao role.');
    }
    if (groupType === 'KINH_DOANH' && !roles.includes('giam_doc_kinh_doanh')) {
      throw forbidden('KINH_DOANH shift registrations require giam_doc_kinh_doanh role.');
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const shiftRouter = router({
  // -------------------------------------------------------------------------
  // shift.createGroup — admin/director creates a shift group catalog entry
  // -------------------------------------------------------------------------
  createGroup: requirePermission('shift', 'manage')
    .input(createGroupInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.shiftGroup.create({
          data: {
            facilityId,
            name: input.name,
            type: input.type,
            selectionMode: input.selectionMode,
          },
        }),
      );
    }),

  // -------------------------------------------------------------------------
  // shift.createTemplate — admin/director creates a shift template
  // -------------------------------------------------------------------------
  createTemplate: requirePermission('shift', 'manage')
    .input(createTemplateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const group = await tx.shiftGroup.findFirst({
          where: { id: input.shiftGroupId, facilityId },
        });
        if (!group) throw notFound('ShiftGroup not found in this facility.');
        return tx.shiftTemplate.create({
          data: {
            facilityId,
            shiftGroupId: input.shiftGroupId,
            name: input.name,
            startTime: input.startTime,
            endTime: input.endTime,
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // shift.submit — employee submits a shift registration
  // -------------------------------------------------------------------------
  submit: requirePermission('shift', 'submit')
    .input(submitInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Resolve the caller's AppUser
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');

        // Resolve ShiftGroup and validate it belongs to this facility
        const group = await tx.shiftGroup.findFirst({
          where: { id: input.shiftGroupId, facilityId },
        });
        if (!group) throw notFound('ShiftGroup not found.');

        // Validate: the group's type matches the employee's position type
        const expectedType = resolveShiftGroup(appUser.position);
        if (group.type !== expectedType) {
          throw badRequest(
            `This shift group is for ${group.type} staff; your position resolves to ${expectedType}.`,
          );
        }

        // fromDate must be a future ICT date (ICT midnight must be > now)
        const fromDateUtc = ictToUtc(input.fromDate, '00:00');
        if (fromDateUtc.getTime() <= Date.now()) {
          throw badRequest('fromDate must be a future ICT date.');
        }
        const toDateUtc = ictToUtc(input.toDate, '00:00');

        // Every entry date must fall within [fromDate, toDate] (YYYY-MM-DD
        // strings compare lexicographically the same as chronologically).
        for (const entry of input.entries) {
          if (entry.date < input.fromDate || entry.date > input.toDate) {
            throw badRequest(
              `Entry date ${entry.date} is outside the registration range [${input.fromDate}, ${input.toDate}].`,
            );
          }
        }

        // Ticket-lock: at most 1 submitted registration per appUser at a time
        const existingSubmitted = await tx.shiftRegistration.findFirst({
          where: { appUserId: appUser.id, facilityId, status: 'submitted' },
        });
        if (existingSubmitted) {
          throw badRequest(
            'You already have a submitted registration. Cancel it before submitting a new one.',
          );
        }

        // Overlap: user may not hold a submitted|approved registration whose
        // date range overlaps this one, regardless of shift group (docs/20 —
        // one active date range per person). cancelled/rejected don't count.
        const overlapping = await tx.shiftRegistration.findFirst({
          where: {
            appUserId: appUser.id,
            facilityId,
            status: { in: ['submitted', 'approved'] },
            fromDate: { lte: toDateUtc },
            toDate: { gte: fromDateUtc },
          },
        });
        if (overlapping) {
          throw conflict(
            'You already have a submitted or approved registration overlapping this date range.',
          );
        }

        // Validate entries: all shiftTemplateIds must belong to this shiftGroup
        const templateIds = [...new Set(input.entries.map((e) => e.shiftTemplateId))];
        const templates = await tx.shiftTemplate.findMany({
          where: { id: { in: templateIds }, shiftGroupId: input.shiftGroupId, facilityId },
        });
        if (templates.length !== templateIds.length) {
          throw badRequest(
            'One or more shift templates do not belong to the selected shift group.',
          );
        }

        // SINGLE mode: at most 1 entry per calendar day
        if (group.selectionMode === 'SINGLE') {
          const dates = input.entries.map((e) => e.date);
          const uniqueDates = new Set(dates);
          if (uniqueDates.size !== dates.length) {
            throw badRequest('SINGLE mode: at most one shift entry per calendar day.');
          }
        }

        // MULTIPLE mode: no duplicate (date, shiftTemplateId) pair within the
        // same registration (R3-8 — blocks inflating comp via a repeated entry).
        if (group.selectionMode === 'MULTIPLE') {
          const seen = new Set<string>();
          for (const entry of input.entries) {
            const key = `${entry.date}|${entry.shiftTemplateId}`;
            if (seen.has(key)) {
              throw badRequest(
                'MULTIPLE mode: duplicate (date, shiftTemplateId) entry in the same registration.',
              );
            }
            seen.add(key);
          }
        }

        // Create the registration
        const registration = await tx.shiftRegistration.create({
          data: {
            facilityId,
            appUserId: appUser.id,
            shiftGroupId: input.shiftGroupId,
            fromDate: fromDateUtc,
            toDate: toDateUtc,
            status: 'submitted',
            selectionMode: group.selectionMode,
          },
        });

        // Create entries
        await tx.shiftRegistrationEntry.createMany({
          data: input.entries.map((e) => ({
            facilityId,
            shiftRegistrationId: registration.id,
            date: ictToUtc(e.date, '00:00'),
            shiftTemplateId: e.shiftTemplateId,
          })),
        });

        return registration;
      });
    }),

  // -------------------------------------------------------------------------
  // shift.approve — director approves a submitted registration
  // -------------------------------------------------------------------------
  approve: requirePermission('shift', 'approve')
    .input(approveInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const registration = await tx.shiftRegistration.findFirst({
          where: { id: input.registrationId, facilityId },
          include: { shiftGroup: true },
        });
        if (!registration) throw notFound('ShiftRegistration not found.');
        if (registration.status === 'cancelled') {
          throw badRequest('Cannot approve a cancelled registration.');
        }
        if (registration.status === 'approved') {
          throw badRequest('Registration is already approved.');
        }
        if (registration.status !== 'submitted') {
          throw badRequest('Only submitted registrations can be approved.');
        }

        await assertCanReview(tx, ctx, facilityId, registration, 'approve');

        return tx.shiftRegistration.update({
          where: { id: registration.id },
          data: { status: 'approved', updatedAt: new Date() },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // shift.reject — director rejects a submitted registration (requires reason)
  // -------------------------------------------------------------------------
  reject: requirePermission('shift', 'approve')
    .input(rejectInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const registration = await tx.shiftRegistration.findFirst({
          where: { id: input.registrationId, facilityId },
          include: { shiftGroup: true },
        });
        if (!registration) throw notFound('ShiftRegistration not found.');
        if (registration.status !== 'submitted') {
          throw badRequest('Only submitted registrations can be rejected.');
        }

        await assertCanReview(tx, ctx, facilityId, registration, 'reject');

        return tx.shiftRegistration.update({
          where: { id: registration.id },
          data: { status: 'rejected', rejectReason: input.reason, updatedAt: new Date() },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // shift.listGroups — any active staff session: groups + nested templates
  // -------------------------------------------------------------------------
  listGroups: protectedProcedure.query(async ({ ctx }) => {
    const { facilityId } = scoped(ctx);
    return withFacility(ctx.db, facilityId, (tx) =>
      tx.shiftGroup.findMany({
        where: { facilityId },
        include: { templates: true },
        orderBy: { name: 'asc' },
      }),
    );
  }),

  // -------------------------------------------------------------------------
  // shift.myRegistrations — self-scoped read, no dedicated permission key
  // -------------------------------------------------------------------------
  myRegistrations: protectedProcedure.query(async ({ ctx }) => {
    const { facilityId } = scoped(ctx);
    return withFacility(ctx.db, facilityId, async (tx) => {
      const appUser = await tx.appUser.findFirst({
        where: { userId: ctx.subject!.userId, facilityId },
      });
      if (!appUser) throw forbidden('Staff profile not found in this facility.');
      return tx.shiftRegistration.findMany({
        where: { appUserId: appUser.id, facilityId },
        include: { entries: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  }),

  // -------------------------------------------------------------------------
  // shift.pendingForApproval — submitted registrations for the caller's
  // group-type (super_admin sees both types)
  // -------------------------------------------------------------------------
  pendingForApproval: requirePermission('shift', 'approve').query(async ({ ctx }) => {
    const { facilityId } = scoped(ctx);
    return withFacility(ctx.db, facilityId, (tx) => {
      const roles = ctx.subject!.roles;
      const groupTypes: Array<'GIAO_VIEN' | 'KINH_DOANH'> = roles.includes('super_admin')
        ? ['GIAO_VIEN', 'KINH_DOANH']
        : [
            ...(roles.includes('giam_doc_dao_tao') ? (['GIAO_VIEN'] as const) : []),
            ...(roles.includes('giam_doc_kinh_doanh') ? (['KINH_DOANH'] as const) : []),
          ];
      return tx.shiftRegistration.findMany({
        where: { facilityId, status: 'submitted', shiftGroup: { type: { in: groupTypes } } },
        include: { appUser: { select: { fullName: true } }, shiftGroup: true, entries: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  }),

  // -------------------------------------------------------------------------
  // shift.cancel — owner or director cancels (approved state is cancellable)
  // -------------------------------------------------------------------------
  cancel: protectedProcedure
    .input(cancelInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const registration = await tx.shiftRegistration.findFirst({
          where: { id: input.registrationId, facilityId },
        });
        if (!registration) throw notFound('ShiftRegistration not found.');
        if (registration.status === 'cancelled') {
          throw badRequest('Registration is already cancelled.');
        }

        // Resolve caller's AppUser (may not exist for super_admin in tests)
        const callerAppUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        const isOwner = callerAppUser && callerAppUser.id === registration.appUserId;
        const isDirector = ctx.subject!.roles.some((r) =>
          ['super_admin', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'].includes(r),
        );

        if (!isOwner && !isDirector) {
          throw forbidden('Only the registration owner or a director can cancel.');
        }

        return tx.shiftRegistration.update({
          where: { id: registration.id },
          data: { status: 'cancelled', updatedAt: new Date() },
        });
      });
    }),
});

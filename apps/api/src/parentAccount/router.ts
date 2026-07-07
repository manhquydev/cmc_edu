// parentAccount router — staff-facing parent account management.
// Only `updateEmail` today: backfills email for parents provisioned before
// email capture was added (phase-01b). Email is required for LMS parent login
// (email-OTP); parents without an email cannot log into the LMS app.

import { z } from 'zod';
import { conflict, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

export const parentAccountRouter = router({
  /**
   * Staff updates (or sets for the first time) the email on a ParentAccount.
   * Facility-scoped via the Guardian link: the parent must have at least one
   * approved child in the caller's facility, preventing cross-facility edits.
   * Triggers an audit log entry for PII mutation traceability (docs/08 §7).
   */
  updateEmail: requirePermission('parentAccount', 'updateEmail')
    .input(
      z.object({
        parentAccountId: z.string().uuid(),
        email: z.string().email().max(254),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      // Facility scope: caller must have at least one Guardian link to this parent.
      const guardian = await ctx.db.guardian.findFirst({
        where: { parentAccountId: input.parentAccountId, facilityId },
        select: { id: true },
      });
      if (!guardian) throw notFound('ParentAccount not found in this facility.');

      // Check for email uniqueness before writing (Prisma @unique on ParentAccount.email).
      const existing = await ctx.db.parentAccount.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing && existing.id !== input.parentAccountId) {
        throw conflict('Email already used by another parent account.');
      }

      const updated = await ctx.db.parentAccount.update({
        where: { id: input.parentAccountId },
        data: { email: input.email },
        select: { id: true, phone: true, email: true },
      });

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject!.userId,
          action: 'parentAccount.updateEmail',
          entity: 'ParentAccount',
          entityId: input.parentAccountId,
          data: { facilityId },
        },
      });

      return updated;
    }),
});

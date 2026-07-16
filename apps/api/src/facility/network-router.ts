// facilityNetwork CRUD + IP self-detect — phase-03 super-admin-completion.
// `facilityNetwork.manage` was already registered in @cmc/auth (packages/auth
// /src/index.ts:91) but unused: checkin/router.ts only ever READ
// FacilityNetwork rows to gate `checkInOut.punch`. This router is the first
// admin-facing writer.
//
// PO decision (ADR 0043 track): a newly created range defaults to
// `isActive=false` — adding a range must never silently start requiring an
// offsite reason for staff already punching in; the admin reviews and flips
// it on deliberately via `update({ isActive: true })`.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { isValidCidr } from '@cmc/domain-identity';
import { requirePermission, router, scoped } from '../trpc.js';

const cidrField = z.string().min(1).refine(isValidCidr, { message: 'CIDR không hợp lệ.' });

const createInput = z.object({
  cidr: cidrField,
  label: z.string().max(200).default(''),
});

const updateInput = z.object({
  id: z.string().min(1),
  cidr: cidrField.optional(),
  label: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

const deleteInput = z.object({ id: z.string().min(1) });

export const facilityNetworkRouter = router({
  list: requirePermission('facilityNetwork', 'manage').query(async ({ ctx }) => {
    const { facilityId } = scoped(ctx);
    return withFacility(ctx.db, facilityId, (tx) =>
      tx.facilityNetwork.findMany({ where: { facilityId }, orderBy: { createdAt: 'desc' } }),
    );
  }),

  create: requirePermission('facilityNetwork', 'manage')
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const network = await withFacility(ctx.db, facilityId, (tx) =>
        tx.facilityNetwork.create({
          data: { facilityId, cidr: input.cidr, label: input.label, isActive: false },
        }),
      );

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facilityNetwork.create',
          entity: 'FacilityNetwork',
          entityId: network.id,
          data: { cidr: network.cidr, label: network.label, isActive: network.isActive },
        },
      });

      return network;
    }),

  update: requirePermission('facilityNetwork', 'manage')
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const network = await withFacility(ctx.db, facilityId, (tx) =>
        tx.facilityNetwork.update({
          where: { id: input.id },
          data: {
            ...(input.cidr !== undefined ? { cidr: input.cidr } : {}),
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        }),
      );

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facilityNetwork.update',
          entity: 'FacilityNetwork',
          entityId: network.id,
          data: { cidr: network.cidr, label: network.label, isActive: network.isActive },
        },
      });

      return network;
    }),

  delete: requirePermission('facilityNetwork', 'manage')
    .input(deleteInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      await withFacility(ctx.db, facilityId, (tx) => tx.facilityNetwork.delete({ where: { id: input.id } }));

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'facilityNetwork.delete',
          entity: 'FacilityNetwork',
          entityId: input.id,
          data: {},
        },
      });

      return { id: input.id };
    }),

  /** Returns the caller's own public IP (from `ctx.ip`) plus suggested CIDRs
   *  to pre-fill the create form. `ip: null` (no forwarded-for header seen,
   *  e.g. local dev) tells the UI to fall back to the manual-entry guidance —
   *  it never guesses. */
  detectMyIp: requirePermission('facilityNetwork', 'manage').query(({ ctx }) => {
    if (!ctx.ip) {
      return { ip: null, suggestedCidr32: null, suggestedCidr24: null };
    }
    const octets = ctx.ip.split('.');
    const cidr24 = octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24` : null;
    return {
      ip: ctx.ip,
      suggestedCidr32: `${ctx.ip}/32`,
      suggestedCidr24: cidr24,
    };
  }),
});

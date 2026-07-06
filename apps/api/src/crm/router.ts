// crm router — WF-P1-01 (Lead -> O1..O5 pipeline).
//
// Every procedure scopes reads/writes via `scoped(ctx)` (server-resolved
// facilityId, never trusted from client input) and gates via
// `requirePermission('crm', action)`, which reads the single @cmc/auth
// registry (docs/11 §1).

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

/** Full OpportunityStage catalog (docs/10). */
const STAGE_VALUES = [
  'O1_LEAD',
  'O2_CONTACTED',
  'O3_TEST_SCHEDULED',
  'O4_TESTED',
  'O5_ENROLLED',
] as const;

/** Linear advance order (docs/24 WF-P1-01 state machine) — one stage at a time. */
const ADVANCE_ORDER = ['O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const;

const LOST_REASON_VALUES = [
  'no_response',
  'price_too_high',
  'chose_competitor',
  'schedule_conflict',
  'not_interested',
  'other',
] as const;

async function findOpportunityOrThrow(
  tx: Prisma.TransactionClient,
  facilityId: string,
  opportunityId: string,
) {
  const opportunity = await tx.opportunity.findFirst({
    where: { id: opportunityId, facilityId },
  });
  // Out-of-facility ids look identical to non-existent ones (RLS — TL11 §2).
  if (!opportunity) {
    throw notFound('Opportunity not found.');
  }
  return opportunity;
}

const opportunityCreateInput = z.object({
  contactName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
});

const opportunityAdvanceInput = z.object({
  opportunityId: z.string().uuid(),
  toStage: z.enum(STAGE_VALUES),
});

const opportunityMarkLostInput = z.object({
  opportunityId: z.string().uuid(),
  lostReason: z.enum(LOST_REASON_VALUES).optional(),
  /** Reopen a lost opportunity back to O2_CONTACTED (WF-P1-01 state machine). */
  reopen: z.boolean().optional().default(false),
});

const opportunityLookupInput = z.object({
  phone: z.string().min(1),
});

const opportunityListInput = z.object({
  stage: z.enum(STAGE_VALUES).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const crmRouter = router({
  opportunityCreate: requirePermission('crm', 'opportunityCreate')
    .input(opportunityCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        // Reuse an existing Contact for this phone within the facility rather
        // than creating a duplicate (dedup — FE should also call
        // `opportunityLookup` before showing the create form, QD 0037).
        const contact =
          (await tx.contact.findFirst({ where: { facilityId, phone: input.phone } })) ??
          (await tx.contact.create({
            data: { facilityId, name: input.contactName, phone: input.phone, email: input.email },
          }));

        const opportunity = await tx.opportunity.create({
          data: { facilityId, contactId: contact.id, stage: 'O1_LEAD' },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'crm.opportunityCreate',
            entity: 'Opportunity',
            entityId: opportunity.id,
            data: { facilityId, contactId: contact.id },
          },
        });

        return opportunity;
      });
    }),

  opportunityAdvance: requirePermission('crm', 'opportunityAdvance')
    .input(opportunityAdvanceInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const opportunity = await findOpportunityOrThrow(tx, facilityId, input.opportunityId);

        // HARD RULE (WF-P1-01): O5_ENROLLED is only ever set by
        // `finance.receiptApprove` on receipt approval — never by a manual
        // stage advance.
        if (input.toStage === 'O5_ENROLLED') {
          throw badRequest('O5_ENROLLED can only be reached via finance.receiptApprove, not opportunityAdvance.');
        }

        if (opportunity.closedAt) {
          throw badRequest('Opportunity is marked lost; reopen it before advancing.');
        }

        const currentIndex = ADVANCE_ORDER.indexOf(opportunity.stage as (typeof ADVANCE_ORDER)[number]);
        const targetIndex = ADVANCE_ORDER.indexOf(input.toStage as (typeof ADVANCE_ORDER)[number]);
        if (currentIndex === -1 || targetIndex !== currentIndex + 1) {
          throw badRequest(
            `Invalid stage transition from ${opportunity.stage} to ${input.toStage}; opportunities advance one stage at a time.`,
          );
        }

        return tx.opportunity.update({
          where: { id: opportunity.id },
          data: { stage: input.toStage },
        });
      });
    }),

  opportunityMarkLost: requirePermission('crm', 'opportunityMarkLost')
    .input(opportunityMarkLostInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const opportunity = await findOpportunityOrThrow(tx, facilityId, input.opportunityId);

        if (input.reopen) {
          if (!opportunity.closedAt) {
            throw badRequest('Opportunity is not marked lost; nothing to reopen.');
          }
          return tx.opportunity.update({
            where: { id: opportunity.id },
            data: { stage: 'O2_CONTACTED', lostReason: null, closedAt: null },
          });
        }

        if (!input.lostReason) {
          throw badRequest('lostReason is required to mark an opportunity lost.');
        }

        return tx.opportunity.update({
          where: { id: opportunity.id },
          data: { lostReason: input.lostReason, closedAt: new Date() },
        });
      });
    }),

  opportunityLookup: requirePermission('crm', 'opportunityLookup')
    .input(opportunityLookupInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      // Narrow existence check only (QD 0037 dedup) — never the full pipeline.
      return withFacility(ctx.db, facilityId, async (tx) => {
        const contact = await tx.contact.findFirst({
          where: { facilityId, phone: input.phone },
          select: { id: true },
        });
        return { exists: contact !== null };
      });
    }),

  opportunityList: requirePermission('crm', 'opportunityList')
    .input(opportunityListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const where = { facilityId, ...(input.stage ? { stage: input.stage } : {}) };

      return withFacility(ctx.db, facilityId, async (tx) => {
        const [items, total] = await Promise.all([
          tx.opportunity.findMany({
            where,
            include: { contact: { select: { id: true, name: true, phone: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.opportunity.count({ where }),
        ]);

        return { items, total, page: input.page, pageSize: input.pageSize };
      });
    }),
});

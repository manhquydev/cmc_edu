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
import { isOpportunityLost } from './opportunity-lost.js';
import { findOrCreateContact } from './find-or-create-contact.js';
import { normalizeContactPhone, toContactPhoneSearchDigits } from './normalize-contact-phone.js';

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

const opportunityGetInput = z.object({
  opportunityId: z.string().uuid(),
});

const opportunityListInput = z.object({
  stage: z.enum(STAGE_VALUES).optional(),
  /** Free-text search over the linked contact's name (case-insensitive) OR
   * phone (digits only, so formatting variance doesn't matter). */
  search: z.string().trim().min(1).max(100).optional(),
  /** Lost-opportunity visibility. Default `exclude` — a lost opp (closedAt set,
   * stage != O5) must NOT appear in the default pipeline/funnel (F7). `only`
   * returns just the lost ones; `include` returns everything (used by the
   * detail page, which must be able to open a lost opp). */
  lost: z.enum(['exclude', 'include', 'only']).default('exclude'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

/** Prisma where-fragment for "not lost" — open (no closedAt) OR won (O5). */
const NOT_LOST_WHERE: Prisma.OpportunityWhereInput = {
  OR: [{ closedAt: null }, { stage: 'O5_ENROLLED' }],
};
/** Prisma where-fragment for "lost" — closed without enrolling. */
const LOST_WHERE: Prisma.OpportunityWhereInput = {
  closedAt: { not: null },
  stage: { not: 'O5_ENROLLED' },
};

export const crmRouter = router({
  opportunityCreate: requirePermission('crm', 'opportunityCreate')
    .input(opportunityCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        // Reuse an existing Contact for this phone within the facility rather
        // than creating a duplicate (dedup — FE should also call
        // `opportunityLookup` before showing the create form, QD 0037). The
        // shared helper normalizes the phone and is race-safe against the
        // `@@unique([facilityId, phone])` index (phase-08).
        const contact = await findOrCreateContact(tx, {
          facilityId,
          name: input.contactName,
          phone: input.phone,
          email: input.email,
        });

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
        // Lock the opportunity row FOR UPDATE before reading its stage: a
        // concurrent `finance.receiptApprove` also locks it (finance/router.ts)
        // before advancing to O5, so the two serialize — without this lock,
        // markLost could read a pre-O5 snapshot and stamp lostReason+closedAt
        // onto a row that approve just enrolled, producing a corrupt
        // "O5 + lostReason" record.
        const lockedRows = await tx.$queryRaw<{ id: string; stage: string; closedAt: Date | null }[]>`
          SELECT "id", "stage", "closedAt" FROM "Opportunity"
          WHERE "id" = ${input.opportunityId} AND "facilityId" = ${facilityId}
          FOR UPDATE
        `;
        const opportunity = lockedRows[0];
        // Out-of-facility ids look identical to non-existent ones (RLS — TL11 §2).
        if (!opportunity) {
          throw notFound('Opportunity not found.');
        }

        if (input.reopen) {
          // Only a genuinely LOST opportunity is reopenable. A won (O5) opp
          // also carries a closedAt (the enrollment instant), so the naive
          // `!closedAt` check would let `reopen` silently revert an enrolled
          // opp to O2 while the paying student stays provisioned — the same
          // win/loss corruption the mark-lost O5 reject below prevents, from
          // the other direction. Undoing an enrollment must go through
          // receiptCancel (which reverts O5 -> O4), never a manual reopen.
          if (opportunity.stage === 'O5_ENROLLED') {
            throw badRequest('Đã ghi danh — dùng hủy phiếu thu (receiptCancel) để hoàn tác ghi danh, không mở lại cơ hội.');
          }
          if (!isOpportunityLost(opportunity)) {
            throw badRequest('Opportunity is not marked lost; nothing to reopen.');
          }
          return tx.opportunity.update({
            where: { id: opportunity.id },
            data: { stage: 'O2_CONTACTED', lostReason: null, closedAt: null },
          });
        }

        // A won (enrolled) opportunity cannot be marked lost — the sanctioned
        // way to undo an enrollment is `finance.receiptCancel`, which reverts
        // O5 -> O4 automatically. Hard reject (not a silent no-op) so an
        // operator mistake surfaces instead of corrupting the win/loss record.
        if (opportunity.stage === 'O5_ENROLLED') {
          throw badRequest('Đã ghi danh — dùng hủy phiếu thu (receiptCancel) thay vì đánh dấu mất.');
        }

        if (!input.lostReason) {
          throw badRequest('lostReason is required to mark an opportunity lost.');
        }

        return tx.opportunity.update({
          where: { id: opportunity.id },
          data: {
            lostReason: input.lostReason,
            // Preserve the ORIGINAL lost instant when re-marking an
            // already-lost opp (e.g. correcting the reason) — only stamp a
            // fresh timestamp on the first close, so reporting sees a stable
            // lost date.
            closedAt: opportunity.closedAt ?? new Date(),
          },
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
          // Normalize so a lookup for "0912..." matches a stored "84912..."
          // (phase-08) — otherwise the dedup check the UI relies on would miss
          // an existing contact entered in a different format.
          where: { facilityId, phone: normalizeContactPhone(input.phone) },
          select: { id: true },
        });
        return { exists: contact !== null };
      });
    }),

  opportunityGet: requirePermission('crm', 'opportunityList')
    .input(opportunityGetInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const opportunity = await tx.opportunity.findFirst({
          where: { id: input.opportunityId, facilityId },
          include: { contact: { select: { name: true, phone: true, email: true } } },
        });
        if (!opportunity) {
          throw notFound('Opportunity not found.');
        }
        return {
          id: opportunity.id,
          stage: opportunity.stage,
          contact: opportunity.contact,
        };
      });
    }),

  opportunityList: requirePermission('crm', 'opportunityList')
    .input(opportunityListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      // Build the row filter as an AND of independent fragments so stage, lost
      // visibility, and text search compose without clobbering each other.
      const and: Prisma.OpportunityWhereInput[] = [{ facilityId }];
      if (input.stage) and.push({ stage: input.stage });
      if (input.lost === 'exclude') and.push(NOT_LOST_WHERE);
      else if (input.lost === 'only') and.push(LOST_WHERE);
      if (input.search) {
        // Name is matched case-insensitively as entered; phone is matched on
        // digits only so "090 123", "090-123" and "090123" all hit the same
        // stored value (Contact.phone is stored as-entered until phase 8).
        const nameTerm = input.search;
        // Align the phone match with the stored, normalized `84xxxxxxxxx` form
        // (phase-08): a leading '0' becomes '84' so "0912" still finds
        // "84912345678".
        const phoneTerm = toContactPhoneSearchDigits(input.search);
        and.push({
          contact: {
            OR: [
              { name: { contains: nameTerm, mode: 'insensitive' } },
              ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
            ],
          },
        });
      }
      const where: Prisma.OpportunityWhereInput = { AND: and };

      return withFacility(ctx.db, facilityId, async (tx) => {
        const [items, total, stageCountRows, lostCount] = await Promise.all([
          tx.opportunity.findMany({
            where,
            include: { contact: { select: { id: true, name: true, phone: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.opportunity.count({ where }),
          // Funnel counts are facility-wide and ALWAYS exclude lost (F7), so
          // phase 6's funnel can consume them without re-querying — independent
          // of the current page's stage/search/lost filters.
          tx.opportunity.groupBy({
            by: ['stage'],
            where: { AND: [{ facilityId }, NOT_LOST_WHERE] },
            _count: { _all: true },
          }),
          tx.opportunity.count({ where: { AND: [{ facilityId }, LOST_WHERE] } }),
        ]);

        const stageCounts: Record<string, number> = {};
        for (const row of stageCountRows) stageCounts[row.stage] = row._count._all;

        return { items, total, page: input.page, pageSize: input.pageSize, stageCounts, lostCount };
      });
    }),
});

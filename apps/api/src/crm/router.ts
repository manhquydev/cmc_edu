// crm router — WF-P1-01 (Lead -> O1..O5 pipeline).
//
// Every procedure scopes reads/writes via `scoped(ctx)` (server-resolved
// facilityId, never trusted from client input) and gates via
// `requirePermission('crm', action)`, which reads the single @cmc/auth
// registry (docs/11 §1).

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import { badRequest, forbidden, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { isOpportunityLost } from './opportunity-lost.js';
import { findOrCreateContact } from './find-or-create-contact.js';
import { normalizeContactPhone, toContactPhoneSearchDigits } from './normalize-contact-phone.js';
import { advanceOpportunityOneStep } from './advance-opportunity.js';
import { isOpportunityRotting } from './rotting.js';
import {
  buildOpportunityReport,
  LOST_WHERE,
  NOT_LOST_WHERE,
} from './opportunity-report.js';

/** Full OpportunityStage catalog (docs/10). */
const STAGE_VALUES = [
  'O1_LEAD',
  'O2_CONTACTED',
  'O3_TEST_SCHEDULED',
  'O4_TESTED',
  'O5_ENROLLED',
] as const;

const LOST_REASON_VALUES = [
  'no_response',
  'price_too_high',
  'chose_competitor',
  'schedule_conflict',
  'not_interested',
  'other',
] as const;

/** Lead source (phase-10). Enforced at the API layer only — no DB enum (KISS). */
const SOURCE_VALUES = ['referral', 'walkin', 'fanpage', 'hotline', 'event', 'other'] as const;

const contactPhoneInput = z
  .string()
  .trim()
  .min(1)
  .refine((value) => /\d/.test(value), { message: 'Phone must contain at least one digit.' });

const opportunityCreateInput = z.object({
  contactName: z.string().min(1),
  phone: contactPhoneInput,
  email: z.string().email().optional(),
  source: z.enum(SOURCE_VALUES).optional(),
});

const opportunityAssignInput = z.object({
  opportunityId: z.string().uuid(),
  /** The assignee's login userId (AppUser.userId), or null to unassign. */
  assigneeUserId: z.string().min(1).nullable(),
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
  phone: contactPhoneInput,
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

/** Inclusive ISO datetime range for the report period (client converts ICT dates). */
const opportunityReportInput = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((v) => new Date(v.from).getTime() <= new Date(v.to).getTime(), {
    message: 'from must be on or before to',
  });

// NOT_LOST_WHERE / LOST_WHERE: single source in opportunity-report.ts (list + report).

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

        // phase-10: a `sale` owns the leads they create (KPI attribution);
        // a pure GĐ KD creates unassigned and picks an owner later via
        // opportunityAssign. Resolve the caller's AppUser.id (nullable —
        // mirrors Receipt.createdByAppUserId; a context with no AppUser row
        // simply leaves the lead unowned).
        let assignedToId: string | null = null;
        if (ctx.subject.roles.includes('sale')) {
          const callerAppUser = await tx.appUser.findFirst({
            where: { userId: ctx.subject.userId, facilityId },
            select: { id: true },
          });
          assignedToId = callerAppUser?.id ?? null;
        }

        const opportunity = await tx.opportunity.create({
          data: {
            facilityId,
            contactId: contact.id,
            stage: 'O1_LEAD',
            assignedToId,
            source: input.source ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'crm.opportunityCreate',
            entity: 'Opportunity',
            entityId: opportunity.id,
            data: { facilityId, contactId: contact.id, assignedToId, source: input.source ?? null },
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
        // HARD RULE (WF-P1-01): O5_ENROLLED is only ever set by
        // `finance.receiptApprove` on receipt approval — never by a manual
        // stage advance.
        if (input.toStage === 'O5_ENROLLED') {
          throw badRequest('O5_ENROLLED can only be reached via finance.receiptApprove, not opportunityAdvance.');
        }

        // Shared one-step advance (locks FOR UPDATE, rejects lost + non-adjacent
        // targets). The tRPC audit middleware records this call automatically.
        const { opportunity } = await advanceOpportunityOneStep(
          tx,
          facilityId,
          input.opportunityId,
          input.toStage,
        );
        return opportunity;
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
          // Reopen is a CRM stage UPDATE → reset rotting clock (P2).
          return tx.opportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: 'O2_CONTACTED',
              lostReason: null,
              closedAt: null,
              stageChangedAt: new Date(),
            },
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

  opportunityAssign: requirePermission('crm', 'opportunityAssign')
    .input(opportunityAssignInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const isManager = ctx.subject.roles.includes('giam_doc_kinh_doanh');
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Lock the opp so the ownership decision can't race a concurrent assign.
        const rows = await tx.$queryRaw<{ id: string; assignedToId: string | null }[]>`
          SELECT "id", "assignedToId" FROM "Opportunity"
          WHERE "id" = ${input.opportunityId} AND "facilityId" = ${facilityId}
          FOR UPDATE
        `;
        const opp = rows[0];
        if (!opp) throw notFound('Opportunity not found.');

        // Resolve the target staff (null = unassign).
        let newAssignedToId: string | null = null;
        if (input.assigneeUserId) {
          const target = await tx.appUser.findFirst({
            where: { userId: input.assigneeUserId, facilityId },
            select: { id: true },
          });
          if (!target) throw badRequest('Người được giao không phải nhân sự của cơ sở này.');
          newAssignedToId = target.id;
        }

        // Row-level rule (the registry can() is role-only): a `sale` may claim a
        // lead ONLY for themselves, and ONLY when it is currently unassigned or
        // already theirs. A GĐ KD may assign anyone (and unassign).
        if (!isManager) {
          if (input.assigneeUserId !== ctx.subject.userId) {
            throw forbidden('Bạn chỉ có thể nhận cơ hội cho chính mình.');
          }
          const self = await tx.appUser.findFirst({
            where: { userId: ctx.subject.userId, facilityId },
            select: { id: true },
          });
          const selfId = self?.id ?? null;
          if (opp.assignedToId !== null && opp.assignedToId !== selfId) {
            throw forbidden('Cơ hội này đã thuộc về người khác.');
          }
        }

        return tx.opportunity.update({
          where: { id: opp.id },
          data: { assignedToId: newAssignedToId },
        });
      });
    }),

  /** Active staff assignable as opportunity owners (for the detail owner-select).
   * Gated on the same key as opportunityAssign — a sale can call it but only
   * needs their own id; a GĐ KD uses it to pick any owner. */
  assignableStaff: requirePermission('crm', 'opportunityAssign')
    .query(async ({ ctx }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.appUser.findMany({
          where: { facilityId, isActive: true },
          select: { userId: true, fullName: true },
          orderBy: { fullName: 'asc' },
        }),
      );
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
          include: {
            contact: { select: { id: true, name: true, phone: true, email: true } },
          },
        });
        if (!opportunity) {
          throw notFound('Opportunity not found.');
        }
        const assignedTo = opportunity.assignedToId
          ? await tx.appUser.findFirst({
              where: { id: opportunity.assignedToId, facilityId },
              select: { userId: true, fullName: true },
            })
          : null;
        return {
          id: opportunity.id,
          stage: opportunity.stage,
          closedAt: opportunity.closedAt,
          lostReason: opportunity.lostReason,
          source: opportunity.source,
          assignedTo,
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

        // phase-10: resolve owner display names for the page's items (AppUser has
        // no Prisma relation to Opportunity — a second facility-scoped query,
        // same pattern as the after-sale/meeting list student-name join).
        const ownerIds = [...new Set(items.map((i) => i.assignedToId).filter((v): v is string => Boolean(v)))];
        const owners = ownerIds.length
          ? await tx.appUser.findMany({ where: { id: { in: ownerIds } }, select: { id: true, userId: true, fullName: true } })
          : [];
        const ownerById = new Map(owners.map((o) => [o.id, { userId: o.userId, fullName: o.fullName }]));
        const now = new Date();
        const itemsWithOwner = items.map((i) => ({
          ...i,
          assignedTo: i.assignedToId ? ownerById.get(i.assignedToId) ?? null : null,
          // Derived at read time (P2) — no flag table / worker.
          isRotting: isOpportunityRotting({
            stage: i.stage,
            closedAt: i.closedAt,
            stageChangedAt: i.stageChangedAt,
            createdAt: i.createdAt,
          }, now),
        }));

        return { items: itemsWithOwner, total, page: input.page, pageSize: input.pageSize, stageCounts, lostCount };
      });
    }),

  /**
   * Read-only recruitment report: current funnel snapshot + createdAt cohort +
   * closedAt outcomes. Sale callers see facility-wide funnel/source but only
   * their own byAssignee KPI rows (procedure-layer own-only).
   */
  opportunityReport: requirePermission('crm', 'report')
    .input(opportunityReportInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const from = new Date(input.from);
      const to = new Date(input.to);

      // GĐKD (and super_admin via can()) see the full team KPI table; a pure
      // sale is restricted to their own AppUser row for byAssignee only.
      const isManager =
        ctx.subject.roles.includes('giam_doc_kinh_doanh') ||
        ctx.subject.roles.includes('super_admin');

      return withFacility(ctx.db, facilityId, async (tx) => {
        let ownAssigneeId: string | null = null;
        if (!isManager) {
          const callerAppUser = await tx.appUser.findFirst({
            where: { userId: ctx.subject.userId, facilityId },
            select: { id: true },
          });
          // No AppUser row ⇒ empty byAssignee (never match a real owner id).
          ownAssigneeId = callerAppUser?.id ?? '00000000-0000-0000-0000-000000000000';
        }

        // TransactionClient satisfies OpportunityReportDb at runtime; cast avoids
        // Prisma groupBy generic variance fighting the helper's narrow surface.
        return buildOpportunityReport(tx as never, {
          facilityId,
          from,
          to,
          ownAssigneeId,
        });
      });
    }),
});

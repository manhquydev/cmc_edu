// parentAccount router — staff-facing parent account management.
// `list` + `updateEmail`: `list` is the discovery step — provisioning
// (finance/provisioning/provision-from-receipt.ts) creates ParentAccount rows
// directly, so they never appear in guardian.listPendingLinks (that queue is
// only for self-service link requests). Without `list`, staff had no way to
// find a parent to backfill their email. `updateEmail` backfills email for
// parents provisioned before email capture was added (phase-01b). Email is
// required for LMS parent login (email-OTP); parents without an email cannot
// log into the LMS app, and their child can never have its password reset
// either (parent-only action).

import { z } from 'zod';
import type { Prisma } from '@cmc/db';
import { withFacility } from '@cmc/db';
import { conflict, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

const getInput = z.object({
  parentAccountId: z.string().uuid(),
});

const setActiveInput = z.object({
  parentAccountId: z.string().uuid(),
  isActive: z.boolean(),
});

const listInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  /** Narrows to parents locked out of LMS login — the actionable subset. */
  missingEmailOnly: z.boolean().optional(),
  /** Matches phone (substring) or email (substring, case-insensitive). */
  search: z.string().trim().min(1).max(254).optional(),
});

export interface ParentAccountListItemDto {
  id: string;
  phone: string;
  email: string | null;
  /** Guardian rows in the caller's facility — "số con đã liên kết". */
  linkedChildrenCount: number;
  createdAt: Date;
}

export const parentAccountRouter = router({
  /**
   * Cold-start form /admin/parents/:id — facility-scoped via Guardian link.
   */
  get: requirePermission('parentAccount', 'updateEmail')
    .input(getInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      // ParentAccount has no facilityId; scope via Guardian. Student names need
      // facility RLS context (withFacility), same pattern as afterSale.list.
      return withFacility(ctx.db, facilityId, async (tx) => {
        const guardian = await tx.guardian.findFirst({
          where: { parentAccountId: input.parentAccountId, facilityId },
          select: { id: true },
        });
        if (!guardian) throw notFound('ParentAccount not found in this facility.');

        const parent = await tx.parentAccount.findFirst({
          where: { id: input.parentAccountId },
          select: {
            id: true,
            phone: true,
            email: true,
            isActive: true,
            tokenVersion: true,
            createdAt: true,
            _count: { select: { guardians: { where: { facilityId } } } },
          },
        });
        if (!parent) throw notFound('ParentAccount not found.');

        const links = await tx.guardian.findMany({
          where: { parentAccountId: parent.id, facilityId },
          select: { id: true, relation: true, studentId: true },
          orderBy: { createdAt: 'asc' },
        });
        const studentIds = [...new Set(links.map((g) => g.studentId))];
        const students = studentIds.length
          ? await tx.student.findMany({
              where: { facilityId, id: { in: studentIds } },
              select: { id: true, fullName: true },
            })
          : [];
        const nameById = new Map(students.map((s) => [s.id, s.fullName]));

        return {
          id: parent.id,
          phone: parent.phone,
          email: parent.email,
          isActive: parent.isActive,
          tokenVersion: parent.tokenVersion,
          createdAt: parent.createdAt,
          linkedChildrenCount: parent._count.guardians,
          children: links.map((g) => ({
            guardianId: g.id,
            relation: g.relation,
            studentId: g.studentId,
            studentName: nameById.get(g.studentId) ?? null,
          })),
        };
      });
    }),

  /**
   * Staff-facing directory of parents scoped to the caller's facility (via
   * their Guardian link — ParentAccount itself carries no facilityId).
   * `Guardian` has no RLS policy (schema.prisma), so this is a plain `ctx.db`
   * call with an explicit facilityId filter, same as `updateEmail` below —
   * never an unscoped `ctx.db.parentAccount.findMany()`.
   */
  list: requirePermission('parentAccount', 'updateEmail')
    .input(listInput)
    .query(async ({ ctx, input }): Promise<{
      items: ParentAccountListItemDto[];
      total: number;
      page: number;
      pageSize: number;
    }> => {
      const { facilityId } = scoped(ctx);

      const where: Prisma.ParentAccountWhereInput = {
        guardians: { some: { facilityId } },
        ...(input.missingEmailOnly ? { email: null } : {}),
        ...(input.search
          ? {
              OR: [
                { phone: { contains: input.search } },
                { email: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        ctx.db.parentAccount.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            phone: true,
            email: true,
            createdAt: true,
            _count: { select: { guardians: { where: { facilityId } } } },
          },
        }),
        ctx.db.parentAccount.count({ where }),
      ]);

      const items: ParentAccountListItemDto[] = rows.map((row) => ({
        id: row.id,
        phone: row.phone,
        email: row.email,
        linkedChildrenCount: row._count.guardians,
        createdAt: row.createdAt,
      }));

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),

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

  /**
   * Soft-disable / re-enable a ParentAccount for LMS login. Deactivation
   * increments tokenVersion so outstanding signed LMS tokens fail the
   * lmsProcedure gate (forced re-login). Facility-scoped via Guardian.
   */
  setActive: requirePermission('parentAccount', 'setActive')
    .input(setActiveInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      const guardian = await ctx.db.guardian.findFirst({
        where: { parentAccountId: input.parentAccountId, facilityId },
        select: { id: true },
      });
      if (!guardian) throw notFound('ParentAccount not found in this facility.');

      const updated = await ctx.db.parentAccount.update({
        where: { id: input.parentAccountId },
        data: input.isActive
          ? { isActive: true }
          : { isActive: false, tokenVersion: { increment: 1 } },
        select: { id: true, isActive: true, tokenVersion: true },
      });

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject!.userId,
          action: 'parentAccount.setActive',
          entity: 'ParentAccount',
          entityId: input.parentAccountId,
          data: {
            facilityId,
            isActive: updated.isActive,
            tokenVersion: updated.tokenVersion,
          },
        },
      });

      return updated;
    }),
});

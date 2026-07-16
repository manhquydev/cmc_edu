// Session evidence + photo consent router — T3 (US-019, docs/26 WF-P2-08, C2,
// TL08 §7).
//
// Staff surface: upsert · addPhoto · publish
// LMS surface:  listForChild (published evidence for approved parent→child)
//               guardian.setPhotoConsent (parent grants/revokes photo consent)
//
// Key invariants (test-verified):
//   1. `internalNote` NEVER serialized in LMS responses — not null, not empty
//      string, not present at all (stripped at the DTO boundary).
//   2. Photos returned ONLY when Guardian.photoConsent = true AND
//      photoConsentRevokedAt IS NULL.
//   3. Parent without an approved Guardian link → FORBIDDEN on all LMS reads.
//   4. Only `published` evidence is visible to parents.
//
// All DB calls are facility-scoped via `withFacility` (ADR 0042). Guardian
// carries no RLS policy (same exemption as ParentAccount/StudentAccount) so
// consent updates use a plain `db.guardian.update` after the ownership check.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, forbidden, notFound } from '../errors.js';
import { lmsProcedure, requireLmsParent, requirePermission, router, scoped } from '../trpc.js';
import {
  auditChildDataAccess,
  getApprovedChildren,
} from '../guardian/approved-children.js';
import { assertTeacherOwnsClass, assertTeacherOwnsSessionClass } from '../attendance/assert-teacher-owns-class.js';
import { assertSessionActive } from '../class/assert-session-active.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/** Staff DTO — includes internalNote. NEVER send to LMS callers. */
export interface SessionEvidenceStaffDto {
  id: string;
  facilityId: string;
  classSessionId: string;
  summary: string;
  internalNote: string;
  status: string;
  publishedById: string | null;
  publishedAt: Date | null;
  photos: EvidencePhotoDto[];
  createdAt: Date;
  updatedAt: Date;
}

/** LMS DTO — internalNote field is absent entirely (not null, not '').
 * Photos are conditionally included based on photoConsent gate. */
export interface SessionEvidenceLmsDto {
  id: string;
  classSessionId: string;
  summary: string;
  publishedAt: Date | null;
  photos: EvidencePhotoDto[];
}

export interface EvidencePhotoDto {
  id: string;
  blobRef: string;
  createdAt: Date;
}

function toStaffDto(
  row: {
    id: string;
    facilityId: string;
    classSessionId: string;
    summary: string;
    internalNote: string;
    status: string;
    publishedById: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    photos: Array<{ id: string; blobRef: string; createdAt: Date }>;
  },
): SessionEvidenceStaffDto {
  return {
    id: row.id,
    facilityId: row.facilityId,
    classSessionId: row.classSessionId,
    summary: row.summary,
    internalNote: row.internalNote,
    status: row.status,
    publishedById: row.publishedById,
    publishedAt: row.publishedAt,
    photos: row.photos.map((p) => ({ id: p.id, blobRef: p.blobRef, createdAt: p.createdAt })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Strips internalNote completely — the field must not appear in the serialized
 * output at all, not as null, not as an empty string. */
function toLmsDto(
  row: {
    id: string;
    classSessionId: string;
    summary: string;
    publishedAt: Date | null;
    photos: Array<{ id: string; blobRef: string; createdAt: Date }>;
  },
  photoConsentActive: boolean,
): SessionEvidenceLmsDto {
  return {
    id: row.id,
    classSessionId: row.classSessionId,
    summary: row.summary,
    publishedAt: row.publishedAt,
    // Photos hidden immediately when consent is not active (C2 gate).
    photos: photoConsentActive
      ? row.photos.map((p) => ({ id: p.id, blobRef: p.blobRef, createdAt: p.createdAt }))
      : [],
  };
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const upsertInput = z.object({
  classSessionId: z.string().uuid(),
  summary: z.string().max(10_000),
  internalNote: z.string().max(10_000).optional(),
});

const addPhotoInput = z.object({
  sessionEvidenceId: z.string().uuid(),
  blobRef: z.string().min(1).max(2_000),
});

const publishInput = z.object({
  sessionEvidenceId: z.string().uuid(),
});

const getBySessionInput = z.object({
  classSessionId: z.string().uuid(),
});

const listForChildInput = z.object({
  studentId: z.string().uuid(),
});

const setPhotoConsentInput = z.object({
  studentId: z.string().uuid(),
  consent: z.boolean(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sessionEvidenceRouter = router({
  // -------------------------------------------------------------------------
  // sessionEvidence.upsert — giao_vien
  // Creates or updates the SessionEvidence for a session (UNIQUE classSessionId).
  // -------------------------------------------------------------------------
  upsert: requirePermission('sessionEvidence', 'upsert')
    .input(upsertInput)
    .mutation(async ({ ctx, input }): Promise<SessionEvidenceStaffDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        // Verify the session belongs to this facility.
        const session = await tx.classSession.findFirst({
          where: { id: input.classSessionId, facilityId },
          select: { id: true, classBatchId: true, status: true },
        });
        if (!session) {
          throw notFound('ClassSession not found in this facility.');
        }
        assertSessionActive(session);
        await assertTeacherOwnsClass(tx, facilityId, ctx.subject, session.classBatchId);

        const existing = await tx.sessionEvidence.findUnique({
          where: { classSessionId: input.classSessionId },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        });

        if (existing) {
          if (existing.status === 'published') {
            throw badRequest('Published evidence cannot be edited.');
          }
          const updated = await tx.sessionEvidence.update({
            where: { id: existing.id },
            data: {
              summary: input.summary,
              internalNote: input.internalNote ?? existing.internalNote,
            },
            include: { photos: { orderBy: { createdAt: 'asc' } } },
          });
          return toStaffDto(updated);
        }

        const created = await tx.sessionEvidence.create({
          data: {
            facilityId,
            classSessionId: input.classSessionId,
            summary: input.summary,
            internalNote: input.internalNote ?? '',
          },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        });
        return toStaffDto(created);
      });
    }),

  // -------------------------------------------------------------------------
  // sessionEvidence.getBySession — giao_vien (staff read companion added
  // post-audit; upsert/addPhoto/publish previously had no read query, so a
  // UI could not show ảnh ✓/✗ status without re-deriving it client-side).
  // Same permission gate as upsert — null when no evidence row exists yet.
  // -------------------------------------------------------------------------
  getBySession: requirePermission('sessionEvidence', 'upsert')
    .input(getBySessionInput)
    .query(async ({ ctx, input }): Promise<{ status: string; photos: EvidencePhotoDto[] } | null> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: input.classSessionId, facilityId },
          select: { id: true },
        });
        if (!session) {
          throw notFound('ClassSession not found in this facility.');
        }
        // Post-implementation hardening (M1): this read had no ownership
        // check — a teacher could read any other teacher's session evidence
        // (photos + status). Every sibling mutation (upsert/addPhoto/publish)
        // already calls this same guard.
        await assertTeacherOwnsSessionClass(tx, facilityId, ctx.subject, input.classSessionId);

        const evidence = await tx.sessionEvidence.findUnique({
          where: { classSessionId: input.classSessionId },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        });
        if (!evidence) return null;

        return {
          status: evidence.status,
          photos: evidence.photos.map((p) => ({ id: p.id, blobRef: p.blobRef, createdAt: p.createdAt })),
        };
      });
    }),

  // -------------------------------------------------------------------------
  // sessionEvidence.addPhoto — giao_vien
  // -------------------------------------------------------------------------
  addPhoto: requirePermission('sessionEvidence', 'upsert')
    .input(addPhotoInput)
    .mutation(async ({ ctx, input }): Promise<EvidencePhotoDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const evidence = await tx.sessionEvidence.findFirst({
          where: { id: input.sessionEvidenceId, facilityId },
          select: { id: true, status: true, classSessionId: true },
        });
        if (!evidence) {
          throw notFound('SessionEvidence not found in this facility.');
        }
        if (evidence.status === 'published') {
          throw badRequest('Cannot add photos to published evidence.');
        }
        const session = await tx.classSession.findFirst({
          where: { id: evidence.classSessionId, facilityId },
          select: { status: true },
        });
        if (session) assertSessionActive(session);
        await assertTeacherOwnsSessionClass(tx, facilityId, ctx.subject, evidence.classSessionId);

        const photo = await tx.sessionEvidencePhoto.create({
          data: {
            facilityId,
            sessionEvidenceId: input.sessionEvidenceId,
            blobRef: input.blobRef,
          },
        });
        return { id: photo.id, blobRef: photo.blobRef, createdAt: photo.createdAt };
      });
    }),

  // -------------------------------------------------------------------------
  // sessionEvidence.publish — giao_vien
  // -------------------------------------------------------------------------
  publish: requirePermission('sessionEvidence', 'publish')
    .input(publishInput)
    .mutation(async ({ ctx, input }): Promise<SessionEvidenceStaffDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const evidence = await tx.sessionEvidence.findFirst({
          where: { id: input.sessionEvidenceId, facilityId },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        });
        if (!evidence) {
          throw notFound('SessionEvidence not found in this facility.');
        }
        if (evidence.status === 'published') {
          throw badRequest('Evidence is already published.');
        }
        const session = await tx.classSession.findFirst({
          where: { id: evidence.classSessionId, facilityId },
          select: { status: true },
        });
        if (session) assertSessionActive(session);
        await assertTeacherOwnsSessionClass(tx, facilityId, ctx.subject, evidence.classSessionId);
        // HR remediation phase 7 (R2 #H5): publishing with 0 photos was
        // previously a dead end — addPhoto refuses to touch already-published
        // evidence, so a 0-photo publish could never be completed afterward.
        // It also permanently blocks session-done's evidence condition.
        if (evidence.photos.length === 0) {
          throw badRequest('Cannot publish evidence with 0 photos.');
        }

        const updated = await tx.sessionEvidence.update({
          where: { id: evidence.id },
          data: {
            status: 'published',
            publishedById: ctx.subject!.userId,
            publishedAt: new Date(),
          },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        });
        return toStaffDto(updated);
      });
    }),

  // -------------------------------------------------------------------------
  // sessionEvidence.listForChild — LMS (parent session)
  // Returns ONLY published evidence for sessions the student's enrollments
  // attended. internalNote NEVER appears. Photos gated by photoConsent.
  // -------------------------------------------------------------------------
  // studentId comes from INPUT — parent may browse any of their approved
  // children without having a profile selected in the LMS session context.
  // Students may only access their own records (sibling scope gate).
  listForChild: lmsProcedure
    .input(listForChildInput)
    .query(async ({ ctx, input }): Promise<{ items: SessionEvidenceLmsDto[] }> => {
      const parentAccountId = ctx.lmsSubject!.parentAccountId;

      // Sibling scope gate: a student session may only view their own records,
      // never a sibling's. A parent session may browse any approved child.
      if (ctx.lmsSubject!.kind === 'student') {
        if (input.studentId !== ctx.lmsSubject!.studentId) {
          throw forbidden('Students may only access their own records.');
        }
      }

      // Guardian gate.
      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      await auditChildDataAccess(ctx.db, {
        parentAccountId,
        studentIds: [input.studentId],
        via: 'sessionEvidence.listForChild',
        actorKind: ctx.lmsSubject!.kind,
      });

      // Resolve student's facility.
      const student = await withFacility(ctx.db, null, (tx) =>
        tx.student.findUnique({
          where: { id: input.studentId },
          select: { facilityId: true },
        }),
        { bypass: true },
      );
      if (!student) throw notFound('Student not found.');

      // Check photoConsent for this parent→child Guardian row.
      // Guardian carries no RLS — plain lookup by (parentAccountId, studentId).
      const guardian = await ctx.db.guardian.findUnique({
        where: { parentAccountId_studentId: { parentAccountId, studentId: input.studentId } },
        select: { photoConsent: true, photoConsentRevokedAt: true },
      });
      const photoConsentActive =
        (guardian?.photoConsent ?? false) && guardian?.photoConsentRevokedAt === null;

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        // Find all enrollments for this student in this facility.
        const enrollments = await tx.enrollment.findMany({
          where: { studentId: input.studentId, facilityId: student.facilityId },
          select: { classBatchId: true },
        });
        const classBatchIds = enrollments.map((e) => e.classBatchId);
        if (classBatchIds.length === 0) return { items: [] };

        // Published evidence for sessions in the student's batches.
        const evidenceRows = await tx.sessionEvidence.findMany({
          where: {
            status: 'published',
            classSession: { classBatchId: { in: classBatchIds } },
          },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
          orderBy: { publishedAt: 'desc' },
        });

        return {
          items: evidenceRows.map((row) => toLmsDto(row, photoConsentActive)),
        };
      });
    }),
});

// ---------------------------------------------------------------------------
// Guardian photo consent — mounted under `guardian` key in root router.
// -------------------------------------------------------------------------

export const guardianLmsRouter = router({
  setPhotoConsent: lmsProcedure
    .input(setPhotoConsentInput)
    .mutation(async ({ ctx, input }): Promise<{ photoConsent: boolean }> => {
      const { parentAccountId } = requireLmsParent(ctx);

      // Guardian gate — verify the studentId belongs to this parent.
      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      const guardian = await ctx.db.guardian.findUnique({
        where: { parentAccountId_studentId: { parentAccountId, studentId: input.studentId } },
        select: { id: true },
      });
      if (!guardian) {
        throw notFound('Guardian link not found.');
      }

      const now = new Date();
      await ctx.db.guardian.update({
        where: { id: guardian.id },
        data: input.consent
          ? { photoConsent: true, photoConsentAt: now, photoConsentRevokedAt: null }
          : { photoConsent: false, photoConsentRevokedAt: now },
      });

      return { photoConsent: input.consent };
    }),
});

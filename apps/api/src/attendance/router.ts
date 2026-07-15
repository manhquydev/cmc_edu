// attendance router — T1 (docs/26 phase-02, TL19 §5, WF-P2-02). `mark`/`markAll`
// are the teacher-facing writers; `listBySession` is the roster read. All
// three enforce the same 5 gates (TL19 §5):
//   1. ClassSession exists (in the caller's facility) & not `cancelled`.
//   2. `enrollment.classBatchId === session.classBatchId`.
//   3. Enrollment is `active` (ADR-A: reserved/withdrawn/etc. blocked).
//   4. `facilityId` is derived server-side from the session lookup itself
//      (never a client-supplied value) — a cross-facility sessionId/
//      enrollmentId simply resolves to "not found" under RLS.
//   5. Attendance is reported by the ICT month of the session's END time
//      (`ictMonthOf`, ../class/ict-time.ts) — exposed for later monthly
//      attendance-rate reporting (`computeFinalGrade`), not enforced as a
//      write-time check.
//
// Every gate failure is BAD_REQUEST (not NOT_FOUND) — the 5 gates are
// business-rule violations on an otherwise-addressable write, not "resource
// missing" in the REST sense (TL19 §5 wording).

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import { badRequest, forbidden, notFound } from '../errors.js';
import { lmsProcedure, requireLmsParent, requirePermission, router, scoped } from '../trpc.js';
import { auditChildDataAccess, getApprovedChildren } from '../guardian/approved-children.js';
import { recomputeFinalGrade } from '../submission/router.js';
import { assertTeacherOwnsClass } from './assert-teacher-owns-class.js';

const attendanceStatusSchema = z.enum(['present', 'absent', 'late']);

const markInput = z.object({
  sessionId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  status: attendanceStatusSchema,
});

const markAllInput = z.object({
  sessionId: z.string().uuid(),
  entries: z
    .array(z.object({ enrollmentId: z.string().uuid(), status: attendanceStatusSchema }))
    .min(1)
    // Bound the write transaction (one class session's roster is small); G1-style
    // resource guard so a single call can't materialise an unbounded batch.
    .max(200),
});

const listBySessionInput = z.object({ sessionId: z.string().uuid() });

const listForChildInput = z.object({ studentId: z.string().uuid() });

/**
 * Gap-closure 260710-0005 Phase 2: parent-facing DTO for
 * `attendance.listForChild`. `status` is the raw `AttendanceStatus` enum
 * (`present|absent|late`) — the LMS UI is responsible for the Vietnamese
 * label ("Nghỉ học"/"Đi muộn"), not the API.
 */
export interface ChildAttendanceDto {
  classSessionId: string;
  sessionDate: Date;
  status: string;
}

export interface AttendanceDto {
  id: string;
  classSessionId: string;
  enrollmentId: string;
  studentId: string;
  status: string;
  markedById: string;
  markedAt: Date;
}

function toAttendanceDto(row: {
  id: string;
  classSessionId: string;
  enrollmentId: string;
  studentId: string;
  status: string;
  markedById: string;
  markedAt: Date;
}): AttendanceDto {
  return {
    id: row.id,
    classSessionId: row.classSessionId,
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    status: row.status,
    markedById: row.markedById,
    markedAt: row.markedAt,
  };
}

/** Gate 1: session exists (in `facilityId`) and is not cancelled. */
async function loadGatedSession(
  tx: Prisma.TransactionClient,
  facilityId: string,
  sessionId: string,
) {
  const session = await tx.classSession.findFirst({ where: { id: sessionId, facilityId } });
  if (!session || session.status === 'cancelled') {
    throw badRequest('ClassSession not found or cancelled.');
  }
  return session;
}

/** Gates 2-3: the enrollment resolves (in `facilityId`), matches the
 * session's class, and is `active`. */
async function loadGatedEnrollment(
  tx: Prisma.TransactionClient,
  facilityId: string,
  enrollmentId: string,
  session: { classBatchId: string },
) {
  const enrollment = await tx.enrollment.findFirst({ where: { id: enrollmentId, facilityId } });
  if (!enrollment) {
    throw badRequest('Enrollment not found.');
  }
  if (enrollment.classBatchId !== session.classBatchId) {
    throw badRequest("Enrollment does not belong to this session's class.");
  }
  if (enrollment.status !== 'active') {
    throw badRequest('Enrollment is not active.');
  }
  return enrollment;
}

export const attendanceRouter = router({
  // UPSERT — re-mark allowed, last-write-wins; every write is audited.
  mark: requirePermission('attendance', 'mark')
    .input(markInput)
    .mutation(async ({ ctx, input }): Promise<AttendanceDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await loadGatedSession(tx, facilityId, input.sessionId);
        await assertTeacherOwnsClass(tx, facilityId, ctx.subject, session.classBatchId);
        const enrollment = await loadGatedEnrollment(tx, facilityId, input.enrollmentId, session);

        const markedAt = new Date();
        const attendance = await tx.attendance.upsert({
          where: {
            classSessionId_enrollmentId: {
              classSessionId: session.id,
              enrollmentId: enrollment.id,
            },
          },
          create: {
            facilityId,
            classSessionId: session.id,
            enrollmentId: enrollment.id,
            studentId: enrollment.studentId,
            status: input.status,
            markedById: ctx.subject.userId,
            markedAt,
          },
          update: {
            status: input.status,
            markedById: ctx.subject.userId,
            markedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'attendance.mark',
            entity: 'Attendance',
            entityId: attendance.id,
            data: { facilityId, sessionId: session.id, enrollmentId: enrollment.id, status: input.status },
          },
        });

        // Metric & Data Integrity remediation (scenario audit): a correction
        // (e.g. absent -> present) after FinalGrade was already computed for
        // this period must refresh it — otherwise the report shows a stale
        // score alongside the new attendance rate. Anchored on the SESSION's
        // own endTime (not "now") so a correction to a PAST session refreshes
        // THAT month, not the current one.
        await recomputeFinalGrade(tx, {
          facilityId,
          studentId: enrollment.studentId,
          periodAnchor: session.endTime,
        });

        return toAttendanceDto(attendance);
      });
    }),

  // Same gates + upsert semantics as `mark`, applied to a whole roster in one
  // transaction (atomic: any entry failing a gate rolls back the batch).
  markAll: requirePermission('attendance', 'mark')
    .input(markAllInput)
    .mutation(async ({ ctx, input }): Promise<{ items: AttendanceDto[] }> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await loadGatedSession(tx, facilityId, input.sessionId);
        await assertTeacherOwnsClass(tx, facilityId, ctx.subject, session.classBatchId);

        const items: AttendanceDto[] = [];
        // Metric & Data Integrity remediation (scenario audit): every entry
        // in one markAll call shares the same session, so the same
        // period — dedupe by studentId and recompute FinalGrade once per
        // student, not once per entry.
        const studentIdsToRecompute = new Set<string>();
        for (const entry of input.entries) {
          const enrollment = await loadGatedEnrollment(tx, facilityId, entry.enrollmentId, session);
          studentIdsToRecompute.add(enrollment.studentId);
          const markedAt = new Date();
          const attendance = await tx.attendance.upsert({
            where: {
              classSessionId_enrollmentId: {
                classSessionId: session.id,
                enrollmentId: enrollment.id,
              },
            },
            create: {
              facilityId,
              classSessionId: session.id,
              enrollmentId: enrollment.id,
              studentId: enrollment.studentId,
              status: entry.status,
              markedById: ctx.subject.userId,
              markedAt,
            },
            update: {
              status: entry.status,
              markedById: ctx.subject.userId,
              markedAt,
            },
          });

          await tx.auditLog.create({
            data: {
              actor: ctx.subject.userId,
              action: 'attendance.mark',
              entity: 'Attendance',
              entityId: attendance.id,
              data: { facilityId, sessionId: session.id, enrollmentId: enrollment.id, status: entry.status },
            },
          });

          items.push(toAttendanceDto(attendance));
        }

        for (const studentId of studentIdsToRecompute) {
          await recomputeFinalGrade(tx, { facilityId, studentId, periodAnchor: session.endTime });
        }

        return { items };
      });
    }),

  // Roster read: every `active` enrollment in the session's class, with its
  // attendance status for THIS session (`null` when not yet marked).
  // H4/teacher-scoping remediation (2026-07-15): now shares
  // `assertTeacherOwnsClass` with every write procedure below — no more
  // bespoke inline check, and no more fail-open when the caller's AppUser
  // can't be resolved (see that helper's doc comment for why fail-closed is
  // safe for real staff sessions).
  listBySession: requirePermission('attendance', 'mark')
    .input(listBySessionInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await loadGatedSessionForRead(tx, facilityId, input.sessionId);
        await assertTeacherOwnsClass(tx, facilityId, ctx.subject, session.classBatchId);

        const [enrollments, attendances] = await Promise.all([
          tx.enrollment.findMany({
            where: { facilityId, classBatchId: session.classBatchId, status: 'active' },
          }),
          tx.attendance.findMany({ where: { facilityId, classSessionId: session.id } }),
        ]);

        const byEnrollmentId = new Map(attendances.map((a) => [a.enrollmentId, a]));
        const items = enrollments.map((enrollment) => {
          const attendance = byEnrollmentId.get(enrollment.id);
          return {
            enrollmentId: enrollment.id,
            studentId: enrollment.studentId,
            status: attendance?.status ?? null,
            markedAt: attendance?.markedAt ?? null,
          };
        });

        return { items, total: items.length };
      });
    }),

  // -------------------------------------------------------------------------
  // attendance.listForChild — LMS (parent session ONLY, gap-closure
  // 260710-0005 Phase 2). Gate pattern copied from assessment.listForChild
  // (../assessment/router.ts): getApprovedChildren + auditChildDataAccess is
  // the sole child-data boundary. Filters by `studentId` (NOT classSessionId)
  // so a session-scoped query can never expose another student's attendance
  // in the same class (red-team F4).
  // -------------------------------------------------------------------------
  listForChild: lmsProcedure
    .input(listForChildInput)
    .query(async ({ ctx, input }): Promise<{ items: ChildAttendanceDto[] }> => {
      const { parentAccountId } = requireLmsParent(ctx);

      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      await auditChildDataAccess(ctx.db, {
        parentAccountId,
        studentIds: [input.studentId],
        via: 'attendance.listForChild',
        actorKind: 'parent',
      });

      // Re-establish the facility GUC (red-team H1 defense-in-depth) — see
      // submission.listForChild for the same pattern + rationale.
      const student = await withFacility(
        ctx.db,
        null,
        (tx) => tx.student.findUnique({ where: { id: input.studentId }, select: { facilityId: true } }),
        { bypass: true },
      );
      if (!student) throw notFound('Student not found.');

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        const items = await tx.attendance.findMany({
          // Exclude cancelled sessions — a cancelled session never ran, so
          // showing it as a normal attendance entry would contradict
          // recomputeFinalGrade's attendance-rate denominator (../submission/
          // router.ts), which already excludes cancelled sessions.
          where: { studentId: input.studentId, classSession: { status: { not: 'cancelled' } } },
          orderBy: { markedAt: 'desc' },
          take: 100,
          select: { classSessionId: true, status: true, classSession: { select: { sessionDate: true } } },
        });
        return {
          items: items.map((row) => ({
            classSessionId: row.classSessionId,
            sessionDate: row.classSession.sessionDate,
            status: row.status,
          })),
        };
      });
    }),
});

/** `listBySession` is a read, not a write — it still must resolve the session
 * server-side (gate 4) but a cancelled session's roster remains readable
 * (e.g. to show why nothing was marked), unlike `mark`/`markAll` which block
 * writes against it (gate 1). */
async function loadGatedSessionForRead(
  tx: Prisma.TransactionClient,
  facilityId: string,
  sessionId: string,
) {
  const session = await tx.classSession.findFirst({ where: { id: sessionId, facilityId } });
  if (!session) {
    throw badRequest('ClassSession not found.');
  }
  return session;
}

import type { AuthSubject } from '@cmc/auth';
import type { Prisma } from '@cmc/db';
import { forbidden, notFound } from '../errors.js';
import {
  assertTeacherOwnsClass,
  assertTeacherOwnsStudentClass,
} from '../attendance/assert-teacher-owns-class.js';

const DIRECTOR_ROLES = ['super_admin', 'giam_doc_dao_tao'] as const;

/**
 * Authorizes assessment context before any student data is sent to an LLM.
 * Directors may assess any student in the facility. Teachers must own the
 * selected session's class, and the student must have an active enrollment in
 * that class. A period-only draft is allowed only when the teacher owns at
 * least one of the student's active classes.
 */
export async function assertAssessmentDraftScope(
  tx: Prisma.TransactionClient,
  facilityId: string,
  subject: AuthSubject | null,
  studentId: string,
  classSessionId: string | null,
): Promise<void> {
  const student = await tx.student.findFirst({
    where: { id: studentId, facilityId },
    select: { id: true },
  });
  if (!student) throw notFound('Student not found in this facility.');

  const roles = subject?.roles ?? [];
  if (roles.some((role) => DIRECTOR_ROLES.includes(role as (typeof DIRECTOR_ROLES)[number]))) {
    return;
  }
  if (!roles.includes('giao_vien')) {
    throw forbidden('Only an assigned teacher or training director may draft an assessment.');
  }

  if (classSessionId) {
    const session = await tx.classSession.findFirst({
      where: { id: classSessionId, facilityId },
      select: { classBatchId: true },
    });
    if (!session) throw notFound('Class session not found in this facility.');

    await assertTeacherOwnsClass(tx, facilityId, subject, session.classBatchId);
    const enrollment = await tx.enrollment.findFirst({
      where: {
        facilityId,
        studentId,
        classBatchId: session.classBatchId,
        status: 'active',
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw forbidden('The student is not actively enrolled in this session class.');
    }
    return;
  }

  const activeEnrollment = await tx.enrollment.findFirst({
    where: { facilityId, studentId, status: 'active' },
    select: { id: true },
  });
  if (!activeEnrollment) {
    throw forbidden('Teachers may only assess actively enrolled students.');
  }
  await assertTeacherOwnsStudentClass(tx, facilityId, subject, studentId);
}

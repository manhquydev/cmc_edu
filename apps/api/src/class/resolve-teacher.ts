import type { Prisma } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';

/**
 * Resolves an AppUser id into the teacher a ClassBatch or ClassSession may
 * point at.
 *
 * `ClassBatch.teacherAppUserId` is the source that credits teaching hours into
 * payroll and KPI, so a non-teacher assigned here is paid for classes they
 * never ran. Both writers (`create`'s teacherId resolve, `classBatch.assignTeacher`,
 * and `classSession.assignTeacher`) go through this — a dropdown that only
 * lists teachers is a convenience, not an enforcement point.
 */
export async function resolveTeacher(
  tx: Prisma.TransactionClient,
  teacherAppUserId: string,
  facilityId: string,
): Promise<{ id: string }> {
  const teacher = await tx.appUser.findFirst({ where: { id: teacherAppUserId, facilityId } });
  if (!teacher) {
    throw notFound('Teacher (AppUser) not found in this facility.');
  }
  if (!teacher.roles.includes('giao_vien')) {
    throw badRequest('That staff member is not a teacher (role giao_vien required).');
  }
  return teacher;
}

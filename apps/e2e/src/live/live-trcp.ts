// live-trcp — tRPC access to the LIVE API (same-origin /trpc on
// https://erp.clawcmc.io.vn) using session cookies captured by real UI
// logins. Used only for the PO-approved seed exceptions with no admin UI
// path (Course/ClassBatch creation — scout §6, plan P5), exactly like
// createE2eStaffClient + STAFF_SESSION_SECRET is used on the local harness.
//
// The e2e Node clients call the tRPC base URL directly; on live, nginx only
// proxies /trpc/* to the API (infra/nginx/api-locations.conf), so the client
// URL must include the /trpc segment (apps/api/src/server.ts strips it).

import { addDaysToDateOnly, ictDateOnlyOf, weekdayOf } from '@cmc/domain-time';

import { createSignedStaffClient } from '../trpc-client.js';
import { LIVE_ADMIN_ORIGIN } from '../../playwright.live.config.js';
import { readCredentialsFile } from './live-credentials.js';

export const LIVE_TRPC_URL = LIVE_ADMIN_ORIGIN + '/trpc';

function sessionCookieFor(roleKey: 'superAdmin' | string): string {
  const file = readCredentialsFile();
  const account = roleKey === 'superAdmin' ? file.superAdmin : (file.staff[roleKey] ?? null);
  const session = account?.session;
  if (!session?.value) {
    throw new Error(
      'live-trcp: no persisted session cookie for "' +
        roleKey +
        '" — a real UI login must run first (00-setup-roles for superAdmin).',
    );
  }
  return session.value;
}

/** Typed tRPC client acting as the live super admin (cookie from the real
 *  UI login). Use for course.create / classBatch.create / user.pickList. */
export function liveSuperAdminClient() {
  return createSignedStaffClient(LIVE_TRPC_URL, sessionCookieFor('superAdmin'));
}

/** Typed tRPC client acting as a live staff role (cookie from its real UI
 *  login). Use for student.lookup / enrollment.enroll (Xếp lớp's mutations). */
/** Typed tRPC client acting as a live staff role (cookie from its real UI
 *  login). Use for student.lookup / enrollment.enroll (Xếp lớp's mutations). */
export function liveStaffRoleClient(roleKey: string) {
  return createSignedStaffClient(LIVE_TRPC_URL, sessionCookieFor(roleKey));
}

export interface CreateLiveClassOptions {
  courseName: string;
  /** AppUser.id of the giao_vien who will take attendance (assertTeacherOwnsClass). */
  teacherAppUserId?: string;
  /** Slot times (HH:mm) override — the attendance spec pins the slot ~1h in
   *  the past so the production-enforced teacher window (start−30m, end+2h)
   *  is open at mark time. Defaults to 10:00–11:00. */
  slotOverride?: { startTime: string; endTime: string };
}

/** PO-approved tRPC seed exception (no admin UI creates a Course/ClassBatch —
 *  scout §6, plan P5): creates a Course + ClassBatch with one weekly slot
 *  pinned to TODAY's weekday (guarantees >= 1 ClassSession, the first of
 *  which the attendance spec uses). Mirrors classBatch.create's own shape. */
export async function createLiveClass(opts: CreateLiveClassOptions) {
  const admin = liveSuperAdminClient();
  const course = await admin.course.create.mutate({
    program: 'UCREA',
    name: opts.courseName,
  });
  const startDate = ictDateOnlyOf(new Date());
  const endDate = addDaysToDateOnly(startDate, 7);
  const weekday = weekdayOf(startDate);
  const slot = opts.slotOverride ?? { startTime: '10:00', endTime: '11:00' };
  const created = await admin.classBatch.create.mutate({
    courseId: course.id,
    startDate,
    endDate,
    slots: [{ weekday, ...slot }],
    ...(opts.teacherAppUserId ? { teacherId: opts.teacherAppUserId } : {}),
  });
  return { course, classBatch: created.classBatch, sessionsCreated: created.sessionsCreated };
}


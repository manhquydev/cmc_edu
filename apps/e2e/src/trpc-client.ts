// Thin tRPC HTTP clients for the e2e suite — talks to the api server this
// run spawned (../src/global-setup.ts) over real HTTP, authenticating via the
// same dev-header stub the FE uses (apps/api/src/context.ts): `x-dev-user`
// for staff, `x-dev-lms-user` for parent/LMS sessions. `AppRouter` is a
// type-only import from the api app's source (no runtime coupling) so every
// call below is fully typed against the real router surface.

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { Role } from '@cmc/auth';
import type { AppRouter } from '../../api/src/router.js';

export interface DevStaffIdentity {
  userId: string;
  roles: Role[];
  facilityId: string;
}

export interface DevLmsIdentity {
  parentAccountId: string;
  studentId?: string;
}

/** A staff-session client (`x-dev-user`) — every business procedure except
 * `lmsAuth.*` and `health` requires one of these. */
export function createStaffClient(baseUrl: string, staff: DevStaffIdentity) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: baseUrl,
        headers: () => ({ 'x-dev-user': JSON.stringify(staff) }),
      }),
    ],
  });
}

/** A parent/LMS-session client (`x-dev-lms-user`) — `enrollment.mine`,
 * `guardian.requestLink`. */
export function createLmsClient(baseUrl: string, lms: DevLmsIdentity) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: baseUrl,
        headers: () => ({ 'x-dev-lms-user': JSON.stringify(lms) }),
      }),
    ],
  });
}

/** No session at all — `health`, `lmsAuth.requestOtp`/`verifyOtp` (public by
 * design, docs/11 §1). */
export function createAnonClient(baseUrl: string) {
  return createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: baseUrl })] });
}

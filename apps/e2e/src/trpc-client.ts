// Thin tRPC HTTP clients for the e2e suite — talks to the api server this
// run spawned (../src/global-setup.ts) over real HTTP, authenticating via the
// same dev-header stub the FE uses (apps/api/src/context.ts): `x-dev-user`
// for staff, `x-dev-lms-user` for parent/LMS sessions. `AppRouter` is a
// type-only import from the api app's source (no runtime coupling) so every
// call below is fully typed against the real router surface.

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { Role } from '@cmc/auth';
import type { AppRouter } from '../../api/src/router.js';
import { mintStaffCookie, mintParentToken, mintStudentToken } from './session-injection.js';

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
 * `guardian.requestLink`.
 *
 * @deprecated Use `createSignedLmsClient` for mode-B (V3) e2e runs.
 * This variant only works when `NODE_ENV !== 'production'` (DEV_AUTH_ENABLED).
 */
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

/**
 * Mode B (V3): Staff client using a properly HMAC-SHA256 signed HttpOnly cookie.
 * Works in both dev and production-mode API servers — no DEV_AUTH_ENABLED required.
 * Pass a cookie token from `mintStaffCookie()` in session-injection.ts.
 */
export function createSignedStaffClient(baseUrl: string, cookieToken: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: baseUrl,
        headers: () => ({ cookie: `cmc_staff_session=${cookieToken}` }),
      }),
    ],
  });
}

/**
 * Mode B (V3): LMS client using a properly HMAC-SHA256 signed Bearer token.
 * Works in both dev and production-mode API servers — no DEV_AUTH_ENABLED required.
 * Pass a token from `mintParentToken()` or `mintStudentToken()` in session-injection.ts.
 */
export function createSignedLmsClient(baseUrl: string, bearerToken: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: baseUrl,
        headers: () => ({ authorization: `Bearer ${bearerToken}` }),
      }),
    ],
  });
}

/** No session at all — `health`, `lmsAuth.requestOtp`/`verifyOtp` (public by
 * design, docs/11 §1). */
export function createAnonClient(baseUrl: string) {
  return createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: baseUrl })] });
}

/**
 * Mode-aware staff client for e2e specs.
 * Mode-A (NODE_ENV !== 'production'): x-dev-user header (no secret needed).
 * Mode-B (NODE_ENV = 'production'): signed HMAC cookie — same auth path as
 * production staff. Uses STAFF_SESSION_SECRET from env (or dev default).
 *
 * Use this in every e2e spec instead of createStaffClient directly, so specs
 * run correctly in both dev and prod-config environments.
 */
export function createE2eStaffClient(baseUrl: string, staff: DevStaffIdentity) {
  if (process.env['NODE_ENV'] === 'production') {
    const cookie = mintStaffCookie({
      userId: staff.userId,
      roles: staff.roles as string[],
      facilityId: staff.facilityId,
    });
    return createSignedStaffClient(baseUrl, cookie);
  }
  return createStaffClient(baseUrl, staff);
}

/**
 * Mode-aware LMS parent-session client. Mode-A (dev): x-dev-lms-user header.
 * Mode-B (production): signed Bearer token via mintParentToken — the dev-header
 * is disabled under NODE_ENV=production, so an unsigned header is rejected
 * UNAUTHORIZED before any kind-gate. Mirrors createE2eStaffClient.
 */
export function createE2eLmsParentClient(baseUrl: string, parentAccountId: string) {
  if (process.env['NODE_ENV'] === 'production') {
    return createSignedLmsClient(baseUrl, mintParentToken(parentAccountId));
  }
  return createLmsClient(baseUrl, { parentAccountId });
}

/**
 * Mode-aware LMS student-session client (kind=student). Mode-A (dev): explicit
 * x-dev-lms-user header with kind=student (createLmsClient omits kind → parent).
 * Mode-B (production): signed Bearer token via mintStudentToken.
 */
export function createE2eLmsStudentClient(
  baseUrl: string,
  opts: { parentAccountId: string; studentId: string },
) {
  if (process.env['NODE_ENV'] === 'production') {
    return createSignedLmsClient(baseUrl, mintStudentToken(opts.parentAccountId, opts.studentId));
  }
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: baseUrl,
        headers: () => ({
          'x-dev-lms-user': JSON.stringify({
            parentAccountId: opts.parentAccountId,
            studentId: opts.studentId,
            kind: 'student',
          }),
        }),
      }),
    ],
  });
}

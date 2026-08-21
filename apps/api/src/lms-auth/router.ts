// lms-auth router — WF-P1-07 (parent LMS login: phone + OTP, profile picker)
// and C1/phase-01b (parent email-OTP, student password login, kind-gated
// session tokens, child-password reset).
//
// Security invariants (no-leak):
//   - requestOtp / requestOtpEmail always return { ok: true } regardless of
//     whether the identifier maps to a real account.
//   - verifyOtp / verifyOtpEmail / loginStudent use the same generic error
//     string for wrong code, expired code, locked code, and no account —
//     preventing enumeration of phone/email/password existence.
//
// Session shape: a base64url-encoded JSON blob `{ parentAccountId, kind }` or
// `{ parentAccountId, studentId, kind }`. This is a placeholder until real
// session infra (JWT/cookie) lands; deliberately opaque and mirroring the
// x-dev-lms-user header shape that context.ts already parses.
//
// H5 remediation (phone OTP): cooldown + per-row attempt counter + invalidation
// on re-request. Same pattern applied to email OTP below.

import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { InvalidPhoneError, normalizeLoginPhone } from '@cmc/domain-identity';
import { badRequest, forbidden } from '../errors.js';
import {
  auditChildDataAccess,
  getApprovedChildren,
  type ApprovedChild,
} from '../guardian/approved-children.js';
import { lmsProcedure, publicProcedure, requireLmsParent, router } from '../trpc.js';
import { signFamilyResetToken, verifyFamilyResetToken } from './family-reset-token.js';
import { hashOtpCode, verifyOtpCode } from './otp-hash.js';
import { hashPassword, verifyPassword } from './password-hash.js';
import { LMS_SESSION_SECRET_DEV_DEFAULT, signLmsToken } from './session-token.js';
import type { LmsSessionKind } from './lms-kind.js';

/**
 * Non-prod test seam: when TEST_OTP_SEAM=1 and not production, OTP procedures
 * return the plaintext code in the response so browser e2e tests can complete
 * the login flow without email delivery. NEVER set this in production.
 */
const TEST_OTP_SEAM_ENABLED =
  process.env.TEST_OTP_SEAM === '1' && process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** docs/19 §2: OTP is a random 6-digit code. */
const OTP_TTL_MINUTES = 5;

/**
 * H5 remediation: minimum interval between two OTP requests for the same
 * identifier (phone or email). 30s is a placeholder — see original file header.
 */
const OTP_REQUEST_COOLDOWN_SECONDS = 30;

/** H5 remediation: failed verify attempts allowed before a code locks. */
const MAX_OTP_VERIFY_ATTEMPTS = 5;

/**
 * Atomic-lock standardization (scenario audit pattern #3, NS #6/#7): caps how
 * many OTP requests one identifier (phone or email) may make in a rolling
 * window — closes the gap where an attacker who can't beat the 30s cooldown
 * simply waits it out repeatedly. Pilot-scale placeholder (same convention as
 * GLOBAL_OTP_ENQUEUE_CAP_PER_HOUR below) — a rolling-window count naturally
 * produces a ~15-minute soft-block once hit, without a separate block flag.
 */
const OTP_RATE_LIMIT_MAX_PER_WINDOW = 5;
const OTP_RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * Gap-closure 260710-0005 Phase 1 red-team C2: per-email cooldown alone is
 * bypassable by rotating the target email (email-bomb / Brevo-quota-drain
 * against the LMS's only login gate). This is a system-wide ceiling on how
 * many `kind='otp'` EmailOutbox rows may be enqueued per rolling hour,
 * fail-closed once hit. Pilot-scale placeholder — raise (with a comment
 * explaining the new basis) once there are multiple facilities driving
 * legitimate concurrent OTP volume.
 */
const GLOBAL_OTP_ENQUEUE_CAP_PER_HOUR = 200;

const GENERIC_VERIFY_FAILURE = 'Invalid or expired code.';
const GENERIC_COOLDOWN_FAILURE = 'Please wait before requesting another code.';

/** Maximum failed student login attempts before account lockout. */
const MAX_STUDENT_LOGIN_ATTEMPTS = 5;

/** Lockout duration after too many failed student login attempts. */
const STUDENT_LOCKOUT_MINUTES = 15;

/** Generic error for all student login failures (wrong phone/password, no account). */
const GENERIC_STUDENT_LOGIN_FAILURE = 'Invalid credentials.';

/** Same generic string for familyLogin (no-leak). */
const GENERIC_FAMILY_LOGIN_FAILURE = 'Invalid credentials.';

const MAX_FAMILY_LOGIN_ATTEMPTS = 5;
const FAMILY_LOCKOUT_MINUTES = 15;
const FAMILY_RESET_TTL_MINUTES = 60;
const FAMILY_FORGOT_MAX_PER_WINDOW = 5;
const FAMILY_FORGOT_WINDOW_MINUTES = 15;
const GLOBAL_FAMILY_RESET_ENQUEUE_CAP_PER_HOUR = 200;

/**
 * Module-level dummy hash to equalise timing when no ParentAccount exists.
 * Without this, the no-account path skips pbkdf2Sync entirely, creating a
 * measurable latency difference that lets an attacker enumerate whether a
 * phone number maps to a ParentAccount row.
 */
const DUMMY_PASSWORD_HASH = hashPassword('___DUMMY_SENTINEL_DO_NOT_USE___');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Resolves the LMS session signing secret (RT-1). */
function getLmsSecret(): string {
  return process.env['LMS_SESSION_SECRET'] ?? LMS_SESSION_SECRET_DEV_DEFAULT;
}

/** Signs a parent LMS session token (embeds ParentAccount.tokenVersion). */
function encodeSessionToken(
  parentAccountId: string,
  kind: LmsSessionKind = 'parent',
  tokenVersion = 0,
): string {
  return signLmsToken({ parentAccountId, kind, tokenVersion }, getLmsSecret());
}

function familyResetAppOrigin(): string {
  return (process.env['LMS_APP_ORIGIN'] ?? 'http://localhost:5174').replace(/\/$/, '');
}

/** Signs a student LMS session token. */
function encodeStudentSessionToken(
  parentAccountId: string,
  studentId: string,
  tokenVersion = 0,
): string {
  return signLmsToken(
    { parentAccountId, studentId, kind: 'student', tokenVersion },
    getLmsSecret(),
  );
}

/** Normalizes a raw login phone; a malformed phone is a format error
 * (BAD_REQUEST), not an account-existence leak. */
function normalizeOrReject(rawPhone: string): string {
  try {
    return normalizeLoginPhone(rawPhone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) {
      throw badRequest('Invalid phone number format.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const requestOtpInput = z.object({ phone: z.string().min(1) });

const verifyOtpInput = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
});

const requestOtpEmailInput = z.object({ email: z.string().email() });

const verifyOtpEmailInput = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const loginStudentInput = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

const resetChildPasswordInput = z.object({
  studentId: z.string().uuid(),
  newPassword: z.string().min(8),
});

const familyLoginInput = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

const familyForgotPasswordInput = z.object({
  phone: z.string().min(1),
});

const familyResetPasswordInput = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(12),
});

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface VerifyOtpResult {
  sessionToken: string;
  children: ApprovedChild[];
  /** docs/19 §2 profile picker: 1 child → auto-select client-side; ≥2 → picker. */
  needsPicker: boolean;
}

export interface LoginStudentResult {
  sessionToken: string;
  mustChangePassword: boolean;
  studentId: string;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const lmsAuthRouter = router({
  // -------------------------------------------------------------------------
  // lmsAuth.requestOtp — phone-based OTP request (existing flow)
  // -------------------------------------------------------------------------
  requestOtp: publicProcedure
    .input(requestOtpInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true; _testSeamCode?: string }> => {
      const phone = normalizeOrReject(input.phone);

      const code = await ctx.db.$transaction(
        async (tx) => {
          // Atomic-lock standardization (scenario audit pattern #3): serialize
          // concurrent requests for the SAME identifier (advisory lock, same
          // pattern as rewards.redeem's per-gift lock) — without this, 2
          // concurrent calls can both pass the cooldown/rate-limit checks
          // before either commits, leaving 2 "most recent" pending codes
          // racing each other instead of a clean invalidate-then-insert.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;

          // H5 cooldown: time-based against the most recent LoginOtp for this phone.
          const mostRecent = await tx.loginOtp.findFirst({
            where: { phone },
            orderBy: { createdAt: 'desc' },
          });
          if (mostRecent) {
            const elapsedMs = Date.now() - mostRecent.createdAt.getTime();
            if (elapsedMs < OTP_REQUEST_COOLDOWN_SECONDS * 1000) {
              throw badRequest(GENERIC_COOLDOWN_FAILURE);
            }
          }

          // NS #6/#7: rolling-window rate-limit per identifier.
          const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60_000);
          const recentRequestCount = await tx.loginOtp.count({
            where: { phone, createdAt: { gte: windowStart } },
          });
          if (recentRequestCount >= OTP_RATE_LIMIT_MAX_PER_WINDOW) {
            throw badRequest(GENERIC_COOLDOWN_FAILURE);
          }

          // H5: invalidate any still-pending prior code for this phone.
          await tx.loginOtp.updateMany({
            where: { phone, status: 'pending' },
            data: { status: 'expired' },
          });

          const code = generateOtpCode();
          const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

          await tx.loginOtp.create({
            data: { phone, codeHash: hashOtpCode(code), status: 'pending', expiresAt },
          });

          return code;
        },
        // Post-implementation hardening (H4): this table (LoginOtp) has no
        // facilityId/RLS, so it can't go through `withFacility` — but it
        // holds an advisory lock across a public, unauthenticated endpoint,
        // same connection-pool-exhaustion risk `withFacility` raised its
        // timeout for (packages/db/src/index.ts). Match that ceiling directly.
        { timeout: 15_000 },
      );

      await ctx.db.auditLog.create({
        data: {
          actor: 'system',
          action: 'lmsAuth.requestOtp',
          entity: 'LoginOtp',
          entityId: phone,
          data: { phone },
        },
      });

      // Test seam (non-prod only): expose plaintext code so e2e tests can
      // complete the login flow without email delivery.
      // Runtime assertion: _testSeamCode is NEVER populated in production even
      // if TEST_OTP_SEAM was accidentally set.
      const _testSeamCode =
        TEST_OTP_SEAM_ENABLED && process.env.NODE_ENV !== 'production' ? code : undefined;
      return { ok: true, _testSeamCode };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.verifyOtp — phone-based OTP verification (existing flow)
  // Updated to embed kind:'parent' in session token.
  // -------------------------------------------------------------------------
  verifyOtp: publicProcedure
    .input(verifyOtpInput)
    .mutation(async ({ ctx, input }): Promise<VerifyOtpResult> => {
      const phone = normalizeOrReject(input.phone);

      const otp = await ctx.db.loginOtp.findFirst({
        where: { phone, status: 'pending', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      const isLocked = otp !== null && otp.attempts >= MAX_OTP_VERIFY_ATTEMPTS;
      const codeMatches = otp !== null && !isLocked && verifyOtpCode(input.code, otp.codeHash);

      if (!otp || isLocked || !codeMatches) {
        if (otp && !isLocked) {
          const attempts = otp.attempts + 1;
          await ctx.db.loginOtp.update({
            where: { id: otp.id },
            data: { attempts, status: attempts >= MAX_OTP_VERIFY_ATTEMPTS ? 'expired' : 'pending' },
          });
        }
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      // Atomic claim — one-shot consume.
      const claim = await ctx.db.loginOtp.updateMany({
        where: { id: otp.id, status: 'pending' },
        data: { status: 'verified' },
      });
      if (claim.count !== 1) {
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { phone } });
      if (!parentAccount || !parentAccount.isActive) {
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      const children = await getApprovedChildren(ctx.db, parentAccount.id);

      await auditChildDataAccess(ctx.db, {
        parentAccountId: parentAccount.id,
        studentIds: children.map((c) => c.studentId),
        via: 'lmsAuth.verifyOtp',
        actorKind: 'parent',
      });

      return {
        sessionToken: encodeSessionToken(parentAccount.id, 'parent', parentAccount.tokenVersion),
        children,
        needsPicker: children.length >= 2,
      };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.requestOtpEmail — email-based OTP request (C1/phase-01b)
  // Same security invariants as requestOtp: unconditional { ok: true },
  // cooldown against most-recent OTP row keyed by email.
  // -------------------------------------------------------------------------
  requestOtpEmail: publicProcedure
    .input(requestOtpEmailInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true; _testSeamCode?: string }> => {
      const email = input.email.toLowerCase();

      // Gap-closure C2: global fail-closed ceiling on outbound OTP email
      // volume, independent of per-email cooldown (which an attacker can
      // bypass by rotating the target address). Counts EmailOutbox rows
      // enqueued in the last rolling hour, not LoginOtp rows — this caps
      // actual outbound Brevo sends, which is the resource being protected.
      // Checked BEFORE the per-identifier lock below (system-wide, not keyed
      // on `email`, so it doesn't need to be serialized against it).
      const hourAgo = new Date(Date.now() - 60 * 60_000);
      const recentOtpEnqueueCount = await ctx.db.emailOutbox.count({
        where: { transport: 'brevo', payload: { path: ['kind'], equals: 'otp' }, createdAt: { gte: hourAgo } },
      });
      if (recentOtpEnqueueCount >= GLOBAL_OTP_ENQUEUE_CAP_PER_HOUR) {
        throw badRequest(GENERIC_COOLDOWN_FAILURE);
      }

      const code = await ctx.db.$transaction(
        async (tx) => {
          // Atomic-lock standardization (scenario audit pattern #3): same
          // per-identifier advisory lock as requestOtp above.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;

          // H5 cooldown: purely time-based against the most recent email-OTP row.
          const mostRecent = await tx.loginOtp.findFirst({
            where: { email },
            orderBy: { createdAt: 'desc' },
          });
          if (mostRecent) {
            const elapsedMs = Date.now() - mostRecent.createdAt.getTime();
            if (elapsedMs < OTP_REQUEST_COOLDOWN_SECONDS * 1000) {
              throw badRequest(GENERIC_COOLDOWN_FAILURE);
            }
          }

          // NS #6/#7: rolling-window rate-limit per identifier.
          const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60_000);
          const recentRequestCount = await tx.loginOtp.count({
            where: { email, createdAt: { gte: windowStart } },
          });
          if (recentRequestCount >= OTP_RATE_LIMIT_MAX_PER_WINDOW) {
            throw badRequest(GENERIC_COOLDOWN_FAILURE);
          }

          // Invalidate any still-pending prior code for this email.
          await tx.loginOtp.updateMany({
            where: { email, status: 'pending' },
            data: { status: 'expired' },
          });

          const code = generateOtpCode();
          const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

          // phone is nullable (schema phase-01b migration); email-OTP rows set
          // phone=null and populate the email column instead.
          await tx.loginOtp.create({
            data: { phone: null, email, codeHash: hashOtpCode(code), status: 'pending', expiresAt },
          });

          return code;
        },
        // Post-implementation hardening (H4): same rationale as requestOtp above.
        { timeout: 15_000 },
      );

      // Ordering (red-team M1): LoginOtp is ALWAYS created first, regardless
      // of whether a ParentAccount exists for this email — this preserves the
      // no-leak response below (identical `{ok:true}` either way). The
      // outbox insert is a separate, unwrapped statement (no shared
      // transaction — consistent with this codebase's append-mindset
      // pattern elsewhere): if it fails, the request throws and the mint'd
      // LoginOtp row simply expires unused after its 5-minute TTL. It does
      // NOT strand a "verify-able but never emailed" code indefinitely.

      // Gap-closure gate (red-team C2 email-bomb defense): the send decision
      // (not the response) is allowed to depend on account existence — only
      // enqueue an actual email when a ParentAccount owns this address. The
      // caller-facing response stays identical either way (see return below),
      // so this lookup does NOT leak account existence to the caller; it only
      // prevents Brevo from being used to spam arbitrary third-party inboxes.
      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { email } });
      if (parentAccount) {
        await ctx.db.emailOutbox.create({
          data: {
            to: email,
            transport: 'brevo',
            status: 'pending',
            payload: { kind: 'otp', code, ttlMinutes: OTP_TTL_MINUTES },
          },
        });
      }

      await ctx.db.auditLog.create({
        data: {
          actor: 'system',
          action: 'lmsAuth.requestOtpEmail',
          entity: 'LoginOtp',
          entityId: email,
          data: { email },
        },
      });

      // Test seam (non-prod only): expose plaintext code so e2e tests can
      // complete the email-OTP login flow without email delivery.
      // Runtime assertion: _testSeamCode is NEVER populated in production even
      // if TEST_OTP_SEAM was accidentally set.
      const _testSeamCode =
        TEST_OTP_SEAM_ENABLED && process.env.NODE_ENV !== 'production' ? code : undefined;
      return { ok: true, _testSeamCode };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.verifyOtpEmail — email-based OTP verification (C1/phase-01b)
  // Same lockout/attempt logic as verifyOtp. No-leak: same generic error for
  // wrong code, expired, locked, or no ParentAccount with that email.
  // -------------------------------------------------------------------------
  verifyOtpEmail: publicProcedure
    .input(verifyOtpEmailInput)
    .mutation(async ({ ctx, input }): Promise<VerifyOtpResult> => {
      const email = input.email.toLowerCase();

      const otp = await ctx.db.loginOtp.findFirst({
        where: { email, status: 'pending', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      const isLocked = otp !== null && otp.attempts >= MAX_OTP_VERIFY_ATTEMPTS;
      const codeMatches = otp !== null && !isLocked && verifyOtpCode(input.code, otp.codeHash);

      if (!otp || isLocked || !codeMatches) {
        if (otp && !isLocked) {
          const attempts = otp.attempts + 1;
          await ctx.db.loginOtp.update({
            where: { id: otp.id },
            data: { attempts, status: attempts >= MAX_OTP_VERIFY_ATTEMPTS ? 'expired' : 'pending' },
          });
        }
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      // Atomic one-shot claim.
      const claim = await ctx.db.loginOtp.updateMany({
        where: { id: otp.id, status: 'pending' },
        data: { status: 'verified' },
      });
      if (claim.count !== 1) {
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { email } });
      if (!parentAccount || !parentAccount.isActive) {
        // Same generic failure as wrong/expired code — never reveal that an
        // email has no ParentAccount.
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      const children = await getApprovedChildren(ctx.db, parentAccount.id);

      await auditChildDataAccess(ctx.db, {
        parentAccountId: parentAccount.id,
        studentIds: children.map((c) => c.studentId),
        via: 'lmsAuth.verifyOtpEmail',
        actorKind: 'parent',
      });

      return {
        sessionToken: encodeSessionToken(parentAccount.id, 'parent', parentAccount.tokenVersion),
        children,
        needsPicker: children.length >= 2,
      };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.loginStudent — student direct password login (C1/phase-01b)
  //
  // No-leak: wrong phone, no StudentAccount, wrong password all return the
  // same GENERIC_STUDENT_LOGIN_FAILURE. Lockout is per StudentAccount row
  // (loginAttempts / loginLockedUntil), not per phone, so it tracks the
  // specific account being attacked.
  // -------------------------------------------------------------------------
  loginStudent: publicProcedure
    .input(loginStudentInput)
    .mutation(async ({ ctx, input }): Promise<LoginStudentResult> => {
      const phone = normalizeOrReject(input.phone);

      // Look up the ParentAccount for this phone, then the linked StudentAccount(s).
      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { phone } });
      if (!parentAccount || !parentAccount.isActive) {
        // Equalise timing: (1) dummy DB round-trip so no-parent path issues the
        // same number of DB queries as the no-studentAccounts path below (both = 2),
        // preventing enumeration via DB-latency difference; (2) PBKDF2 call so
        // CPU time matches wrong-password path.
        await ctx.db.$executeRaw`SELECT 1`;
        verifyPassword(input.password, DUMMY_PASSWORD_HASH);
        throw badRequest(GENERIC_STUDENT_LOGIN_FAILURE);
      }

      // Find all StudentAccounts for this parent that have a passwordHash set.
      // A parent may have multiple children; each gets their own StudentAccount row.
      // The student identity is matched by password — multiple accounts with
      // the same password are an edge-case but not a security problem (the
      // lockout is per StudentAccount row, not global).
      const studentAccounts = await ctx.db.studentAccount.findMany({
        where: { parentAccountId: parentAccount.id, passwordHash: { not: null } },
      });

      if (studentAccounts.length === 0) {
        // Equalise timing: the no-studentAccounts branch must spend the same
        // wall-clock time as the wrong-password branch so an attacker cannot
        // detect phones that have a ParentAccount but no linked StudentAccount
        // via latency difference.
        verifyPassword(input.password, DUMMY_PASSWORD_HASH);
        throw badRequest(GENERIC_STUDENT_LOGIN_FAILURE);
      }

      const now = new Date();

      // Find the matching account (iterate — typically only one per parent phone).
      let matchedAccount: (typeof studentAccounts)[number] | null = null;
      for (const sa of studentAccounts) {
        // Check lockout first — do not reveal lockout state explicitly.
        if (sa.loginLockedUntil && sa.loginLockedUntil > now) {
          // Still locked — continue checking other accounts but this one cannot match.
          continue;
        }
        if (sa.passwordHash && verifyPassword(input.password, sa.passwordHash)) {
          matchedAccount = sa;
          break;
        }
      }

      if (!matchedAccount) {
        // Increment loginAttempts on any unlocked account that didn't match.
        // This prevents an attacker from sidestepping lockout by having a
        // second StudentAccount under the same phone (unlikely but possible).
        for (const sa of studentAccounts) {
          if (sa.loginLockedUntil && sa.loginLockedUntil > now) continue; // already locked
          const newAttempts = sa.loginAttempts + 1;
          const shouldLock = newAttempts >= MAX_STUDENT_LOGIN_ATTEMPTS;
          await ctx.db.studentAccount.update({
            where: { id: sa.id },
            data: {
              loginAttempts: newAttempts,
              loginLockedUntil: shouldLock
                ? new Date(now.getTime() + STUDENT_LOCKOUT_MINUTES * 60_000)
                : null,
            },
          });
        }
        throw badRequest(GENERIC_STUDENT_LOGIN_FAILURE);
      }

      // Successful login: reset counters.
      await ctx.db.studentAccount.update({
        where: { id: matchedAccount.id },
        data: { loginAttempts: 0, loginLockedUntil: null },
      });

      await ctx.db.auditLog.create({
        data: {
          actor: matchedAccount.id,
          action: 'lmsAuth.loginStudent',
          entity: 'StudentAccount',
          entityId: matchedAccount.id,
          data: { studentId: matchedAccount.studentId, parentAccountId: parentAccount.id },
        },
      });

      return {
        sessionToken: encodeStudentSessionToken(
          parentAccount.id,
          matchedAccount.studentId,
          parentAccount.tokenVersion,
        ),
        mustChangePassword: matchedAccount.mustChangePassword,
        studentId: matchedAccount.studentId,
      };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.familyLogin — additive family door (Wave 1). OTP / loginStudent stay.
  // -------------------------------------------------------------------------
  familyLogin: publicProcedure
    .input(familyLoginInput)
    .mutation(async ({ ctx, input }): Promise<VerifyOtpResult> => {
      const phone = normalizeOrReject(input.phone);
      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { phone } });
      const now = new Date();

      if (
        !parentAccount ||
        !parentAccount.isActive ||
        !parentAccount.passwordHash ||
        (parentAccount.loginLockedUntil && parentAccount.loginLockedUntil > now)
      ) {
        await ctx.db.$executeRaw`SELECT 1`;
        verifyPassword(input.password, DUMMY_PASSWORD_HASH);
        throw badRequest(GENERIC_FAMILY_LOGIN_FAILURE);
      }

      if (!verifyPassword(input.password, parentAccount.passwordHash)) {
        const newAttempts = parentAccount.loginAttempts + 1;
        const shouldLock = newAttempts >= MAX_FAMILY_LOGIN_ATTEMPTS;
        await ctx.db.parentAccount.update({
          where: { id: parentAccount.id },
          data: {
            loginAttempts: newAttempts,
            loginLockedUntil: shouldLock
              ? new Date(now.getTime() + FAMILY_LOCKOUT_MINUTES * 60_000)
              : null,
          },
        });
        throw badRequest(GENERIC_FAMILY_LOGIN_FAILURE);
      }

      await ctx.db.parentAccount.update({
        where: { id: parentAccount.id },
        data: { loginAttempts: 0, loginLockedUntil: null },
      });

      const children = await getApprovedChildren(ctx.db, parentAccount.id);
      if (children.length === 0) {
        throw badRequest(GENERIC_FAMILY_LOGIN_FAILURE);
      }

      await auditChildDataAccess(ctx.db, {
        parentAccountId: parentAccount.id,
        studentIds: children.map((c) => c.studentId),
        via: 'lmsAuth.familyLogin',
        actorKind: 'parent',
      });

      await ctx.db.auditLog.create({
        data: {
          actor: parentAccount.id,
          action: 'lmsAuth.familyLogin',
          entity: 'ParentAccount',
          entityId: parentAccount.id,
          data: { childCount: children.length },
        },
      });

      return {
        sessionToken: encodeSessionToken(parentAccount.id, 'family', parentAccount.tokenVersion),
        children,
        needsPicker: children.length >= 2,
      };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.familyForgotPassword — public, no-leak, no session.
  // -------------------------------------------------------------------------
  familyForgotPassword: publicProcedure
    .input(familyForgotPasswordInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true; _testSeamToken?: string }> => {
      const phone = normalizeOrReject(input.phone);

      const hourAgo = new Date(Date.now() - 60 * 60_000);
      const recentResetEnqueueCount = await ctx.db.emailOutbox.count({
        where: {
          transport: 'brevo',
          payload: { path: ['kind'], equals: 'family-reset' },
          createdAt: { gte: hourAgo },
        },
      });
      // Cooldown must not throw: outbox rows only exist for phones that have
      // email, so BAD_REQUEST here would enumerate those accounts. Skip send.
      const overGlobalCap = recentResetEnqueueCount >= GLOBAL_FAMILY_RESET_ENQUEUE_CAP_PER_HOUR;

      const windowStart = new Date(Date.now() - FAMILY_FORGOT_WINDOW_MINUTES * 60_000);
      const recentForPhone = await ctx.db.emailOutbox.count({
        where: {
          payload: { path: ['kind'], equals: 'family-reset' },
          createdAt: { gte: windowStart },
          AND: [{ payload: { path: ['phone'], equals: phone } }],
        },
      });
      const overPhoneCap = recentForPhone >= FAMILY_FORGOT_MAX_PER_WINDOW;

      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { phone } });
      let testSeamToken: string | undefined;

      if (parentAccount?.isActive && parentAccount.email && !overGlobalCap && !overPhoneCap) {
        const token = signFamilyResetToken(
          parentAccount.id,
          parentAccount.tokenVersion,
          getLmsSecret(),
          FAMILY_RESET_TTL_MINUTES * 60_000,
        );
        const resetUrl = `${familyResetAppOrigin()}/dat-lai-mat-khau-gia-dinh#token=${token}`;
        await ctx.db.emailOutbox.create({
          data: {
            to: parentAccount.email,
            transport: 'brevo',
            status: 'pending',
            payload: {
              kind: 'family-reset',
              resetUrl,
              ttlMinutes: FAMILY_RESET_TTL_MINUTES,
              phone,
            },
          },
        });
        if (TEST_OTP_SEAM_ENABLED) testSeamToken = token;
      }

      await ctx.db.auditLog.create({
        data: {
          actor: 'system',
          action: 'lmsAuth.familyForgotPassword',
          entity: 'ParentAccount',
          entityId: phone,
          data: { requested: true },
        },
      });

      return TEST_OTP_SEAM_ENABLED && testSeamToken
        ? { ok: true, _testSeamToken: testSeamToken }
        : { ok: true };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.familyResetPasswordWithToken — public; no auto-session.
  // -------------------------------------------------------------------------
  familyResetPasswordWithToken: publicProcedure
    .input(familyResetPasswordInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true }> => {
      const claims = verifyFamilyResetToken(input.token, getLmsSecret());
      if (!claims) {
        throw badRequest('Invalid or expired reset link.');
      }

      const parentAccount = await ctx.db.parentAccount.findUnique({
        where: { id: claims.parentAccountId },
      });
      if (
        !parentAccount ||
        !parentAccount.isActive ||
        parentAccount.tokenVersion !== claims.tokenVersion
      ) {
        throw badRequest('Invalid or expired reset link.');
      }

      if (parentAccount.passwordHash && verifyPassword(input.newPassword, parentAccount.passwordHash)) {
        throw badRequest('New password must be different.');
      }

      await ctx.db.parentAccount.update({
        where: { id: parentAccount.id },
        data: {
          passwordHash: hashPassword(input.newPassword),
          tokenVersion: { increment: 1 },
          loginAttempts: 0,
          loginLockedUntil: null,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          actor: parentAccount.id,
          action: 'lmsAuth.familyResetPasswordWithToken',
          entity: 'ParentAccount',
          entityId: parentAccount.id,
          data: { reset: true },
        },
      });

      return { ok: true };
    }),

  // -------------------------------------------------------------------------
  // lmsAuth.resetChildPassword — parent resets one child's password (lmsProcedure)
  // Parent-only gate: kind must be 'parent' or 'family'.
  // -------------------------------------------------------------------------
  resetChildPassword: lmsProcedure
    .input(resetChildPasswordInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true }> => {
      const { parentAccountId } = requireLmsParent(ctx);

      // Verify Guardian row exists for this parent→student.
      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      const studentAccount = await ctx.db.studentAccount.findUnique({
        where: { studentId: input.studentId },
      });
      if (!studentAccount) {
        throw forbidden('Student does not belong to this account.');
      }

      await ctx.db.studentAccount.update({
        where: { id: studentAccount.id },
        data: {
          passwordHash: hashPassword(input.newPassword),
          mustChangePassword: false,
          loginAttempts: 0,
          loginLockedUntil: null,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          actor: parentAccountId,
          action: 'lmsAuth.resetChildPassword',
          entity: 'StudentAccount',
          entityId: studentAccount.id,
          data: { studentId: input.studentId, parentAccountId },
        },
      });

      return { ok: true };
    }),
});

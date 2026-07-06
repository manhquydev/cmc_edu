// lms-auth router — WF-P1-07 (parent LMS login: phone + OTP, profile picker).
//
// Both procedures are `publicProcedure` by design (pre-auth, docs/11 §1) and
// never reveal whether a phone maps to a real `ParentAccount` (docs/24
// WF-P1-07 exceptions: "SĐT sai → không lộ tồn tại tài khoản"):
// `requestOtp` always issues an OTP row and returns the same generic `{ok:
// true}`; `verifyOtp` fails with the SAME generic error for a wrong code, an
// expired code, a locked-out code, and a correct code on a phone with no
// `ParentAccount`.
//
// H5 remediation: the code is hashed (../lms-auth/otp-hash.ts) rather than
// stored plaintext; a cooldown caps how often a phone can request a new
// code; and a per-row attempt counter locks the code (status -> expired)
// after MAX_OTP_VERIFY_ATTEMPTS wrong guesses. Issuing a new code also
// invalidates any still-pending prior code for the same phone — otherwise an
// attacker could reset their own attempt counter by simply requesting a
// fresh code, defeating the lockout.
//
// Session shape (ASSUMPTION, per phase brief — "a simple opaque session
// token is fine, real session infra is later"): there is no `Session` model
// in schema.prisma yet, so `sessionToken` is a base64url encoding of
// `{parentAccountId}` — deliberately mirroring the shape of the existing
// `x-dev-lms-user` dev-session header (../context.ts) the FE already
// constructs to authenticate `lmsProcedure` calls. This is a placeholder, not
// a signed/expiring credential; replacing it with real session infra
// (JWT/cookie) is tracked as follow-up, not hidden.

import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { InvalidPhoneError, normalizeLoginPhone } from '@cmc/domain-identity';
import { badRequest } from '../errors.js';
import { auditChildDataAccess, getApprovedChildren, type ApprovedChild } from '../guardian/approved-children.js';
import { publicProcedure, router } from '../trpc.js';
import { hashOtpCode, verifyOtpCode } from './otp-hash.js';

/** docs/19 §2: OTP is a random 6-digit code. */
const OTP_TTL_MINUTES = 5;
/**
 * H5 remediation: minimum interval between two `requestOtp` calls for the
 * same phone. No decision doc pins a concrete number (same situation as the
 * ADR-B second-eye threshold) — 30s is a placeholder chosen to make SMS-spam
 * / brute-force-reset abuse materially slower without being annoying for a
 * legitimate parent who mistyped the code once.
 */
const OTP_REQUEST_COOLDOWN_SECONDS = 30;
/** H5 remediation: failed verify attempts allowed against one OTP row before
 * it locks (status -> expired), same placeholder-threshold caveat as above. */
const MAX_OTP_VERIFY_ATTEMPTS = 5;
const GENERIC_VERIFY_FAILURE = 'Invalid or expired code.';
const GENERIC_COOLDOWN_FAILURE = 'Please wait before requesting another code.';

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function encodeSessionToken(parentAccountId: string): string {
  return Buffer.from(JSON.stringify({ parentAccountId }), 'utf8').toString('base64url');
}

/** Normalizes a raw login phone; a malformed phone is a format error
 * (BAD_REQUEST), not an account-existence leak — it fails identically
 * whether or not any account, real or hypothetical, ever used that shape. */
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

const requestOtpInput = z.object({ phone: z.string().min(1) });

const verifyOtpInput = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
});

export interface VerifyOtpResult {
  sessionToken: string;
  children: ApprovedChild[];
  /** docs/19 §2 profile picker: 1 child → auto-select client-side; ≥2 → picker. */
  needsPicker: boolean;
}

export const lmsAuthRouter = router({
  requestOtp: publicProcedure
    .input(requestOtpInput)
    .mutation(async ({ ctx, input }): Promise<{ ok: true }> => {
      const phone = normalizeOrReject(input.phone);

      // H5 cooldown: purely time-based against the most recent LoginOtp row
      // for this phone — identical regardless of whether the phone maps to a
      // real ParentAccount, so it adds no enumeration oracle.
      const mostRecent = await ctx.db.loginOtp.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });
      if (mostRecent) {
        const elapsedMs = Date.now() - mostRecent.createdAt.getTime();
        if (elapsedMs < OTP_REQUEST_COOLDOWN_SECONDS * 1000) {
          throw badRequest(GENERIC_COOLDOWN_FAILURE);
        }
      }

      // H5: invalidate any still-pending prior code for this phone before
      // issuing a new one — keeps at most one live code per phone, so a
      // locked-out attacker cannot reset their attempt counter by simply
      // requesting a fresh code.
      await ctx.db.loginOtp.updateMany({
        where: { phone, status: 'pending' },
        data: { status: 'expired' },
      });

      const code = generateOtpCode();
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

      // Issued unconditionally — whether or not `phone` maps to a real
      // ParentAccount — which is what keeps this response identical either
      // way. H5 remediation: `codeHash` now stores a salted hash, never the
      // plaintext code (see ./otp-hash.ts).
      await ctx.db.loginOtp.create({
        data: { phone, codeHash: hashOtpCode(code), status: 'pending', expiresAt },
      });

      // Delivery: no SMS transport is named in the docs (unlike email's
      // graph/brevo — schema.prisma `EmailTransport`); an audit row keeps the
      // "enqueue delivery" contract visible without inventing one. The OTP
      // code itself is intentionally never returned to the caller or logged.
      await ctx.db.auditLog.create({
        data: {
          actor: 'system',
          action: 'lmsAuth.requestOtp',
          entity: 'LoginOtp',
          entityId: phone,
          data: { phone },
        },
      });

      return { ok: true };
    }),

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
        // H5: only count a genuine wrong-code guess against an unlocked row
        // — never re-count once already locked, and never touch a
        // nonexistent/expired row.
        if (otp && !isLocked) {
          const attempts = otp.attempts + 1;
          await ctx.db.loginOtp.update({
            where: { id: otp.id },
            data: { attempts, status: attempts >= MAX_OTP_VERIFY_ATTEMPTS ? 'expired' : 'pending' },
          });
        }
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      // Atomic claim: only one concurrent verify can consume this OTP row —
      // a used/verified OTP can never be replayed (docs/24 WF-P1-07 state
      // machine: `issued -> verified`, one-shot).
      const claim = await ctx.db.loginOtp.updateMany({
        where: { id: otp.id, status: 'pending' },
        data: { status: 'verified' },
      });
      if (claim.count !== 1) {
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      const parentAccount = await ctx.db.parentAccount.findUnique({ where: { phone } });
      if (!parentAccount) {
        // Same generic failure as a wrong/expired code — never reveal that a
        // phone has no ParentAccount.
        throw badRequest(GENERIC_VERIFY_FAILURE);
      }

      const children = await getApprovedChildren(ctx.db, parentAccount.id);

      // M3 remediation (docs/08 §7): a successful login disclosing the
      // profile-picker child list is a real child-data read — audit it.
      await auditChildDataAccess(ctx.db, {
        parentAccountId: parentAccount.id,
        studentIds: children.map((c) => c.studentId),
        via: 'lmsAuth.verifyOtp',
      });

      return {
        sessionToken: encodeSessionToken(parentAccount.id),
        children,
        needsPicker: children.length >= 2,
      };
    }),
});

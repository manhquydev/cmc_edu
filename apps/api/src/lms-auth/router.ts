// lms-auth router — WF-P1-07 (parent LMS login: phone + OTP, profile picker).
//
// Both procedures are `publicProcedure` by design (pre-auth, docs/11 §1) and
// never reveal whether a phone maps to a real `ParentAccount` (docs/24
// WF-P1-07 exceptions: "SĐT sai → không lộ tồn tại tài khoản"):
// `requestOtp` always issues an OTP row and returns the same generic `{ok:
// true}`; `verifyOtp` fails with the SAME generic error for a wrong code, an
// expired code, and a correct code on a phone with no `ParentAccount`.
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
import { getApprovedChildren, type ApprovedChild } from '../guardian/approved-children.js';
import { publicProcedure, router } from '../trpc.js';

/** docs/19 §2: OTP is a random 6-digit code. */
const OTP_TTL_MINUTES = 5;
const GENERIC_VERIFY_FAILURE = 'Invalid or expired code.';

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
      const code = generateOtpCode();
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

      // Issued unconditionally — whether or not `phone` maps to a real
      // ParentAccount — which is what keeps this response identical either way.
      await ctx.db.loginOtp.create({
        data: { phone, code, status: 'pending', expiresAt },
      });

      // Delivery: no SMS transport is named in the docs (unlike email's
      // graph/brevo — schema.prisma `EmailTransport`); an audit row keeps the
      // "enqueue delivery" contract visible without inventing one. The OTP
      // code itself is intentionally never returned to the caller — tests
      // read it back from `LoginOtp` directly.
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
        where: { phone, code: input.code, status: 'pending', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (!otp) {
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

      return {
        sessionToken: encodeSessionToken(parentAccount.id),
        children,
        needsPicker: children.length >= 2,
      };
    }),
});

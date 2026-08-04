// Error-model helpers for the 5 standard TRPCError codes (TL11 §2). Business
// procedures should throw via these helpers rather than constructing
// `TRPCError` ad hoc, so the code choice stays consistent with the contract.

import { TRPCError } from '@trpc/server';

/** Input is wrong, or violates a business rule (e.g. refund exceeds cap). */
export function badRequest(message: string): TRPCError {
  return new TRPCError({ code: 'BAD_REQUEST', message });
}

/** Session is valid but lacks the required permission. */
export function forbidden(message: string): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message });
}

/** State/concurrency conflict (duplicate phone, race, double-booked room). */
export function conflict(message: string): TRPCError {
  return new TRPCError({ code: 'CONFLICT', message });
}

/** Entity does not exist, or exists outside the caller's RLS scope. */
export function notFound(message: string): TRPCError {
  return new TRPCError({ code: 'NOT_FOUND', message });
}

/** No session, or the session is invalid/expired. */
export function unauthorized(message: string): TRPCError {
  return new TRPCError({ code: 'UNAUTHORIZED', message });
}

/**
 * HR remediation phase 4: a TRPCError subclass that carries a stable,
 * machine-readable `appCode` alongside the standard `code`. `trpc.ts`'s
 * errorFormatter copies `appCode` onto `shape.data` ONLY for instances of
 * this class (instanceof check) — never from a generic `error.cause.code` —
 * so an unrelated raw error (e.g. a rethrown Prisma `P2xxx`, see
 * payroll/router.ts) can never leak an `appCode` to the client. Use this only
 * for errors a UI needs to branch on beyond the 5 standard TRPCError codes
 * (e.g. `IP_NOT_ALLOWED`, `COOLDOWN`).
 */
/** Optional typed extras for AppCodeError — allowlisted only (never free-form). */
export type AppCodeErrorData = {
  /** Max accuracyMaxM among active geofences — client-side offsite messaging. */
  geoThresholdM?: number;
};

export class AppCodeError extends TRPCError {
  readonly appCode: string;
  readonly appData?: AppCodeErrorData;

  constructor(opts: {
    code: ConstructorParameters<typeof TRPCError>[0]['code'];
    appCode: string;
    message: string;
    appData?: AppCodeErrorData;
  }) {
    super({ code: opts.code, message: opts.message });
    this.appCode = opts.appCode;
    this.appData = opts.appData;
  }
}

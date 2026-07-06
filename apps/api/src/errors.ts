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

// tRPC 11 base: context, procedures, and authorization helpers.
//
// Conventions (TL11): procedures are named `module.action`; inputs validate
// with zod; errors use TRPCError with the 5 standard codes (see ./errors.ts).
// Authorization always flows through @cmc/auth `can()` — never a hardcoded
// role array.

import { initTRPC } from '@trpc/server';
import { can, type AuthSubject } from '@cmc/auth';
import type { PrismaClient } from '@cmc/db';
import { forbidden, unauthorized } from './errors.js';

/**
 * LMS session subject (parent/student, TL11 §1). A distinct identity space
 * from staff `AuthSubject` — the two are never conflated, and `lmsProcedure`
 * never falls back to a staff session.
 */
export interface LmsSubject {
  parentAccountId: string;
  studentId?: string;
}

export interface Context {
  /** Authenticated staff subject, or null for anonymous/public calls. */
  subject: AuthSubject | null;
  /** Facility the staff subject is scoped to; null when unauthenticated. */
  facilityId: string | null;
  /** Authenticated LMS (parent/student) subject, or null. */
  lmsSubject: LmsSubject | null;
  /** Prisma client, connected as the unprivileged `cmc_app` role (see
   * `createPrismaClient()`). Facility isolation is defense-in-depth (ADR
   * 0042): layer 1 is the app-level `scoped(ctx)` filter below (primary,
   * ergonomic, index-friendly); layer 2 is Postgres RLS, which requires every
   * facility-scoped query to run through `withFacility()` (@cmc/db) so the
   * `app.current_facility_id` GUC is set — a plain `ctx.db.model.find(...)`
   * outside that helper has no GUC set and RLS rejects it (0 rows), it does
   * NOT fall back to unrestricted access. Never trust a client-supplied
   * facilityId over the session's. */
  db: PrismaClient;
  /** Caller IP (from `x-forwarded-for` when behind a proxy), or null. */
  ip: string | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public procedures need no session. Reserved for health / public intake. */
export const publicProcedure = t.procedure;

const requireSession = t.middleware(({ ctx, next }) => {
  if (!ctx.subject) {
    throw unauthorized('Session required.');
  }
  return next({ ctx: { ...ctx, subject: ctx.subject } });
});

/** Requires a valid staff session. */
export const protectedProcedure = t.procedure.use(requireSession);

const requireLmsSession = t.middleware(({ ctx, next }) => {
  if (!ctx.lmsSubject) {
    throw unauthorized('LMS session required.');
  }
  return next({ ctx: { ...ctx, lmsSubject: ctx.lmsSubject } });
});

/**
 * LMS gate (parent/student session). Deliberately does NOT check `can()` /
 * staff roles — there is no SYSTEM/super_admin bypass into LMS surfaces
 * (TL11 §1); a staff session alone never satisfies this procedure.
 */
export const lmsProcedure = t.procedure.use(requireLmsSession);

/**
 * RBAC gate. Business procedures use `requirePermission('module','action')`,
 * reading the single @cmc/auth registry that nav and UI share.
 */
export function requirePermission(module: string, action: string) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.subject, module, action)) {
      throw forbidden(`Missing permission ${module}.${action}.`);
    }
    return next();
  });
}

/**
 * RLS helper: returns the facility to scope every domain query by. Throws
 * `UNAUTHORIZED` if the context has no resolved facility — callers must not
 * fall back to a client-supplied facilityId (TL11 §1, "facilityId suy
 * server-side, không tin client").
 */
export function scoped(ctx: Context): { facilityId: string } {
  if (!ctx.facilityId) {
    throw unauthorized('Facility context is required.');
  }
  return { facilityId: ctx.facilityId };
}

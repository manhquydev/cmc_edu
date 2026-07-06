// tRPC 11 base: context, procedures, and authorization helpers.
//
// Conventions (TL11): procedures are named `module.action`; inputs validate
// with zod; errors use TRPCError with the 5 standard codes (see ./errors.ts).
// Authorization always flows through @cmc/auth `can()` — never a hardcoded
// role array.

import { initTRPC } from '@trpc/server';
import { can, type AuthSubject } from '@cmc/auth';
import type { PrismaClient } from '@cmc/db';
import { badRequest, forbidden, unauthorized } from './errors.js';

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
/** Combines two routers under one key (../router.ts merges `exercise.*`
 * CRUD, T2-I, with `exercise.openForStudent`/`listForStudent`, T2-II). */
export const mergeRouters = t.mergeRouters;

/** Public procedures need no session. Reserved for health / public intake. */
export const publicProcedure = t.procedure;

const requireSession = t.middleware(({ ctx, next }) => {
  if (!ctx.subject) {
    throw unauthorized('Session required.');
  }
  return next({ ctx: { ...ctx, subject: ctx.subject } });
});

/**
 * K7 remediation (deep-review consolidated report): reject a staff request
 * whose resolved `facilityId` does not correspond to a real `Facility` row.
 * Without this, a forged/typo'd `x-dev-user.facilityId` header (or, later, a
 * bad SSO claim) silently "minted" an invisible tenant — every
 * facility-scoped query still ran and happily partitioned by whatever string
 * it was given (RLS treats an unknown facilityId as just another value), but
 * no admin surface could ever see or reconcile it. `Facility` carries no RLS
 * policy (it is the platform-level catalog, not itself facility-scoped — see
 * schema.prisma), so this is a plain lookup, not a `withFacility` call.
 *
 * R2 remediation (deep-review adversarial verification): this check made the
 * very FIRST facility on a clean DB impossible to create through the API —
 * `facility.create` is itself a `protectedProcedure` (K7), so a staff session
 * needs an already-valid `facilityId` just to reach the mutation that creates
 * one. A `super_admin` session bypasses it: a platform admin mints tenants
 * from OUTSIDE any single tenant (there is no facility yet to be "in"), and
 * `super_admin` already bypasses the entire @cmc/auth permission registry
 * (`can()`) — exempting it here does not weaken this check for any other
 * role, which still needs a facilityId that resolves to a real row.
 */
const requireValidFacility = t.middleware(async ({ ctx, next }) => {
  // `protectedProcedure` always chains `.use(requireSession).use(requireValidFacility)`,
  // so `ctx.subject` is non-null at runtime by the time this middleware runs —
  // the optional chain here is just to satisfy this middleware's own
  // (wider, `Context`-typed) `ctx.subject: AuthSubject | null` signature.
  if (ctx.subject?.roles.includes('super_admin')) {
    return next();
  }
  if (ctx.facilityId) {
    const facility = await ctx.db.facility.findUnique({
      where: { id: ctx.facilityId },
      select: { id: true },
    });
    if (!facility) {
      throw unauthorized('Session references an unknown facility.');
    }
  }
  return next();
});

/** Requires a valid staff session AND a facilityId that resolves to a real Facility. */
export const protectedProcedure = t.procedure.use(requireSession).use(requireValidFacility);

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

/**
 * T2-II: the LMS analogue of `scoped(ctx)` — every exercise-open/submission
 * procedure needs a resolved `studentId`, not just a parent session
 * (`LmsSubject.studentId` is optional because a parent with multiple
 * children has no single "current student" until they pick one in the
 * profile picker, TL19 §2). `lmsProcedure` only guarantees `ctx.lmsSubject`
 * is non-null, not that a student was selected — this is that second gate.
 */
export function requireLmsStudent(ctx: Context): { parentAccountId: string; studentId: string } {
  if (!ctx.lmsSubject) {
    throw unauthorized('LMS session required.');
  }
  if (!ctx.lmsSubject.studentId) {
    throw badRequest('A student profile must be selected first.');
  }
  return { parentAccountId: ctx.lmsSubject.parentAccountId, studentId: ctx.lmsSubject.studentId };
}

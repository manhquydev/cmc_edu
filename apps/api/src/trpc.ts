// tRPC 11 base: context, procedures, and authorization helpers.
//
// Conventions (TL11): procedures are named `module.action`; inputs validate
// with zod; errors use TRPCError with the 5 standard codes (see ./errors.ts).
// Authorization always flows through @cmc/auth `can()` — never a hardcoded
// role array.

import { initTRPC } from '@trpc/server';
import { can, type AuthSubject } from '@cmc/auth';
import type { Prisma, PrismaClient } from '@cmc/db';
import { AppCodeError, badRequest, forbidden, unauthorized } from './errors.js';
import {
  deriveEntity,
  deriveEntityId,
  resolveAuditActor,
  sanitizeAuditData,
} from './audit/audit-helpers.js';

/**
 * LMS session subject (parent/student, TL11 §1). A distinct identity space
 * from staff `AuthSubject` — the two are never conflated, and `lmsProcedure`
 * never falls back to a staff session.
 *
 * `kind` distinguishes a parent session (phone/email OTP) from a student
 * session (password login). Gates that must be parent-only or student-only
 * check this field after `lmsProcedure` confirms the subject is non-null.
 */
export interface LmsSubject {
  parentAccountId: string;
  studentId?: string;
  kind: 'parent' | 'student';
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

/**
 * HR remediation phase 4 (red-team #5): additive-only `errorFormatter` — it
 * spreads the default `shape` untouched and only ADDS `data.appCode`, and
 * ONLY when the thrown error is an `AppCodeError` instance (never from a
 * generic `error.cause.code`, which would leak raw Prisma `P2xxx` codes —
 * see payroll/router.ts's rethrown-cause path). Every other error's shape is
 * byte-for-byte identical to the pre-phase-4 default formatter's output.
 */
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    if (error instanceof AppCodeError) {
      // Allowlist only: appCode + optional typed appData (never free-form spread).
      return {
        ...shape,
        data: {
          ...shape.data,
          appCode: error.appCode,
          ...(error.appData !== undefined ? { appData: error.appData } : {}),
        },
      };
    }
    return shape;
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
/** Combines two routers under one key (../router.ts merges `exercise.*`
 * CRUD, T2-I, with `exercise.openForStudent`/`listForStudent`, T2-II). */
export const mergeRouters = t.mergeRouters;

/**
 * Phase-04 super-admin-completion: paths that already write their OWN
 * AuditLog entry inline (richer than a generic best-effort row — e.g.
 * finance receipts capture before/after amounts) — the auto middleware below
 * skips these so a mutation never produces 2 rows for 1 call. Every path
 * NOT in this set (the vast majority — e.g. `checkInOut.punch`,
 * `user.create`, `enrollment.enroll`, previously entirely unaudited) gets
 * covered automatically. Survey: apps/api/src grep for `auditLog.create`
 * (2026-07-16).
 */
const AUDIT_EXCLUDED_PATHS = new Set<string>([
  'facility.create',
  'facility.update',
  'facilityNetwork.create',
  'facilityNetwork.update',
  'facilityNetwork.delete',
  'enrollment.blockLms',
  'crm.opportunityCreate',
  'classSession.cancel',
  'finance.receiptApprove',
  'finance.receiptCancel',
  'lmsAuth.requestOtp',
  'lmsAuth.requestOtpEmail',
  'lmsAuth.loginStudent',
  'lmsAuth.resetChildPassword',
  // Post-review fix: these two already audit via a SHARED helper
  // (auditChildDataAccess → action 'guardian.childDataRead'), not an inline
  // `auditLog.create` literal matching their own path name — a path-by-path
  // grep for `action: 'lmsAuth...'` missed them. Their raw input is
  // `{ phone|email, code }` (the just-typed OTP) — critical to exclude
  // regardless of the denylist, since a secret-bearing input should never
  // depend solely on a field-name regex to stay out of AuditLog.
  'lmsAuth.verifyOtp',
  'lmsAuth.verifyOtpEmail',
  'reconciliation.dismiss',
  'reconciliation.action',
  'user.updateRoles',
  // Staff password procedures: raw input is `{currentPassword,newPassword}` /
  // `{tempPassword,...}` — secret-bearing, same rationale as the OTP verify
  // exclusions above. Both write their own secret-free AuditLog row inline.
  'user.changeOwnPassword',
  'user.resetPassword',
  'attendance.mark',
  'attendance.markAll',
  'submission.saveTeacherAnnotation',
  'parentAccount.updateEmail',
  'student.resetPassword',
  'student.setLifecycle',
  'manualPunch.approve',
  'manualPunch.reject',
]);

/**
 * Phase-04 super-admin-completion: auto-logs every SUCCESSFUL mutation to
 * `AuditLog`, replacing the ~25-site hand-written pattern above as the
 * default (PO decision: "ghi TẤT CẢ thao tác thành công" — hand-writing each
 * site individually already missed `user.create`/`user.update`, the exact
 * kind of silent gap this middleware exists to close). Attached to the
 * shared `basedProcedure` below so EVERY procedure kind (public/protected/
 * lms) inherits it from one wiring point.
 *
 * Runs `next()` FIRST and inspects the result — `type==='mutation' &&
 * result.ok` is what makes this "only successful mutations, never queries,
 * never failures". Position at the very base of the chain (before
 * `requireSession`/`requireLmsSession`) is deliberate: it is the only point
 * that sees `ctx.subject`/`ctx.lmsSubject` for ALL THREE actor kinds,
 * including public procedures that never resolve a session (login/OTP
 * request) — those still need an `actor: 'anonymous'` row.
 *
 * The audit write itself is best-effort but NOT silent-on-failure: a DB
 * error here is logged (never thrown — a broken audit write must not break
 * the underlying mutation the user actually asked for), so a failure mode
 * that would otherwise silently punch a hole in the audit trail is at least
 * visible in server logs.
 */
const auditLogMiddleware = t.middleware(async ({ ctx, next, path, type, getRawInput }) => {
  const result = await next();
  if (type !== 'mutation' || !result.ok || AUDIT_EXCLUDED_PATHS.has(path)) {
    return result;
  }
  try {
    const rawInput = await getRawInput().catch(() => undefined);
    const resultData = (result as { data?: unknown }).data;
    await ctx.db.auditLog.create({
      data: {
        actor: resolveAuditActor(ctx),
        action: path,
        entity: deriveEntity(path),
        entityId: deriveEntityId(rawInput, resultData),
        data: sanitizeAuditData(rawInput) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Never let a broken audit write silently punch a hole in the audit
    // trail NOR break the mutation the caller actually asked for.
    // eslint-disable-next-line no-console
    console.error(`[audit] failed to write audit log for ${path}`, err);
  }
  return result;
});

/** Every procedure kind (public/protected/lms) is built on top of this so
 * `auditLogMiddleware` wraps all of them from one wiring point. */
const basedProcedure = t.procedure.use(auditLogMiddleware);

/** Public procedures need no session. Reserved for health / public intake. */
export const publicProcedure = basedProcedure;

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
export const protectedProcedure = basedProcedure.use(requireSession).use(requireValidFacility);

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
export const lmsProcedure = basedProcedure.use(requireLmsSession);

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
  if (ctx.lmsSubject.kind !== 'student') {
    throw forbidden('Student session required.');
  }
  if (!ctx.lmsSubject.studentId) {
    throw badRequest('A student profile must be selected first.');
  }
  return { parentAccountId: ctx.lmsSubject.parentAccountId, studentId: ctx.lmsSubject.studentId };
}

/**
 * Parent-only gate — symmetric counterpart to `requireLmsStudent`. Use this
 * in every procedure that operates on behalf of the parent identity
 * (setPhotoConsent, listChildren/enrollment.mine, resetChildPassword, etc.)
 * so a student session cannot reach parent-only data paths.
 */
export function requireLmsParent(ctx: Context): { parentAccountId: string } {
  if (!ctx.lmsSubject) {
    throw unauthorized('LMS session required.');
  }
  if (ctx.lmsSubject.kind !== 'parent') {
    throw forbidden('Parent session required.');
  }
  return { parentAccountId: ctx.lmsSubject.parentAccountId };
}

/**
 * Server-side guard for the mustChangePassword flag. Must be called at the start
 * of every student-facing mutation that modifies domain state (submit, redeem,
 * etc.). A DB round-trip is required because the session token is not yet HMAC-
 * signed (P0-debt) — relying on the token value alone would be client-bypassable.
 *
 * Query procedures (listForStudent, openForStudent) are intentionally exempt:
 * a student who has not yet changed their password can still read their history
 * and view exercises, but cannot submit new work or redeem rewards.
 */
export async function assertPasswordNotExpired(ctx: Context, studentId: string): Promise<void> {
  const account = await ctx.db.studentAccount.findUnique({
    where: { studentId },
    select: { mustChangePassword: true },
  });
  if (account?.mustChangePassword) {
    throw forbidden('Password change required before proceeding.');
  }
}

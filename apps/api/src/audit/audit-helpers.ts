// Phase-04 super-admin-completion: pure building blocks for the audit
// middleware (trpc.ts). Kept dependency-free (no @trpc/server, no db) so
// actor resolution, entity/entityId derivation, and the sensitive-field
// denylist are unit-testable without a real tRPC call — see
// audit-helpers.test.ts.

import type { Context } from '../trpc.js';

/** Actor resolution must cover all 3 session kinds (PO decision, phase-04):
 * staff → raw userId; LMS parent/student → prefixed id; no session at all
 * (e.g. login/OTP request) → 'anonymous'. Never throws — every Context shape
 * this app produces resolves to a string. */
export function resolveAuditActor(ctx: Context): string {
  if (ctx.subject) return ctx.subject.userId;
  if (ctx.lmsSubject) {
    if (ctx.lmsSubject.kind === 'student' && ctx.lmsSubject.studentId) {
      return `student:${ctx.lmsSubject.studentId}`;
    }
    return `parent:${ctx.lmsSubject.parentAccountId}`;
  }
  return 'anonymous';
}

/** Best-effort `entity` — the router/module segment of the tRPC path
 * (`facilityNetwork.create` → `facilityNetwork`). Always correct; `path`
 * itself (stored as `action`) is the source of truth. */
export function deriveEntity(path: string): string {
  const [first] = path.split('.');
  return first ?? path;
}

function extractIdLike(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj.id;
  for (const [key, v] of Object.entries(obj)) {
    if (key.endsWith('Id') && typeof v === 'string') return v;
  }
  return undefined;
}

/** Actions whose mutation INPUT carries a different record's id — e.g.
 *  `user.create` takes the auth `userId`, `afterSale.create` takes
 *  `studentId`, `parentMeeting.schedule`/`testAppointment.schedule` take
 *  `studentId`/`opportunityId`, `shift.createTemplate`/`shift.submit` take
 *  `shiftGroupId` — so the default input-first precedence would store the
 *  WRONG record id. For these actions only, entityId comes from the created
 *  result row. The global input→result precedence is deliberately NOT
 *  reversed: for update-shaped mutations the input id is the right answer,
 *  and a blanket flip would break every one of them. New ambiguous actions
 *  join this registry, never a precedence change. */
export const AUDIT_ENTITY_ID_RESULT_ACTIONS: ReadonlySet<string> = new Set([
  'user.create',
  'afterSale.create',
  'parentMeeting.schedule',
  'testAppointment.schedule',
  'shift.createTemplate',
  'shift.submit',
  'kpi.refresh',
]);

/** Same ambiguity as the registry above, but the created row is NESTED one
 *  level inside the result wrapper under a fixed, hand-named key — e.g.
 *  `finance.receiptCreate` returns `{status, receipt}` (the receipt dto) and
 *  `rewards.redeem` returns `{reward, newBalance}`. Membership names the
 *  wrapper key explicitly; there is still no generic scraping — an action
 *  not listed here never has its result unwrapped. */
export const AUDIT_ENTITY_ID_RESULT_KEYS: Readonly<Record<string, string>> = {
  'finance.receiptCreate': 'receipt',
  'finance.refundCreate': 'refund',
  'rewards.redeem': 'reward',
};

/** Best-effort `entityId` — checks the mutation's input first (an `id` field,
 * else the first `*Id` field), then falls back to the resolver's own return
 * value (most `create` mutations return the created row with an `id`).
 * `AUDIT_ENTITY_ID_RESULT_ACTIONS` members invert that order per action;
 * `AUDIT_ENTITY_ID_RESULT_KEYS` members unwrap one named result key first.
 * Empty string when nothing yields one (accepted — `action`/`entity` are the
 * fields guaranteed correct, per phase-04 plan). */
export function deriveEntityId(input: unknown, resultData: unknown, action?: string): string {
  const unwrapped =
    action !== undefined && action in AUDIT_ENTITY_ID_RESULT_KEYS
      ? (resultData as Record<string, unknown> | null | undefined)?.[AUDIT_ENTITY_ID_RESULT_KEYS[action]]
      : undefined;
  const fromResult = extractIdLike(unwrapped) ?? extractIdLike(resultData);
  if (action !== undefined && AUDIT_ENTITY_ID_RESULT_ACTIONS.has(action)) {
    return fromResult ?? '';
  }
  if (unwrapped !== undefined) {
    // Keyed-unwrap actions prefer the unwrapped row's id — without this,
    // receiptCreate stored whichever unrelated *Id the client serialized
    // first (opportunityId/studentId/classBatchId), i.e. a nondeterministic
    // entityId on the compliance ledger.
    return fromResult ?? extractIdLike(input) ?? '';
  }
  return extractIdLike(input) ?? fromResult ?? '';
}

const SENSITIVE_KEY_RE = /password|otp|token|secret/i;

/** Post-review fix: OTP-verify endpoints (`lmsAuth.verifyOtp[Email]`) take a
 * plain 6-digit code in a field literally named `code` — not caught by
 * `SENSITIVE_KEY_RE`. Matched as an EXACT key name (not a substring, unlike
 * the regex above) so legitimate business identifiers that merely contain
 * "code" (`facilityCode`, `employeeCode`, `classCode`) are NOT hidden from
 * the audit trail — only a field named exactly `code` is a bare
 * verification/OTP code in every mutation this app has. This is a second,
 * independent layer on top of excluding the known verifyOtp* paths in
 * `trpc.ts`'s `AUDIT_EXCLUDED_PATHS` — a secret-bearing field should never
 * rely on a single survey to stay out of AuditLog. */
const SENSITIVE_EXACT_KEYS = new Set(['code']);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key) || SENSITIVE_EXACT_KEYS.has(key.toLowerCase());
}

/** Recursion for `sanitizeAuditData` — strips sensitive keys at every level,
 * not just the top one. Pre-recursion, a sensitive field nested inside an
 * array/object input (e.g. `shift.submit`'s `entries: z.array(z.object(...))`,
 * shift/router.ts:64-77) passed through untouched. */
function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  // `Date` has no enumerable own properties — the generic object branch below
  // would silently rewrite it to `{}`. Not reachable from the tRPC middleware
  // (getRawInput() is pre-parse JSON, no Date instances) but a manual audit
  // call site passing a Prisma row through here directly would hit this.
  if (value instanceof Date) return value;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) continue;
      out[key] = sanitizeValue(v);
    }
    return out;
  }
  return value;
}

/** Denylists password/OTP/token/secret-named fields before an input is
 * persisted into `AuditLog.data` — never store credentials in the audit
 * trail, even best-effort ones. Non-object input (no-arg mutations) yields
 * `undefined` rather than an empty object, matching Prisma's `Json?`. */
export function sanitizeAuditData(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  return sanitizeValue(input) as Record<string, unknown>;
}

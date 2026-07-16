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

/** Best-effort `entityId` — checks the mutation's input first (an `id` field,
 * else the first `*Id` field), then falls back to the resolver's own return
 * value (most `create` mutations return the created row with an `id`).
 * Empty string when neither yields one (accepted — `action`/`entity` are the
 * fields guaranteed correct, per phase-04 plan). */
export function deriveEntityId(input: unknown, resultData: unknown): string {
  return extractIdLike(input) ?? extractIdLike(resultData) ?? '';
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

/** Denylists password/OTP/token/secret-named fields before an input is
 * persisted into `AuditLog.data` — never store credentials in the audit
 * trail, even best-effort ones. Non-object input (no-arg mutations) yields
 * `undefined` rather than an empty object, matching Prisma's `Json?`. */
export function sanitizeAuditData(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isSensitiveKey(key)) continue;
    out[key] = value;
  }
  return out;
}

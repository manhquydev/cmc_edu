// Request context factory.
//
// Auth strategy (PD-1):
//   Staff identity  — Microsoft Entra SSO session (TODO: msal-node, docs/18 §1);
//                     dev/test: `x-dev-user` header (JSON {userId,roles,facilityId})
//                     enabled only when NODE_ENV !== 'production'.
//   LMS identity    — HMAC-signed bearer token (see lms-auth/session-token.ts);
//                     dev/test: `x-dev-lms-user` header as fallback when
//                     NODE_ENV !== 'production'.
//
// Fail-closed: in production, impersonation headers are never read (RT-2).
// The `ALLOW_DEV_AUTH` escape hatch has been removed — it was a backdoor that
// allowed re-enabling impersonation in production via an env var. The gate is
// now strictly NODE_ENV !== 'production', with no opt-out.
//
// Malformed/missing session degrades to anonymous context — auth gates
// (protectedProcedure / lmsProcedure) reject the unauthenticated call.

import type { IncomingMessage } from 'node:http';
import { z } from 'zod';
import { createPrismaClient, PrismaClient } from '@cmc/db';
import { ROLES, type AuthSubject } from '@cmc/auth';
import { LMS_SESSION_SECRET_DEV_DEFAULT, verifyLmsToken } from './lms-auth/session-token.js';
import {
  getStaffSessionSecret,
  parseStaffCookie,
  verifyStaffToken,
} from './auth/staff-session.js';
import type { Context, LmsSubject } from './trpc.js';

const devUserHeaderSchema = z.object({
  userId: z.string().min(1),
  // KEEP 9-role — tokens/legacy users may carry dormant roles; deny via
  // registry (PERMISSIONS ⊆ ACTIVE_ROLES), not via session parse failure.
  roles: z.array(z.enum(ROLES)).min(1),
  facilityId: z.string().min(1),
});

const devLmsUserHeaderSchema = z.object({
  parentAccountId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  // Default 'parent' so existing dev headers without kind continue to work.
  kind: z.enum(['parent', 'student', 'family']).default('parent'),
});

/**
 * Dev-header impersonation is strictly limited to non-production environments.
 * RT-2: the `ALLOW_DEV_AUTH=1` escape hatch has been removed — there is no
 * way to re-enable impersonation headers in NODE_ENV=production.
 */
const DEV_AUTH_ENABLED = process.env.NODE_ENV !== 'production';

// Lazily constructed so importing/creating a context never opens a DB
// connection unless a caller actually reads `ctx.db` (keeps the health smoke
// test and any DB-less unit test independent of DATABASE_URL/Postgres).
let dbSingleton: PrismaClient | undefined;

function getDb(): PrismaClient {
  // `createPrismaClient()` connects via `APP_DATABASE_URL` (the unprivileged
  // `cmc_app` role) when set, which Postgres RLS (ADR 0042) requires — the
  // migration-owner role in `DATABASE_URL` bypasses RLS unconditionally.
  dbSingleton ??= createPrismaClient();
  return dbSingleton;
}

function readHeader(
  headers: IncomingMessage['headers'] | undefined,
  name: string,
): string | undefined {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseDevUser(raw: string | undefined): { subject: AuthSubject; facilityId: string } | null {
  if (!raw) return null;
  try {
    const parsed = devUserHeaderSchema.parse(JSON.parse(raw));
    return {
      subject: { userId: parsed.userId, roles: parsed.roles },
      facilityId: parsed.facilityId,
    };
  } catch {
    // Malformed dev header degrades to anonymous rather than crashing the request.
    return null;
  }
}

function parseDevLmsUser(raw: string | undefined): LmsSubject | null {
  if (!raw) return null;
  try {
    return devLmsUserHeaderSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Parses an LMS bearer token from the Authorization header and verifies its
 * HMAC-SHA256 signature. Returns the decoded claims or null on any failure.
 *
 * Secret resolution order:
 *   1. LMS_SESSION_SECRET env var (required in production — boot-check enforces)
 *   2. Hard-coded dev default (safe only because boot-check refuses prod start
 *      when the default is in use)
 */
function getLmsSecret(): string {
  return process.env['LMS_SESSION_SECRET'] ?? LMS_SESSION_SECRET_DEV_DEFAULT;
}

function parseBearerLmsToken(
  headers: IncomingMessage['headers'] | undefined,
): LmsSubject | null {
  const auth = headers?.['authorization'];
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return verifyLmsToken(token, getLmsSecret());
}

// Trusted-proxy CIDR list (RT-5). Only trust X-Forwarded-For from addresses
// in this list. Format: comma-separated IPv4 CIDR or IPv6 exact-match strings.
// Default = loopback only (safe for direct deployments; set TRUSTED_PROXY_CIDRS
// when the API sits behind an nginx/LB whose address is known).
// Read at call time so tests and runtime env changes apply without re-import.
function trustedProxyCidrs(): string[] {
  return (process.env['TRUSTED_PROXY_CIDRS'] ?? '127.0.0.1/32,::1/128')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const byte = parseInt(p, 10);
    if (Number.isNaN(byte) || byte < 0 || byte > 255) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0;
}

function isTrustedProxy(ip: string): boolean {
  for (const entry of trustedProxyCidrs()) {
    const slash = entry.indexOf('/');
    if (slash === -1) {
      if (entry === ip) return true;
      continue;
    }
    const base = entry.slice(0, slash);
    const bits = parseInt(entry.slice(slash + 1), 10);
    if (Number.isNaN(bits) || bits < 0 || bits > 32) continue;
    const ipInt = ipv4ToUint32(ip);
    const baseInt = ipv4ToUint32(base);
    if (ipInt === null || baseInt === null) continue;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if ((ipInt & mask) === (baseInt & mask)) return true;
  }
  return false;
}

function resolveIp(req: IncomingMessage | undefined): string | null {
  if (!req) return null;
  const remoteAddr = req.socket?.remoteAddress ?? null;
  const forwarded = req.headers['x-forwarded-for'];
  if (
    typeof forwarded === 'string' &&
    forwarded.length > 0 &&
    remoteAddr !== null &&
    isTrustedProxy(remoteAddr)
  ) {
    // XFF is appended left-to-right; rightmost hop = nearest to us and least
    // attacker-controlled. Take the rightmost hop NOT in our trusted list.
    const hops = forwarded.split(',').map((h) => h.trim());
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isTrustedProxy(hops[i]!)) return hops[i]!;
    }
    // All hops are trusted — return remoteAddr (all hops are our own proxies).
    return remoteAddr;
  }
  return remoteAddr;
}

export interface CreateContextOptions {
  req?: IncomingMessage;
}

/**
 * Resolves facilityId for a staff context, applying the x-facility-id header
 * override (RT-α): super_admin may switch to any facilityId; non-super_admin
 * is restricted to their own facilityId (mismatch → request is rejected by
 * `scoped()` / `requirePermission` which calls `can()` with the wrong facility).
 *
 * Returns the override facilityId when the caller is super_admin, otherwise
 * the cookie-snapshot facilityId (ignores the header for non-super_admin so
 * that a forged header cannot escalate privilege).
 */
function resolveStaffFacilityId(
  cookieFacilityId: string,
  roles: readonly string[],
  facilityIdHeader: string | undefined,
): string {
  if (!facilityIdHeader) return cookieFacilityId;
  const isSuper = roles.includes('super_admin');
  // Non-super_admin: silently ignore the override header (never escalate).
  if (!isSuper) return cookieFacilityId;
  return facilityIdHeader;
}

export function createContext(opts: CreateContextOptions = {}): Context {
  const headers = opts.req?.headers;

  // Staff identity resolution order (S2):
  // 1. Staff session cookie (all envs — produced by Entra SSO callback)
  // 2. x-dev-user header (non-prod only — kept for local dev and e2e mode-A)
  const cookieHeader = readHeader(headers, 'cookie');
  const staffToken = parseStaffCookie(cookieHeader);
  const staffClaims = staffToken ? verifyStaffToken(staffToken, getStaffSessionSecret()) : null;

  let staffSubject: { subject: AuthSubject; facilityId: string } | null = null;
  if (staffClaims) {
    const facilityIdOverride = readHeader(headers, 'x-facility-id');
    const facilityId = resolveStaffFacilityId(
      staffClaims.facilityId,
      staffClaims.roles,
      facilityIdOverride,
    );
    staffSubject = {
      subject: { userId: staffClaims.userId, roles: staffClaims.roles },
      facilityId,
    };
  }

  const devUser =
    !staffSubject && DEV_AUTH_ENABLED
      ? parseDevUser(readHeader(headers, 'x-dev-user'))
      : null;

  const resolvedStaff = staffSubject ?? devUser;

  // LMS identity: bearer token (all envs) takes precedence over dev-header fallback.
  // In production only the bearer path is active (DEV_AUTH_ENABLED = false).
  const lmsUser =
    parseBearerLmsToken(headers) ??
    (DEV_AUTH_ENABLED
      ? parseDevLmsUser(readHeader(headers, 'x-dev-lms-user'))
      : null);

  return {
    subject: resolvedStaff?.subject ?? null,
    facilityId: resolvedStaff?.facilityId ?? null,
    lmsSubject: lmsUser,
    get db() {
      return getDb();
    },
    ip: resolveIp(opts.req),
  };
}

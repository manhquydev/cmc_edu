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
import type { Context, LmsSubject } from './trpc.js';

const devUserHeaderSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1),
  facilityId: z.string().min(1),
});

const devLmsUserHeaderSchema = z.object({
  parentAccountId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  // Default 'parent' so existing dev headers without kind continue to work.
  kind: z.enum(['parent', 'student']).default('parent'),
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

function resolveIp(req: IncomingMessage | undefined): string | null {
  if (!req) return null;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.socket?.remoteAddress ?? null;
}

export interface CreateContextOptions {
  req?: IncomingMessage;
}

export function createContext(opts: CreateContextOptions = {}): Context {
  // Staff identity: dev-header (non-prod only) — Entra SSO replaces this in PD-1.
  const devUser = DEV_AUTH_ENABLED
    ? parseDevUser(readHeader(opts.req?.headers, 'x-dev-user'))
    : null;

  // LMS identity: bearer token (all envs) takes precedence over dev-header fallback.
  // In production only the bearer path is active (DEV_AUTH_ENABLED = false).
  const lmsUser =
    parseBearerLmsToken(opts.req?.headers) ??
    (DEV_AUTH_ENABLED
      ? parseDevLmsUser(readHeader(opts.req?.headers, 'x-dev-lms-user'))
      : null);

  return {
    subject: devUser?.subject ?? null,
    facilityId: devUser?.facilityId ?? null,
    lmsSubject: lmsUser,
    get db() {
      return getDb();
    },
    ip: resolveIp(opts.req),
  };
}

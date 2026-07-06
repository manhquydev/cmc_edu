// Request context factory.
//
// Dev-only session stub: staff identity comes from the `x-dev-user` header
// (JSON `{ userId, roles, facilityId }`), LMS identity from `x-dev-lms-user`
// (JSON `{ parentAccountId, studentId? }`). Malformed/missing headers degrade
// to an anonymous context rather than throwing — auth gates (protectedProcedure
// / lmsProcedure) are what reject unauthenticated calls, not context creation.
//
// TODO(P0-debt): real staff auth is Microsoft Entra SSO (`@azure/msal-node`,
// docs/18 §1); this header stub MUST NOT ship to production. Gate this at the
// deploy pipeline until SSO middleware replaces it.

import type { IncomingMessage } from 'node:http';
import { z } from 'zod';
import { PrismaClient } from '@cmc/db';
import { ROLES, type AuthSubject } from '@cmc/auth';
import type { Context, LmsSubject } from './trpc.js';

const devUserHeaderSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1),
  facilityId: z.string().min(1),
});

const devLmsUserHeaderSchema = z.object({
  parentAccountId: z.string().min(1),
  studentId: z.string().min(1).optional(),
});

// Lazily constructed so importing/creating a context never opens a DB
// connection unless a caller actually reads `ctx.db` (keeps the health smoke
// test and any DB-less unit test independent of DATABASE_URL/Postgres).
let dbSingleton: PrismaClient | undefined;

function getDb(): PrismaClient {
  dbSingleton ??= new PrismaClient();
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
  const devUser = parseDevUser(readHeader(opts.req?.headers, 'x-dev-user'));
  const lmsUser = parseDevLmsUser(readHeader(opts.req?.headers, 'x-dev-lms-user'));

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

// Seeds a real AppUser with an email/password so UI specs can drive the
// staff login form (every other admin e2e mints a cookie and bypasses the form).
// Goes through the real user.create / staff-login / changeOwnPassword surface
// so bcrypt hashing and mustChangePassword contract stay honest.

import { randomBytes, randomUUID } from 'node:crypto';
import type { Role } from '@cmc/auth';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';
import { createE2eStaffClient, createSignedStaffClient } from './trpc-client.js';

export interface SeededStaffCredentials {
  email: string;
  password: string;
  /** AppUser.userId (string identity used in the staff cookie claims). */
  userId: string;
  /** AppUser.id (UUID primary key). */
  appUserId: string;
  roles: Role[];
  facilityId: string;
}

export interface SeedStaffOptions {
  /** Defaults to process.env.E2E_BASE_URL. */
  baseUrl?: string;
  /** Defaults to process.env.E2E_FACILITY_ID. */
  facilityId?: string;
  roles?: Role[];
  email?: string;
  fullName?: string;
  /** When true, leave mustChangePassword=true (skip rotation). */
  mustChangePassword?: boolean;
}

function requireEnv(name: string, fallback?: string): string {
  const value = fallback ?? process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for seedStaffWithPassword — e2e globalSetup must have run first.`,
    );
  }
  return value;
}

/** Password that satisfies the API's min-length rule (≥8). */
function newPassword(): string {
  return `Cmc${randomBytes(9).toString('base64url')}!`;
}

function parseStaffCookie(setCookie: string | null): string {
  if (!setCookie) {
    throw new Error('staff-login returned no Set-Cookie header.');
  }
  // set-cookie may be a single header with attributes: name=value; Path=/; …
  const match = setCookie.match(new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) {
    throw new Error(`staff-login Set-Cookie missing ${STAFF_COOKIE_NAME}.`);
  }
  return match[1];
}

async function staffLogin(
  baseUrl: string,
  email: string,
  password: string,
): Promise<{ cookie: string; mustChangePassword: boolean }> {
  const res = await fetch(`${baseUrl}/auth/staff-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    mustChangePassword?: boolean;
  };
  if (!res.ok || !body.ok) {
    throw new Error(`staff-login failed for ${email}: ${res.status} ${body.error ?? ''}`);
  }
  // node-fetch / undici: getSetCookie() when available, else get('set-cookie').
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  const raw =
    setCookies.find((c) => c.startsWith(`${STAFF_COOKIE_NAME}=`)) ??
    res.headers.get('set-cookie');
  return {
    cookie: parseStaffCookie(raw),
    mustChangePassword: Boolean(body.mustChangePassword),
  };
}

/**
 * Provision a staff user with a usable password.
 * - Default: rotates through changeOwnPassword so mustChangePassword is false.
 * - `mustChangePassword: true`: stops after temp password is set (flag remains).
 */
export async function seedStaffWithPassword(
  opts: SeedStaffOptions = {},
): Promise<SeededStaffCredentials> {
  const baseUrl = requireEnv('E2E_BASE_URL', opts.baseUrl);
  const facilityId = requireEnv('E2E_FACILITY_ID', opts.facilityId);
  const roles = opts.roles ?? (['sale'] as Role[]);
  const runId = randomUUID().slice(0, 8);
  const email = opts.email ?? `e2e-deeplink-${runId}@cmc.test`;
  const userId = email;
  const fullName = opts.fullName ?? `E2E Deeplink ${runId}`;
  const tempPassword = newPassword();

  // super_admin creates the row in the run's ephemeral facility.
  const admin = createE2eStaffClient(baseUrl, {
    userId: `e2e-seed-admin-${runId}`,
    roles: ['super_admin'],
    facilityId,
  });

  const created = await admin.user.create.mutate({
    userId,
    email,
    fullName,
    position: 'E2E seed',
    roles,
    tempPassword,
  });

  if (opts.mustChangePassword) {
    return {
      email,
      password: tempPassword,
      userId,
      appUserId: created.id,
      roles,
      facilityId,
    };
  }

  // Rotate so the form-login happy path is not blocked by change-password.
  const session = await staffLogin(baseUrl, email, tempPassword);
  if (!session.mustChangePassword) {
    // Unexpected but usable — return the temp password as-is.
    return {
      email,
      password: tempPassword,
      userId,
      appUserId: created.id,
      roles,
      facilityId,
    };
  }

  const finalPassword = newPassword();
  const client = createSignedStaffClient(baseUrl, session.cookie);
  await client.user.changeOwnPassword.mutate({
    currentPassword: tempPassword,
    newPassword: finalPassword,
  });

  return {
    email,
    password: finalPassword,
    userId,
    appUserId: created.id,
    roles,
    facilityId,
  };
}

/** Convenience: seed with mustChangePassword still true (temp password only). */
export async function seedStaffMustChangePassword(
  opts: Omit<SeedStaffOptions, 'mustChangePassword'> = {},
): Promise<SeededStaffCredentials> {
  return seedStaffWithPassword({ ...opts, mustChangePassword: true });
}

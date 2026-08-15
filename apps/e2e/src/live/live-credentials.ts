// live-credentials — gitignored runtime file apps/e2e/.live-credentials.json.
//
// Holds the CURRENT (post-rotation) passwords + reusable session cookies for
// the super admin and every staff role the live campaign creates. Reruns read
// this file instead of re-driving the forced password change, and reuse the
// 8h staff session cookie instead of a fresh login (nginx staff-login is
// rate-limited 5r/m — infra/nginx/api-locations.conf).
//
// File shape (never commit; see apps/e2e/.gitignore):
//   {
//     "version": 1,
//     "updatedAt": "<iso>",
//     "superAdmin": { "email", "password", "changedAt", "session": Session },
//     "staff": {
//       "sale": { "email", "password", "userId", "changedAt", "session": Session },
//       ...
//     }
//   }
//
// Session = { name, value, domain, path, expires (unix s) } — the
// cmc_staff_session cookie as returned by context.cookies(), ready to feed
// context.addCookies on a rerun.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

import { E2E_DIR, bootstrapSuperAdmin } from './live-env.js';

export interface PersistedSession {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
}

export interface PersistedStaffAccount {
  email: string;
  /** CURRENT working password (rotated when the account's first login forced
   *  /change-password; initially the temp password the setup spec assigned). */
  password: string;
  userId: string;
  changedAt: string;
  session?: PersistedSession;
}

export interface CredentialsFile {
  version: 1;
  updatedAt: string;
  superAdmin: PersistedStaffAccount;
  staff: Record<string, PersistedStaffAccount>;
}

const CREDENTIALS_PATH = new URL('../../.live-credentials.json', import.meta.url);

function emptyFile(): CredentialsFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    superAdmin: { email: '', password: '', userId: '', changedAt: '' },
    staff: {},
  };
}

let cache: CredentialsFile | null = null;

export function readCredentialsFile(): CredentialsFile {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8')) as Partial<CredentialsFile>;
    cache = {
      ...emptyFile(),
      ...parsed,
      superAdmin: { ...emptyFile().superAdmin, ...(parsed.superAdmin ?? {}) },
      staff: parsed.staff ?? {},
    };
  } catch {
    cache = emptyFile();
  }
  return cache!;
}

export function writeCredentialsFile(next: CredentialsFile): void {
  next.updatedAt = new Date().toISOString();
  cache = next;
  mkdirSync(E2E_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(next, null, 2), 'utf8');
}

export function updateCredentialsFile(mutate: (file: CredentialsFile) => void): void {
  const file = readCredentialsFile();
  mutate(file);
  writeCredentialsFile(file);
}

/** The super-admin identity to attempt: the SAVED (rotated) credential wins
 *  once a previous campaign rotated it; otherwise the .env.prod bootstrap.
 *  The task contract says "first login does the change-password once;
 *  subsequent runs use the saved password" — saved-first implements exactly
 *  that for reruns. */
export function liveSuperAdminCredentials(): { email: string; password: string; source: 'saved' | 'env' } {
  const saved = readCredentialsFile().superAdmin;
  if (saved?.email && saved?.password && saved?.changedAt) {
    return { email: saved.email, password: saved.password, source: 'saved' };
  }
  const bootstrap = bootstrapSuperAdmin();
  return { email: bootstrap.email, password: bootstrap.password, source: 'env' };
}

/** Effective credential for a staff role: the saved (current) password, or
 *  the temp password the setup spec assigned if rotation has not happened yet. */
export function staffCredentials(role: string): PersistedStaffAccount | null {
  return readCredentialsFile().staff[role] ?? null;
}

// live-env — tiny, dependency-free loader for the repo-root .env.prod file.
//
// @cmc/e2e does not declare dotenv (pnpm strict node_modules would refuse a
// transitive import), so this file parses the KEY=VALUE format itself —
// enough for the flat, quoted values .env.prod actually uses. It is the only
// place the live suite reads process-environment secrets from disk.
//
// SECURITY: never print or log any value loaded here. Helpers in this
// directory only ever surface emails for display; passwords stay in the
// gitignored .live-credentials.json or in memory.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
// apps/e2e — where the gitignored runtime state files live.
export const E2E_DIR = fileURLToPath(new URL('../../..', import.meta.url));

// live-env.ts sits at apps/e2e/src/live/ → 4 levels up is the repo root.
const ENV_PROD_PATH = new URL('../../../../.env.prod', import.meta.url);

export interface ProdEnv {
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;
  SUPER_ADMIN_FACILITY: string;
  SUPER_ADMIN_USER_ID: string;
  STAFF_SESSION_SECRET: string;
  LMS_SESSION_SECRET: string;
  [key: string]: string | undefined;
}

let cached: ProdEnv | null = null;

/** Parses .env.prod (repo root). Returns {} when the file is missing — the
 *  live suite can still run with credentials persisted in
 *  .live-credentials.json from an earlier campaign. */
export function loadProdEnv(): ProdEnv {
  if (cached) return cached;
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(ENV_PROD_PATH, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // Strip one level of surrounding quotes (single or double).
      if (value.length >= 2) {
        const first = value[0]!;
        const last = value[value.length - 1]!;
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          value = value.slice(1, -1);
        }
      }
      out[key] = value;
    }
  } catch {
    // Missing/unreadable .env.prod: fall back to empty (saved credentials may
    // still exist). Never throw here — reruns must not depend on the file.
  }
  cached = out as ProdEnv;
  return cached!;
}

/** The bootstrap super-admin identity straight from .env.prod. */
export function bootstrapSuperAdmin(): { email: string; password: string } {
  const env = loadProdEnv();
  const email = env.SUPER_ADMIN_EMAIL ?? '';
  const password = env.SUPER_ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error(
      'live-env: .env.prod is missing SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD — the bootstrap ' +
        'super-admin credentials are required for the very first live campaign login.',
    );
  }
  return { email, password };
}

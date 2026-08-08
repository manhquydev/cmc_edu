// Prisma 7 CLI configuration (migrate/generate/studio) — replaces the
// `datasource db { url = env("DATABASE_URL") }` line schema.prisma carried
// under Prisma 6. This file is CLI-only: it tells `prisma migrate`/`generate`
// which connection string to use for schema operations. It has NO effect on
// the application runtime — `createPrismaClient()` (src/index.ts) builds its
// own `PrismaPg` adapter from `APP_DATABASE_URL ?? DATABASE_URL` independently,
// per ADR 0042 (RLS defense-in-depth).
//
// Deliberately uses `DATABASE_URL` ONLY (the migration/schema-owner role),
// mirroring exactly what the old `datasource.url` did — never
// `APP_DATABASE_URL`. Migrations run DDL (CREATE/ALTER TABLE, RLS POLICY
// changes); the unprivileged `cmc_app` role has neither DDL grants nor
// BYPASSRLS, so pointing this at the app role would break `prisma migrate`.
//
// Prisma 7.9.1 config shape has no `experimental.adapter`/`engine` fields —
// verified against the installed `@prisma/config` type declarations and the
// Effect schema validator (`onExcessProperty: "error"`) that backs
// `defineConfig`, which throws on any property outside `PrismaConfigShape`.
// Older "authoritative recipe" text describing those fields refers to a
// pre-release/removed shape; this file matches the package actually
// installed (`pnpm why @prisma/config` -> 7.9.1).
//
// Prisma 7 also stopped auto-loading `.env` files for the CLI ("environment
// variables are not loaded by default" — Prisma 7 upgrade guide), so this
// file loads `prisma/.env` itself (the existing, gitignored local dev file —
// same one CI's `ui-e2e` workflow writes before schema validation).
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, env } from '@prisma/config';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(packageRoot, 'prisma', '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

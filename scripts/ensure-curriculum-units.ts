#!/usr/bin/env tsx
// Ensures the global CurriculumUnit catalog has the minimal UCREA set used by
// exercise.create / classSession.assignUnit (same rows as packages/db/prisma/seed.mjs).
//
// local-sim demo (seed-local-sim-demo.ts) never ran prisma seed — leaving
// CurriculumUnit empty and blocking the entire grading path. Call this from
// host against the published Postgres port, or run after migrate on any env.
//
// Safety:
//   - Idempotent: no-op when any CurriculumUnit row exists.
//   - Requires LOCAL_SIM_SEED_ALLOW=1 OR SYNTH_SEED_ALLOW=1 OR ENSURE_CURRICULUM_ALLOW=1
//     so a stray run against an unexpected DB is fail-closed.
//
// Usage:
//   LOCAL_SIM_SEED_ALLOW=1 DATABASE_URL=postgresql://postgres:…@127.0.0.1:5432/cmc_prod \
//     npx tsx scripts/ensure-curriculum-units.ts

import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string {
  const raw =
    process.env['LOCAL_SIM_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    process.env['APP_DATABASE_URL'] ??
    '';
  if (!raw) {
    throw new Error(
      'DATABASE_URL / APP_DATABASE_URL / LOCAL_SIM_DATABASE_URL required (host-reachable URL).',
    );
  }
  // Compose service hostname only resolves inside the Docker network.
  return raw.replace('@postgres:', '@127.0.0.1:').replace('@postgres/', '@127.0.0.1/');
}

function allowGate(): void {
  if (
    process.env['LOCAL_SIM_SEED_ALLOW'] === '1' ||
    process.env['SYNTH_SEED_ALLOW'] === '1' ||
    process.env['ENSURE_CURRICULUM_ALLOW'] === '1'
  ) {
    return;
  }
  throw new Error(
    'Set LOCAL_SIM_SEED_ALLOW=1 (or SYNTH_SEED_ALLOW / ENSURE_CURRICULUM_ALLOW) to confirm intentional seed.',
  );
}

async function main(): Promise<void> {
  allowGate();
  const url = resolveDatabaseUrl();
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const existingCount = await db.curriculumUnit.count();
    if (existingCount > 0) {
      console.log(`CurriculumUnit already present (${existingCount} rows) — skip.`);
      return;
    }
    const result = await db.curriculumUnit.createMany({
      data: [
        { program: 'UCREA', level: 1, monthIndex: 1, unitType: 'LESSON', title: 'Bài 1: Làm quen' },
        { program: 'UCREA', level: 1, monthIndex: 1, unitType: 'REVIEW', title: 'Ôn tập tháng 1' },
      ],
    });
    console.log(`Seeded ${result.count} CurriculumUnit rows.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});

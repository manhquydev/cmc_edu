#!/usr/bin/env tsx
// Ensures the global CurriculumUnit catalog matches the framework CSV
// (packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv → 96 units).
//
// local-sim demo (seed-local-sim-demo.ts) never ran prisma seed — leaving
// CurriculumUnit empty and blocking the entire grading path. Call this from
// host against the published Postgres port, or run after migrate on any env.
//
// Safety:
//   - Idempotent upsert on (program, orderGlobal).
//   - Requires LOCAL_SIM_SEED_ALLOW=1 OR SYNTH_SEED_ALLOW=1 OR ENSURE_CURRICULUM_ALLOW=1
//     so a stray run against an unexpected DB is fail-closed.
//
// Usage:
//   LOCAL_SIM_SEED_ALLOW=1 DATABASE_URL=postgresql://postgres:…@127.0.0.1:5432/cmc_prod \
//     npx tsx scripts/ensure-curriculum-units.ts

import { createPrismaClientWithUrl } from '@cmc/db';
import { importCurriculumUnits } from '../packages/db/prisma/import-curriculum-units.mjs';

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
  const db = createPrismaClientWithUrl(url);
  try {
    const result = await importCurriculumUnits(db);
    console.log(
      `CurriculumUnit ensure: created=${result.created} updated=${result.updated} ` +
        `total=${result.total} (UCREA=${result.counts.UCREA} BRIGHT_IG=${result.counts.BRIGHT_IG} BLACK_HOLE=${result.counts.BLACK_HOLE}).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});

// Dev-only seed — K7 remediation (deep-review consolidated report). The API
// now rejects any staff request whose resolved `facilityId` does not match a
// real `Facility` row (`requireValidFacility`, apps/api/src/trpc.ts), so dev
// and manual smoke-testing need at least one real `Facility` to reference
// before any staff session can authenticate. Idempotent (find-or-create by
// name) — safe to re-run.
//
// Plain ESM `.mjs` (no build step, no `tsx` dependency): `@prisma/client` is
// already a runtime dependency of this package, so this runs directly under
// Node via `node prisma/seed.mjs`.

import { PrismaClient } from '@prisma/client';

const DEV_SEED_FACILITY_NAME = 'CMC EDU — Cơ sở mặc định (dev seed)';

async function main() {
  const db = new PrismaClient();
  try {
    const existing = await db.facility.findFirst({ where: { name: DEV_SEED_FACILITY_NAME } });
    if (existing) {
      console.log(`Seed facility already exists: ${existing.id}`);
    } else {
      const created = await db.facility.create({ data: { name: DEV_SEED_FACILITY_NAME } });
      console.log(`Seeded facility: ${created.id}`);
    }

    await seedCurriculumUnits(db);
  } finally {
    await db.$disconnect();
  }
}

// T2-I (docs/19 §1, QĐ 0021): a minimal UCREA unit set so
// `classSession.assignUnit`/`exercise.create` have something real to
// reference in dev/manual smoke-testing. CurriculumUnit is a GLOBAL catalog
// (no facilityId) — idempotent by "does any row already exist" (unlike the
// facility seed above, there is no natural unique field to find-or-create by).
async function seedCurriculumUnits(db) {
  const existingCount = await db.curriculumUnit.count();
  if (existingCount > 0) {
    console.log(`CurriculumUnit already seeded (${existingCount} rows).`);
    return;
  }

  const units = await db.curriculumUnit.createMany({
    data: [
      { program: 'UCREA', level: 1, monthIndex: 1, unitType: 'LESSON', title: 'Bài 1: Làm quen' },
      { program: 'UCREA', level: 1, monthIndex: 1, unitType: 'REVIEW', title: 'Ôn tập tháng 1' },
    ],
  });
  console.log(`Seeded ${units.count} CurriculumUnit rows.`);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

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
//
// Prisma 7 removed `datasource.url` from schema.prisma / the `new
// PrismaClient()` implicit-connection default — a driver adapter is required.
// Builds its own adapter inline (rather than importing the compiled
// `@cmc/db` factory from `../dist/index.js`) so this script keeps working
// with no prior `pnpm build` step, exactly like it always has.

import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DEV_SEED_FACILITY_NAME,
  DEV_SEED_FACILITY_CODE,
  SYNTHETIC_SEED_FACILITY_NAME,
  SYNTHETIC_SEED_FACILITY_CODE,
} from './seed-constants.mjs';
import { importCurriculumUnits } from './import-curriculum-units.mjs';

// Idempotent find-or-create by name. `code` (system-wide unique, NOT NULL, no
// DB default since migration 20260706170000) MUST be supplied on a direct
// Prisma create — the earlier version omitted it and threw "Argument `code` is
// missing", so this seed had been broken since that migration landed.
async function upsertFacility(db, name, code) {
  const existing = await db.facility.findFirst({ where: { name } });
  if (existing) {
    console.log(`Facility already exists: ${existing.id} (${name})`);
    return existing.id;
  }
  const created = await db.facility.create({ data: { name, code } });
  console.log(`Seeded facility: ${created.id} (${name})`);
  return created.id;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('packages/db/prisma/seed.mjs: DATABASE_URL is not set.');
  }
  const adapter = new PrismaPg({ connectionString });
  const db = new PrismaClient({ adapter });
  try {
    const facilityId = await upsertFacility(db, DEV_SEED_FACILITY_NAME, DEV_SEED_FACILITY_CODE);

    // Sentinel facility: content-based proof this DB was built by our seed
    // tooling (never prod). The synthetic-seed env verifier queries its code.
    await upsertFacility(db, SYNTHETIC_SEED_FACILITY_NAME, SYNTHETIC_SEED_FACILITY_CODE);

    await seedCurriculumUnits(db);
    await seedShiftCatalog(db, facilityId);
  } finally {
    await db.$disconnect();
  }
}

// Full framework catalog from prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv
// (96 units after grouping multi-topic rows). GLOBAL, no facilityId (QĐ 0021).
// Idempotent upsert on (program, orderGlobal) — see import-curriculum-units.mjs.
async function seedCurriculumUnits(db) {
  const result = await importCurriculumUnits(db);
  console.log(
    `CurriculumUnit seed: created=${result.created} updated=${result.updated} ` +
      `total=${result.total} (UCREA=${result.counts.UCREA} BRIGHT_IG=${result.counts.BRIGHT_IG} BLACK_HOLE=${result.counts.BLACK_HOLE}).`,
  );
}

// HR remediation phase 1 (plans/260711-1752-hr-kpi-shift-attendance-remediation
// §10): fixed catalog ca — Kinh doanh (SINGLE, 1 ca/ngày) + Giáo viên
// (MULTIPLE, tối đa 3 ca/ngày). Idempotent via the (facilityId, name) /
// (shiftGroupId, name) unique keys added in migration
// 20260712000000_hr_remediation_policy_quota_reject_done — an
// already-existing group/template on this facility is left untouched
// (`update: {}`), so re-running the seed never clobbers manual edits.
async function seedShiftCatalog(db, facilityId) {
  const catalog = [
    {
      name: 'Kinh doanh',
      type: 'KINH_DOANH',
      selectionMode: 'SINGLE',
      templates: [
        { name: 'Ca 1', startTime: '08:30', endTime: '18:00' },
        { name: 'Ca 2', startTime: '10:00', endTime: '20:00' },
        { name: 'Ca 3', startTime: '13:00', endTime: '21:00' },
      ],
    },
    {
      name: 'Giáo viên',
      type: 'GIAO_VIEN',
      selectionMode: 'MULTIPLE',
      templates: [
        { name: 'Ca 1', startTime: '08:00', endTime: '12:00' },
        { name: 'Ca 2', startTime: '13:00', endTime: '17:00' },
        { name: 'Ca 3', startTime: '17:00', endTime: '21:00' },
      ],
    },
  ];

  for (const group of catalog) {
    const shiftGroup = await db.shiftGroup.upsert({
      where: { facilityId_name: { facilityId, name: group.name } },
      create: { facilityId, name: group.name, type: group.type, selectionMode: group.selectionMode },
      update: {},
    });
    for (const template of group.templates) {
      await db.shiftTemplate.upsert({
        where: { shiftGroupId_name: { shiftGroupId: shiftGroup.id, name: template.name } },
        create: {
          facilityId,
          shiftGroupId: shiftGroup.id,
          name: template.name,
          startTime: template.startTime,
          endTime: template.endTime,
        },
        update: {},
      });
    }
  }
  console.log(`Seeded shift catalog (Kinh doanh + Giáo viên) for facility: ${facilityId}`);
}

// Entrypoint guard: run the seed ONLY when this file is executed directly
// (`node prisma/seed.mjs`), NEVER when imported for a constant/helper. Without
// this, `import ... from 'seed.mjs'` would run a full seed against whatever
// DATABASE_URL is set as a side effect of the import. Compare `.href` strings
// (import.meta.url is a string; pathToFileURL(...) returns a URL — comparing to
// the object would always be false and silently skip the seed). Guard against
// `process.argv[1]` being undefined (e.g. `node -e`/`--eval`, where there is no
// entry script) so importing this module can never throw.
const entryScript = process.argv[1];
if (entryScript && import.meta.url === pathToFileURL(entryScript).href) {
  main().catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  });
}

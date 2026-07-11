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
    let facilityId;
    if (existing) {
      console.log(`Seed facility already exists: ${existing.id}`);
      facilityId = existing.id;
    } else {
      const created = await db.facility.create({ data: { name: DEV_SEED_FACILITY_NAME } });
      console.log(`Seeded facility: ${created.id}`);
      facilityId = created.id;
    }

    await seedCurriculumUnits(db);
    await seedShiftCatalog(db, facilityId);
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

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

#!/usr/bin/env tsx
// Ensures each facility has the canonical shift catalog (docs/20 §2, ADR 0040,
// packages/db/prisma/seed.mjs seedShiftCatalog):
//
//   Kinh doanh (KINH_DOANH) · SINGLE · Ca 1/2/3 (ca dài 1 ngày)
//   Giáo viên  (GIAO_VIEN)  · MULTIPLE · Ca 1/2/3 (sáng / chiều / tối)
//
// local-sim demo often creates ad-hoc groups with inverted selectionMode and
// only 2 templates — UI then looks "missing ca" and wrong mode for sale/GV.
//
// This script:
//   1) Upserts the two named groups with correct type + selectionMode
//   2) Upserts Ca 1/2/3 templates with canonical windows
//   3) Repairs ANY existing group of each type: force selectionMode to match
//      type (KD→SINGLE, GV→MULTIPLE) so demo-named groups stay usable
//
// Safety: LOCAL_SIM_SEED_ALLOW=1 | SYNTH_SEED_ALLOW=1 | ENSURE_SHIFT_ALLOW=1
//
// Usage:
//   LOCAL_SIM_SEED_ALLOW=1 DATABASE_URL=postgresql://postgres:…@127.0.0.1:5432/cmc_prod \
//     npx tsx scripts/ensure-shift-catalog.ts

import { createPrismaClientWithUrl } from '@cmc/db';

const CATALOG = [
  {
    name: 'Kinh doanh',
    type: 'KINH_DOANH' as const,
    selectionMode: 'SINGLE' as const,
    templates: [
      { name: 'Ca 1', startTime: '08:30', endTime: '18:00' },
      { name: 'Ca 2', startTime: '10:00', endTime: '20:00' },
      { name: 'Ca 3', startTime: '13:00', endTime: '21:00' },
    ],
  },
  {
    name: 'Giáo viên',
    type: 'GIAO_VIEN' as const,
    selectionMode: 'MULTIPLE' as const,
    templates: [
      { name: 'Ca 1', startTime: '08:00', endTime: '12:00' },
      { name: 'Ca 2', startTime: '13:00', endTime: '17:00' },
      { name: 'Ca 3', startTime: '17:00', endTime: '21:00' },
    ],
  },
] as const;

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
  return raw.replace('@postgres:', '@127.0.0.1:').replace('@postgres/', '@127.0.0.1/');
}

function allowGate(): void {
  if (
    process.env['LOCAL_SIM_SEED_ALLOW'] === '1' ||
    process.env['SYNTH_SEED_ALLOW'] === '1' ||
    process.env['ENSURE_SHIFT_ALLOW'] === '1'
  ) {
    return;
  }
  throw new Error(
    'Set LOCAL_SIM_SEED_ALLOW=1 (or SYNTH_SEED_ALLOW / ENSURE_SHIFT_ALLOW) to confirm intentional seed.',
  );
}

async function main(): Promise<void> {
  allowGate();
  const url = resolveDatabaseUrl();
  const db = createPrismaClientWithUrl(url);
  try {
    const facilities = await db.facility.findMany({ select: { id: true, name: true } });
    if (facilities.length === 0) {
      console.log('No facilities — nothing to ensure.');
      return;
    }

    for (const facility of facilities) {
      const facilityId = facility.id;
      let groupsTouched = 0;
      let templatesTouched = 0;

      for (const group of CATALOG) {
        const shiftGroup = await db.shiftGroup.upsert({
          where: { facilityId_name: { facilityId, name: group.name } },
          create: {
            facilityId,
            name: group.name,
            type: group.type,
            selectionMode: group.selectionMode,
          },
          update: {
            type: group.type,
            selectionMode: group.selectionMode,
          },
        });
        groupsTouched += 1;

        for (const template of group.templates) {
          await db.shiftTemplate.upsert({
            where: {
              shiftGroupId_name: { shiftGroupId: shiftGroup.id, name: template.name },
            },
            create: {
              facilityId,
              shiftGroupId: shiftGroup.id,
              name: template.name,
              startTime: template.startTime,
              endTime: template.endTime,
            },
            update: {
              startTime: template.startTime,
              endTime: template.endTime,
            },
          });
          templatesTouched += 1;
        }
      }

      // Repair inverted selectionMode on any other groups of the same type
      // (e.g. "Ca kinh doanh trải nghiệm" created by hand / old demo).
      const modeFixKd = await db.shiftGroup.updateMany({
        where: { facilityId, type: 'KINH_DOANH', NOT: { selectionMode: 'SINGLE' } },
        data: { selectionMode: 'SINGLE' },
      });
      const modeFixGv = await db.shiftGroup.updateMany({
        where: { facilityId, type: 'GIAO_VIEN', NOT: { selectionMode: 'MULTIPLE' } },
        data: { selectionMode: 'MULTIPLE' },
      });

      // Ensure Ca 1/2/3 exist on every group of each type (not only named canonical)
      const typeTemplates = {
        KINH_DOANH: CATALOG[0].templates,
        GIAO_VIEN: CATALOG[1].templates,
      } as const;
      const canonicalNames = new Set(['Ca 1', 'Ca 2', 'Ca 3']);
      let pruned = 0;

      for (const type of ['KINH_DOANH', 'GIAO_VIEN'] as const) {
        const groups = await db.shiftGroup.findMany({
          where: { facilityId, type },
          select: { id: true, name: true },
        });
        for (const g of groups) {
          for (const template of typeTemplates[type]) {
            await db.shiftTemplate.upsert({
              where: {
                shiftGroupId_name: { shiftGroupId: g.id, name: template.name },
              },
              create: {
                facilityId,
                shiftGroupId: g.id,
                name: template.name,
                startTime: template.startTime,
                endTime: template.endTime,
              },
              update: {
                startTime: template.startTime,
                endTime: template.endTime,
              },
            });
            templatesTouched += 1;
          }

          // Once Ca 1/2/3 exist, drop demo leftovers ("Tư vấn sáng", "Ca chiều"…)
          // so the Work Schedule matrix shows exactly 3 ca columns.
          const present = await db.shiftTemplate.findMany({
            where: { shiftGroupId: g.id },
            select: { id: true, name: true },
          });
          const names = new Set(present.map((t) => t.name));
          if (canonicalNames.size === 3 && [...canonicalNames].every((n) => names.has(n))) {
            const extras = present.filter((t) => !canonicalNames.has(t.name));
            if (extras.length > 0) {
              // Only delete templates not referenced by registration entries
              for (const extra of extras) {
                const used = await db.shiftRegistrationEntry.count({
                  where: { shiftTemplateId: extra.id },
                });
                if (used === 0) {
                  await db.shiftTemplate.delete({ where: { id: extra.id } });
                  pruned += 1;
                }
              }
            }
          }
        }
      }

      console.log(
        `facility ${facility.name ?? facilityId}: groups+${groupsTouched}, ` +
          `templates upserted≈${templatesTouched}, ` +
          `modeFix KD=${modeFixKd.count} GV=${modeFixGv.count}, pruned=${pruned}`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

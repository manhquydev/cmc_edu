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
      return;
    }
    const created = await db.facility.create({ data: { name: DEV_SEED_FACILITY_NAME } });
    console.log(`Seeded facility: ${created.id}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

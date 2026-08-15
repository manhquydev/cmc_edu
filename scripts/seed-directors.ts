#!/usr/bin/env tsx
// Idempotent bootstrap of the two director accounts for first-time UAT:
//   - giam_doc_kinh_doanh (Giám đốc kinh doanh)  -> gdkd@cmcvn.edu.vn
//   - giam_doc_dao_tao  (Giám đốc đào tạo)       -> gddt@cmcvn.edu.vn
// Temp passwords are applied ONLY when the row has no password yet (same rule
// as seed-super-admin): a rotated director password is never silently reverted.
//
// Required env: DATABASE_URL (owner role) + the DIRECTOR_*_PASSWORD / emails
// below default to the repo convention; facility resolved by code "CMCDEVEL".

import { createPrivilegedPrismaClient, Role } from '@cmc/db';
import { createHash } from 'node:crypto';
import { hashPassword } from '../apps/api/src/lms-auth/password-hash.js';

function deterministicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 36).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

const DIRECTORS = [
  {
    email: process.env['GDKD_EMAIL'] ?? 'gdkd@cmcvn.edu.vn',
    password: process.env['GDKD_PASSWORD'],
    fullName: process.env['GDKD_FULLNAME'] ?? 'Giám đốc kinh doanh',
    position: process.env['GDKD_POSITION'] ?? 'Giám đốc kinh doanh',
    employeeCode: 'GDKD-001',
    role: Role.giam_doc_kinh_doanh,
    userIdSeed: 'director:gdkd@cmcvn.edu.vn',
  },
  {
    email: process.env['GDDT_EMAIL'] ?? 'gddt@cmcvn.edu.vn',
    password: process.env['GDDT_PASSWORD'],
    fullName: process.env['GDDT_FULLNAME'] ?? 'Giám đốc đào tạo',
    position: process.env['GDDT_POSITION'] ?? 'Giám đốc đào tạo',
    employeeCode: 'GDDT-001',
    role: Role.giam_doc_dao_tao,
    userIdSeed: 'director:gddt@cmcvn.edu.vn',
  },
];

async function main() {
  const db = createPrivilegedPrismaClient();
  try {
    const facility = await db.facility.findFirst({ where: { code: 'CMCDEVEL' } });
    if (!facility) throw new Error('Facility CMCDEVEL not found — run seed-super-admin first.');

    for (const d of DIRECTORS) {
      const userId = deterministicId(d.userIdSeed);
      const passwordFields = d.password
        ? { passwordHash: hashPassword(d.password), mustChangePassword: true }
        : {};
      const existing = await db.appUser.findFirst({ where: { email: d.email } });
      const user = existing
        ? await db.appUser.update({
            where: { id: existing.id },
            data: {
              fullName: d.fullName,
              position: d.position,
              roles: [d.role],
              isActive: true,
              ...(existing.passwordHash === null && d.password ? passwordFields : {}),
            },
          })
        : await db.appUser.create({
            data: {
              userId,
              facilityId: facility.id,
              email: d.email,
              fullName: d.fullName,
              position: d.position,
              employeeCode: d.employeeCode,
              roles: [d.role],
              isActive: true,
              ...passwordFields,
            },
          });
      const needsFirstLogin = user.mustChangePassword;
      console.log(`[seed-directors] ${d.role}: ${user.email} | employeeCode=${user.employeeCode} | active=${user.isActive} | mustChangePassword=${needsFirstLogin}`);
    }
    console.log('[seed-directors] OK — 2 director accounts ready');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-directors] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

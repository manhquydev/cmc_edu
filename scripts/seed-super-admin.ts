#!/usr/bin/env tsx
// Bootstrap idempotent super_admin AppUser for pilot deployment.
//
// Run once per environment before Phase 3 UAT:
//   tsx scripts/seed-super-admin.ts
//
// Required env vars:
//   DATABASE_URL        — migration/owner role (bypasses RLS for seeding)
//   SUPER_ADMIN_EMAIL   — login email (Entra UPN when SSO is enabled, or the
//                         email/password identifier while M365 is unavailable)
//   SUPER_ADMIN_FACILITY — Facility name to upsert (e.g. "CMC Hà Nội")
//
// Optional:
//   SUPER_ADMIN_EMPLOYEE_CODE — defaults to "SA-001"
//   SUPER_ADMIN_USER_ID       — stable UUID; defaults to deterministic value
//   SUPER_ADMIN_PASSWORD      — bootstrap password for email/password login;
//                               sets mustChangePassword so the first real
//                               login forces a rotation. Omit for SSO-only.

import { PrismaClient, Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import { hashPassword } from '../apps/api/src/lms-auth/password-hash.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function deterministicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 36).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

async function main(): Promise<void> {
  const email = requireEnv('SUPER_ADMIN_EMAIL').toLowerCase();
  const facilityName = requireEnv('SUPER_ADMIN_FACILITY');
  const employeeCode = process.env['SUPER_ADMIN_EMPLOYEE_CODE'] ?? 'SA-001';
  const userId = process.env['SUPER_ADMIN_USER_ID'] ?? deterministicId(`super_admin:${email}`);

  const db = new PrismaClient({ datasources: { db: { url: process.env['DATABASE_URL'] } } });

  try {
    // Upsert facility by name (idempotent).
    const facilityCode = facilityName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    const facility = await db.facility.upsert({
      where: { code: facilityCode },
      update: {},
      create: { name: facilityName, code: facilityCode },
    });

    // Bootstrap password (optional): first login forces a rotation.
    const password = process.env['SUPER_ADMIN_PASSWORD'];
    const passwordFields = password
      ? { passwordHash: hashPassword(password), mustChangePassword: true }
      : {};

    // Upsert super_admin AppUser by email.
    const appUser = await db.appUser.upsert({
      where: { employeeCode },
      update: {
        email,
        roles: [Role.super_admin],
        isActive: true,
        ...passwordFields,
      },
      create: {
        userId,
        facilityId: facility.id,
        email,
        fullName: 'Super Admin',
        employeeCode,
        roles: [Role.super_admin],
        isActive: true,
        ...passwordFields,
      },
    });

    console.log('[seed-super-admin] OK');
    console.log(`  facility: ${facility.name} (${facility.id})`);
    console.log(`  appUser:  ${appUser.email} | userId=${appUser.userId} | roles=${appUser.roles.join(',')}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-super-admin] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

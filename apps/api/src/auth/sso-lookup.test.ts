// Integration tests for the SSO AppUser email lookup (sso-routes.ts).
// SSO itself stays env-disabled; this is latent-bug insurance for re-enable:
// AppUser is RLS'd by facility, so a plain findFirst on the unprivileged
// client returns 0 rows. lookupSsoAppUser uses withFacility(..., {bypass:true})
// — same hatch as staff password login (password-routes.ts).

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lookupSsoAppUser } from './sso-routes.js';
import {
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDb,
} from '../test/db.js';

describe('lookupSsoAppUser — RLS bypass (ADR 0042)', () => {
  let facilityId: string;

  beforeEach(async () => {
    const facility = await createTestFacility('SSO Lookup Test');
    facilityId = facility.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('resolves a seeded AppUser; unprivileged findFirst without facility GUC returns 0 (the pre-fix bug)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = `sso-lookup-${suffix}`;
    const email = `sso-lookup-${suffix}@cmc.edu.vn`;
    const seeded = await seedAppUser({
      facilityId,
      userId,
      email,
      roles: ['sale'],
    });

    // Unprivileged client, no withFacility GUC — RLS fail-closed. This is
    // the query handleSsoCallback used before the bypass wrap.
    const unprivileged = await testDb().appUser.findFirst({ where: { email } });
    expect(unprivileged).toBeNull();

    const found = await lookupSsoAppUser(testDb(), email);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(seeded.id);
    expect(found?.userId).toBe(userId);
    expect(found?.email).toBe(email);
    expect(found?.isActive).toBe(true);
  });
});

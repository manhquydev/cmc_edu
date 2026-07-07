// Drift-assertion: Prisma enum Role must match @cmc/auth ROLES exactly.
// Fails immediately if either source drifts — prevents silent mismatch between
// the DB enum (schema.prisma) and the TS permission registry (packages/auth).
//
// We query the DB to get the live enum values rather than importing from
// @prisma/client directly (which is not re-exported by @cmc/db).

import { describe, expect, it } from 'vitest';
import { ROLES } from '@cmc/auth';
import { testDb } from '../test/db.js';

describe('Role enum drift-assertion (S1)', () => {
  it('Postgres Role enum values exactly match @cmc/auth ROLES', async () => {
    const db = testDb();
    const rows = await db.$queryRaw<{ enumlabel: string }[]>`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role'
      ORDER BY e.enumsortorder
    `;
    const dbValues = rows.map((r) => r.enumlabel).sort();
    const authValues = [...ROLES].sort();
    expect(dbValues).toEqual(authValues);
  });

  it('ROLES has exactly 9 entries (ADR-D — no silent additions)', () => {
    expect(ROLES).toHaveLength(9);
  });
});

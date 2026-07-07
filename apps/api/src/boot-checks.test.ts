// Unit tests for PD-2 RLS boot-checks (RT-7).
// All tests run offline — DB calls are mocked via inline stubs.

import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@cmc/db';
import { assertCmcAppRole, assertForceRlsOnAllRlsTables } from './boot-checks.js';

function makeDb(queryResult: unknown): PrismaClient {
  return {
    $queryRaw: async () => queryResult,
  } as unknown as PrismaClient;
}

describe('assertCmcAppRole (RT-7)', () => {
  it('passes when current_user is cmc_app', async () => {
    const db = makeDb([{ current_user: 'cmc_app' }]);
    await expect(assertCmcAppRole(db)).resolves.toBeUndefined();
  });

  it('rejects when connected as owner role (postgres)', async () => {
    const db = makeDb([{ current_user: 'postgres' }]);
    await expect(assertCmcAppRole(db)).rejects.toThrow(/expected 'cmc_app'/);
  });

  it('rejects when connected as migration role (cmc_owner)', async () => {
    const db = makeDb([{ current_user: 'cmc_owner' }]);
    await expect(assertCmcAppRole(db)).rejects.toThrow(/expected 'cmc_app'/);
  });

  it('rejects when query returns empty (no current_user)', async () => {
    const db = makeDb([]);
    await expect(assertCmcAppRole(db)).rejects.toThrow(/expected 'cmc_app'/);
  });
});

describe('assertForceRlsOnAllRlsTables (RT-7)', () => {
  it('passes when all RLS tables have FORCE ROW LEVEL SECURITY', async () => {
    const db = makeDb([
      { relname: 'Receipt', relforcerowsecurity: true },
      { relname: 'ClassSession', relforcerowsecurity: true },
    ]);
    await expect(assertForceRlsOnAllRlsTables(db)).resolves.toBeUndefined();
  });

  it('passes when no RLS tables exist (empty schema)', async () => {
    const db = makeDb([]);
    await expect(assertForceRlsOnAllRlsTables(db)).resolves.toBeUndefined();
  });

  it('rejects when any RLS table is missing FORCE RLS', async () => {
    const db = makeDb([
      { relname: 'Receipt', relforcerowsecurity: true },
      { relname: 'ClassSession', relforcerowsecurity: false },
    ]);
    await expect(assertForceRlsOnAllRlsTables(db)).rejects.toThrow(/ClassSession/);
    await expect(assertForceRlsOnAllRlsTables(db)).rejects.toThrow(
      /FORCE ROW LEVEL SECURITY missing/,
    );
  });

  it('names all missing tables in the error message', async () => {
    const db = makeDb([
      { relname: 'TableA', relforcerowsecurity: false },
      { relname: 'TableB', relforcerowsecurity: false },
    ]);
    await expect(assertForceRlsOnAllRlsTables(db)).rejects.toThrow(/TableA.*TableB|TableB.*TableA/);
  });
});

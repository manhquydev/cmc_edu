// Unit tests for PD-2 RLS boot-checks (RT-7).
// All tests run offline — DB calls are mocked via inline stubs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@cmc/db';
import {
  assertCmcAppRole,
  assertForceRlsOnAllRlsTables,
  assertRequiredEnvForProd,
} from './boot-checks.js';

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

describe('assertRequiredEnvForProd', () => {
  const KEYS = [
    'NODE_ENV', 'TEST_OTP_SEAM', 'APP_DATABASE_URL', 'DATABASE_URL', 'BREVO_API_KEY',
    'TRUSTED_PROXY_CIDRS', 'CORS_ORIGINS', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_REGION',
    'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'BLOB_STORAGE_DIR', 'SSO_ENABLED',
    'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'ERP_SSO_REDIRECT_URI',
    'GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_SENDER_EMAIL',
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function setProdBase(): void {
    process.env.NODE_ENV = 'production';
    process.env.APP_DATABASE_URL = 'x';
    process.env.DATABASE_URL = 'x';
    process.env.BREVO_API_KEY = 'x';
    process.env.TRUSTED_PROXY_CIDRS = 'x';
    process.env.CORS_ORIGINS = 'x';
    process.env.BLOB_STORAGE_DIR = './b';
  }

  it('no-ops outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertRequiredEnvForProd()).not.toThrow();
  });

  it('passes with base prod vars + local-disk storage', () => {
    setProdBase();
    expect(() => assertRequiredEnvForProd()).not.toThrow();
  });

  it('throws naming the missing var', () => {
    setProdBase();
    delete process.env.BREVO_API_KEY;
    expect(() => assertRequiredEnvForProd()).toThrow(/BREVO_API_KEY/);
  });

  it('requires the full S3 set when S3_ENDPOINT is set', () => {
    setProdBase();
    process.env.S3_ENDPOINT = 'https://s3';
    expect(() => assertRequiredEnvForProd()).toThrow(/S3_BUCKET/);
  });

  it('requires Entra+Graph vars only when SSO_ENABLED=true', () => {
    setProdBase();
    process.env.SSO_ENABLED = 'true';
    expect(() => assertRequiredEnvForProd()).toThrow(/ENTRA_TENANT_ID|GRAPH_TENANT_ID/);
  });

  it('rejects TEST_OTP_SEAM in production', () => {
    setProdBase();
    process.env.TEST_OTP_SEAM = '1';
    expect(() => assertRequiredEnvForProd()).toThrow(/TEST_OTP_SEAM/);
  });
});

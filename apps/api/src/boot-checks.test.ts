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
    'BREVO_SENDER_EMAIL',
    'TRUSTED_PROXY_CIDRS', 'CORS_ORIGINS', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_REGION',
    'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'BLOB_STORAGE_DIR', 'SSO_ENABLED',
    'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'ERP_SSO_REDIRECT_URI',
    'GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_SENDER_EMAIL',
    'LMS_SESSION_SECRET', 'STAFF_SESSION_SECRET', 'BACKUP_ENCRYPTION_PASSPHRASE',
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
    // Shaped like a real Brevo key: the boot check asserts the published
    // format, so a placeholder that no live key could ever match would make
    // every case below pass or fail for the wrong reason.
    process.env.BREVO_API_KEY = 'xkeysib-abc123def456';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
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

  it('requires the Brevo sender address', () => {
    setProdBase();
    delete process.env.BREVO_SENDER_EMAIL;
    expect(() => assertRequiredEnvForProd()).toThrow(/BREVO_SENDER_EMAIL/);
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

  // A missing trailing newline in .env.prod makes one line swallow the next.
  // The value that reaches the process is a SINGLE physical line — no line
  // break, no stray whitespace — so both the "is it set" check above and any
  // trim()-based guard wave it through. This cost twelve days of dead parent
  // OTPs, and the only visible signature is structural: an assignment sitting
  // inside the value.
  describe('malformed single-line secrets', () => {
    it('rejects a secret that swallowed the next line of the env file', () => {
      setProdBase();
      process.env.BREVO_API_KEY =
        'xkeysib-abc123GRAPH_TENANT_ID="00000000-0000-0000-0000-000000000000"';
      expect(() => assertRequiredEnvForProd()).toThrow(/BREVO_API_KEY/);
    });

    it('rejects a swallowed line in a secret that is not the Brevo key', () => {
      setProdBase();
      process.env.STAFF_SESSION_SECRET = 'somesecretBACKUP_ENCRYPTION_PASSPHRASE="hunter2"';
      expect(() => assertRequiredEnvForProd()).toThrow(/STAFF_SESSION_SECRET/);
    });

    it('rejects a secret containing a line break', () => {
      setProdBase();
      process.env.GRAPH_CLIENT_SECRET = 'abc\ndef';
      expect(() => assertRequiredEnvForProd()).toThrow(/GRAPH_CLIENT_SECRET/);
    });

    it('rejects a secret with leading or trailing whitespace', () => {
      setProdBase();
      process.env.S3_SECRET_KEY = '  padded  ';
      expect(() => assertRequiredEnvForProd()).toThrow(/S3_SECRET_KEY/);
    });

    it('names the variable but never prints its value', () => {
      setProdBase();
      process.env.BREVO_API_KEY = 'xkeysib-SUPERSECRETVALUEGRAPH_TENANT_ID="x"';
      try {
        assertRequiredEnvForProd();
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(String(e)).toContain('BREVO_API_KEY');
        expect(String(e)).not.toContain('SUPERSECRETVALUE');
      }
    });

    it('rejects a Brevo key that does not match the published format', () => {
      setProdBase();
      process.env.BREVO_API_KEY = 'not-a-brevo-key';
      expect(() => assertRequiredEnvForProd()).toThrow(/BREVO_API_KEY/);
    });

    // Both nets catch a swallowed Brevo key. Naming it twice in one line sends
    // whoever is reading the boot log hunting for a second broken variable.
    it('names a broken variable once even when both checks catch it', () => {
      setProdBase();
      process.env.BREVO_API_KEY = 'xkeysib-abc123GRAPH_TENANT_ID="x"';
      try {
        assertRequiredEnvForProd();
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(String(e).match(/BREVO_API_KEY/g)).toHaveLength(1);
      }
    });

    it('accepts a well-formed key', () => {
      setProdBase();
      process.env.BREVO_API_KEY = 'xkeysib-abc123def456';
      expect(() => assertRequiredEnvForProd()).not.toThrow();
    });

    // Base64 padding and comma-separated lists are ordinary values here; a
    // check that flagged them would be turned off within a week.
    it('accepts values that merely contain = or spaces but no embedded assignment', () => {
      setProdBase();
      process.env.S3_SECRET_KEY = 'abc+/def==';
      process.env.CORS_ORIGINS = 'https://a.com, https://b.com';
      process.env.TRUSTED_PROXY_CIDRS = '10.0.0.0/8, 192.168.0.0/16';
      expect(() => assertRequiredEnvForProd()).not.toThrow();
    });

    // The case above passes for the wrong reason — its padding follows
    // lowercase. `openssl rand -base64 32` puts an uppercase run before the
    // padding in about one value in six, and that is the shape that has to be
    // accepted. Regenerating BACKUP_ENCRYPTION_PASSPHRASE to appease a false
    // alarm here would orphan every existing encrypted backup.
    it('accepts base64 padding preceded by an uppercase run', () => {
      setProdBase();
      for (const value of ['abcDEFG==', 'K7QYRXWVUT=', 'x/+ABCDEF==']) {
        process.env.BACKUP_ENCRYPTION_PASSPHRASE = value;
        expect(() => assertRequiredEnvForProd(), `rejected ${value}`).not.toThrow();
      }
    });

    // Unset is the `missing` check's job; reporting it twice, in two different
    // vocabularies, sends the reader looking for a formatting bug.
    it('says nothing about secrets that are simply unset', () => {
      setProdBase();
      delete process.env.GRAPH_CLIENT_SECRET;
      expect(() => assertRequiredEnvForProd()).not.toThrow();
    });
  });
});

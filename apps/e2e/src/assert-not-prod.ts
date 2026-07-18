// Shared prod-database guard. Extracted from global-setup.ts so BOTH the e2e
// global setup AND the synthetic-seed env script (scripts/synthetic-seed-env.sh,
// via a node one-liner) enforce the same fail-closed check from a single source
// of truth — a name check that lives in two copies would drift.
//
// NOTE (plan 260718-0423 R1-S4 / Safety Gate): a database-NAME check is NOT a
// sufficient control on its own — a socat sidecar can present a `cmc_synth`
// pathname while the physical server is prod. This guard is one fail-closed
// layer; callers that WRITE (the seed script) must ALSO require a positive
// out-of-band signal (SYNTH_SEED_ALLOW) rather than trusting the name alone.

/** Real pilot DB name (docs/runbook-deploy.md) — the local-sim stack's
 * `cmc_prod` holds real child data. Fail-closed: any URL parse failure OR a
 * match on this name aborts. */
export const FORBIDDEN_DATABASE_NAME = 'cmc_prod';

export function assertNotProdDatabase(databaseUrl: string): void {
  let dbName: string;
  try {
    dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`Database URL is not a valid URL — refusing to run (fail-closed): ${databaseUrl}`);
  }
  if (dbName === FORBIDDEN_DATABASE_NAME) {
    throw new Error(
      `Refusing to operate against database "${FORBIDDEN_DATABASE_NAME}" — this is the real pilot ` +
        `database, not a throwaway. Point the URL at a throwaway DB (e.g. "cmc_synth"/"cmc_staging") first.`,
    );
  }
}

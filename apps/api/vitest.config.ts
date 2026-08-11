import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Alias workspace packages to their TS source so smoke tests run without a
// prior build step. Runtime/build resolution still uses the packages' compiled
// `dist` output via their `exports` map.
export default defineConfig({
  resolve: {
    alias: {
      '@cmc/auth': fileURLToPath(new URL('../../packages/auth/src/index.ts', import.meta.url)),
      '@cmc/storage': fileURLToPath(new URL('../../packages/storage/src/index.ts', import.meta.url)),
    },
  },
  test: {
    // Explicitly forward DB connection env vars to vitest worker contexts.
    // Prisma 6 resolves env("DATABASE_URL") from the schema at engine startup;
    // vitest workers may not inherit all parent env vars in every pool mode.
    env: {
      ...(process.env.DATABASE_URL && { DATABASE_URL: process.env.DATABASE_URL }),
      ...(process.env.APP_DATABASE_URL && { APP_DATABASE_URL: process.env.APP_DATABASE_URL }),
    },
    // The build emits copied `dist/**/*.test.js` files beside the source
    // tests. Keep Vitest's contract explicit: only authored source tests run;
    // generated output is covered by the source run and must not be collected
    // as a second suite.
    include: ['src/**/*.test.ts'],
    // Integration tests hit ONE real, shared dev Postgres instance (no
    // per-worker isolated schema) — running test FILES in parallel (Vitest's
    // default) intermittently produces spurious FK-constraint errors during
    // `cleanupFacility()` teardown under concurrent load against that shared
    // instance (observed: `Guardian_studentId_fkey` raised against a facility
    // that created zero Students, only reproducible under full-suite
    // concurrency, never in isolation) — a connection-pool/concurrency
    // artifact, not an application bug. Serializing file execution trades a
    // few seconds of wall-clock time for a deterministic, non-flaky suite.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/server.ts', 'src/worker/index.ts'],
      // docs/29-test-plan.md §2 (risk-based coverage targets). `finance` and
      // `provisioning` are the money/provisioning gate (M1 remediation) —
      // everything else falls back to a reasonable baseline. Branch
      // thresholds for finance/provisioning are set slightly below
      // lines/statements/functions: a few branches are P2002 concurrency-race
      // recovery paths (ADR 0041) that are only deterministically reachable
      // with fragile, timing-dependent tests — forcing 90% branches there
      // would trade CI stability for a marginal coverage number.
      thresholds: {
        'src/finance/**': { lines: 90, statements: 90, functions: 90, branches: 80 },
        'src/provisioning/**': { lines: 90, statements: 90, functions: 90, branches: 75 },
        'src/**': { lines: 70, statements: 70, functions: 70, branches: 60 },
      },
    },
  },
});

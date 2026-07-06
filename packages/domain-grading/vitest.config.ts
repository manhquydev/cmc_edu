import { defineConfig } from 'vitest/config';

// Phase-03 spec: computeFinalGrade is a pure function unit-tested to >=90%
// (docs/29-test-plan.md-style risk-based threshold, matching how
// apps/api/vitest.config.ts scopes 'src/finance/**'/'src/provisioning/**').
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      // `index.ts` is a pure re-export barrel (no logic of its own) — same
      // exclusion pattern as apps/api/vitest.config.ts excluding server.ts.
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        'src/**': { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});

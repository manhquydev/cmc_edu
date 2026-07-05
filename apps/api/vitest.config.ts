import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Alias workspace packages to their TS source so smoke tests run without a
// prior build step. Runtime/build resolution still uses the packages' compiled
// `dist` output via their `exports` map.
export default defineConfig({
  resolve: {
    alias: {
      '@cmc/auth': fileURLToPath(new URL('../../packages/auth/src/index.ts', import.meta.url)),
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['acceptance-report/**/*.test.ts', 'business-verify/**/*.test.ts'],
  },
});

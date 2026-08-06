import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/presentation/**/*.test.ts'],
    environment: 'node',
  },
});

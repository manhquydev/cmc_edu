import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// @cmc/ui component-test harness. jsdom is scoped to THIS package only — the
// apps keep their node-env default so existing logic tests are untouched (later
// app-level component tests opt in per-file via `// @vitest-environment jsdom`).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

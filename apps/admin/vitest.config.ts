import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Admin component-test harness. Node stays the DEFAULT env so the existing
// logic tests (cockpit-counter, nav-registry) are untouched; component tests
// opt in per-file via `// @vitest-environment jsdom`. Mirrors packages/ui's
// convention but does NOT force jsdom globally.
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./test-setup.ts'],
    globals: true,
    // Reset vi.fn() call-state between tests so mutation/refetch spies built in
    // a hoisted vi.mock factory don't bleed call counts across it() blocks.
    clearMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

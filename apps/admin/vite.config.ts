import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// @cmc/ui resolves via its `exports` map: the `development` condition points at
// TS source for dev/build, so no package pre-build is needed here.
export default defineConfig({
  plugins: [react()],
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// @cmc/ui resolves via its `exports` map: the `development` condition points at
// TS source for dev/build, so no package pre-build is needed here.
//
// Proxy: apps/api/src/server.ts has no CORS support (raw http.createServer,
// no Access-Control-Allow-Origin anywhere) — cross-origin browser calls (e.g.
// this app on :4173 calling the api on a different port) get their response
// silently blocked by the browser. Proxying keeps every request same-origin
// from the browser's point of view, sidestepping the gap entirely instead of
// touching the production server's security posture. VITE_API_URL must be
// unset/empty when using this proxy so the trpc client (src/lib/trpc.ts)
// calls relative paths instead of an absolute cross-origin URL.
const PROXY_TARGET = process.env['VITE_PROXY_API_TARGET'] ?? 'http://localhost:3000';
const proxy = {
  '/trpc': PROXY_TARGET,
  '/upload': PROXY_TARGET,
  '/auth': PROXY_TARGET,
  '/health': PROXY_TARGET,
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});

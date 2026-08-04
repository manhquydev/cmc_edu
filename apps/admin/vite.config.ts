import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';
import { defineConfig, loadEnv } from 'vite';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// @cmc/ui resolves via its `exports` map: the `development` condition points at
// TS source for dev/build, so no package pre-build is needed here.
//
// Proxy: apps/api has no CORS — browser on :5173 must call same-origin /auth /trpc.
// VITE_API_URL must be empty so fetch('/auth/staff-login') hits this proxy.
//
// Cookie rewrite: strip Secure/Domain on Set-Cookie so staff session works on http://localhost.
// envDir = monorepo root so root `.env` supplies VITE_* (apps/admin has no .env).

function rewriteSetCookieForHttpDev(proxyRes: {
  headers: Record<string, string | string[] | undefined>;
}): void {
  const raw = proxyRes.headers['set-cookie'];
  if (!raw) return;
  const list = Array.isArray(raw) ? raw : [raw];
  proxyRes.headers['set-cookie'] = list.map((c) =>
    c
      .replace(/;\s*Secure/gi, '')
      .replace(/;\s*Domain=[^;]*/gi, ''),
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, '');
  const proxyTarget =
    env['VITE_PROXY_API_TARGET'] ||
    process.env['VITE_PROXY_API_TARGET'] ||
    `http://localhost:${env['PORT'] || process.env['PORT'] || '3000'}`;

  function proxyEntry(): ProxyOptions {
    return {
      target: proxyTarget,
      changeOrigin: true,
      configure(proxyServer) {
        proxyServer.on('proxyRes', (proxyRes) => {
          rewriteSetCookieForHttpDev(proxyRes);
        });
      },
    };
  }

  const proxy: Record<string, string | ProxyOptions> = {
    '/trpc': proxyEntry(),
    '/upload': proxyEntry(),
    '/auth': proxyEntry(),
    '/health': proxyEntry(),
  };

  return {
    envDir: monorepoRoot,
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  };
});

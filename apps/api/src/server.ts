// Standalone tRPC HTTP server entrypoint. Also mounts the exercise-PDF upload
// route (T2-I, docs/26 WF-P2-04) — a plain HTTP route OUTSIDE the tRPC
// router, since tRPC's JSON transport is a poor fit for raw binary bodies
// (see ./exercise/upload-route.ts). `createHTTPHandler` (rather than
// `createHTTPServer`) returns just the request listener, so it can be
// composed with the upload route inside one `http.createServer`.

import { createServer } from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { createPrismaClient } from '@cmc/db';
import { appRouter } from './router.js';
import { createContext } from './context.js';
import {
  EXERCISE_PDF_UPLOAD_PATH, handleExercisePdfUpload, handleExercisePdfGet,
  SESSION_PHOTO_UPLOAD_PATH, handleSessionPhotoUpload, handleSessionPhotoGet,
} from './exercise/upload-route.js';
import {
  assertAllowDevAuthNotInProd,
  assertCmcAppNotSuperuser,
  assertCmcAppRole,
  assertForceRlsOnAllRlsTables,
  assertLmsSecretConfiguredForProd,
  assertRequiredEnvForProd,
  assertStaffLmsSecretsDistinct,
  assertStaffSecretConfiguredForProd,
} from './boot-checks.js';
import {
  handleSsoCallback,
  handleSsoLogin,
  handleSsoLogout,
} from './auth/sso-routes.js';

const port = Number(process.env.PORT ?? 3000);

// basePath must match what the browser trpc clients actually request:
// apps/admin/src/lib/trpc.ts and apps/lms/src/lib/trpc.ts both build their
// base URL as `${API_URL}/trpc`, so every real call arrives as
// `/trpc/{procedure}`. Without an explicit basePath here, createHTTPHandler
// defaults to '/' (stripping only the leading slash), so it tries to
// resolve a procedure literally named "trpc/{procedure}" and 404s — this
// was live-broken (verified against the running prod-simulation stack,
// `curl https://localhost/trpc/session.me` returned the same 404) because
// no browser-driven e2e test had ever exercised this path before.
const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) => createContext({ req }),
  basePath: '/trpc/',
});

const SSO_ENABLED = process.env['SSO_ENABLED'] === 'true';

const server = createServer((req, res) => {
  const urlPath = req.url?.split('?')[0];

  if (SSO_ENABLED) {
    if (req.method === 'GET' && urlPath === '/auth/login') {
      handleSsoLogin(req, res).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[api] SSO login failed:', err);
        if (!res.headersSent) res.writeHead(500).end('SSO error');
      });
      return;
    }
    if (req.method === 'GET' && urlPath === '/auth/callback') {
      handleSsoCallback(req, res).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[api] SSO callback failed:', err);
        if (!res.headersSent) res.writeHead(500).end('SSO error');
      });
      return;
    }
    if (req.method === 'GET' && urlPath === '/auth/logout') {
      handleSsoLogout(req, res);
      return;
    }
  }

  if (req.method === 'POST' && urlPath === EXERCISE_PDF_UPLOAD_PATH) {
    handleExercisePdfUpload(req, res).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[api] exercise-pdf upload failed:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Upload failed.' }));
    });
    return;
  }
  if (req.method === 'GET' && urlPath === EXERCISE_PDF_UPLOAD_PATH) {
    handleExercisePdfGet(req, res).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[api] exercise-pdf get failed:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Fetch failed.' }));
    });
    return;
  }
  if (req.method === 'POST' && urlPath === SESSION_PHOTO_UPLOAD_PATH) {
    handleSessionPhotoUpload(req, res).catch((error: unknown) => {
      console.error('[api] session-photo upload failed:', error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Upload failed.' }));
    });
    return;
  }
  if (req.method === 'GET' && urlPath === SESSION_PHOTO_UPLOAD_PATH) {
    handleSessionPhotoGet(req, res).catch((error: unknown) => {
      console.error('[api] session-photo get failed:', error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Fetch failed.' }));
    });
    return;
  }

  // Docker HEALTHCHECK (infra/docker/Dockerfile.api) and e2e's waitForHealth
  // (apps/e2e/src/global-setup.ts) both call bare `/health` (no /trpc
  // prefix, predating basePath above) and only care about a 2xx response —
  // rewrite to the real `health` procedure instead of duplicating its body.
  if (req.method === 'GET' && urlPath === '/health') {
    req.url = '/trpc/health';
  }

  trpcHandler(req, res);
});

// Synchronous boot assertions (no I/O required).
assertAllowDevAuthNotInProd();
assertLmsSecretConfiguredForProd();
assertStaffSecretConfiguredForProd();
assertStaffLmsSecretsDistinct();
assertRequiredEnvForProd();

// Async boot-check: verify cmc_app is not a superuser before accepting requests
// (ADR 0042 — superuser bypasses RLS unconditionally). Uses a throw-away
// client scoped to APP_DATABASE_URL; the shared lazy singleton in context.ts
// is not used here to keep startup sequencing independent.
const bootDb = createPrismaClient();
assertCmcAppNotSuperuser(bootDb)
  .then(() => assertCmcAppRole(bootDb))
  .then(() => assertForceRlsOnAllRlsTables(bootDb))
  .then(() => {
    server.listen(port);
    // eslint-disable-next-line no-console
    console.log(`[api] tRPC server listening on http://localhost:${port}`);
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

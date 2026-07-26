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
import { handleStaffPasswordLogin } from './auth/password-routes.js';

const port = Number(process.env.PORT ?? 3000);

// Two client conventions hit this handler and both must keep working:
//   - Browser clients (apps/admin/src/lib/trpc.ts, apps/lms/src/lib/trpc.ts)
//     build their base URL as `${API_URL}/trpc`, so every call arrives as
//     `/trpc/{procedure}`.
//   - Node e2e clients (apps/e2e/src/trpc-client.ts) call `baseUrl` directly
//     with NO `/trpc` segment, so calls arrive as `/{procedure}`.
// createHTTPHandler's `basePath` option can only strip one fixed prefix for
// every request, so it can't serve both conventions — setting it to
// '/trpc/' breaks the bare-path e2e clients (verified in CI: a request to
// `/facility.create` got wrongly sliced to `"ity.create"`, the literal
// 6-char length of '/trpc/'). Instead, leave basePath at its default ('/',
// strips only the leading slash — matches the bare-path e2e convention) and
// normalize the browser convention down to it below, only for requests that
// actually start with `/trpc/`.
const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) => createContext({ req }),
});

const SSO_ENABLED = process.env['SSO_ENABLED'] === 'true';

const server = createServer((req, res) => {
  const urlPath = req.url?.split('?')[0];

  // Email/password staff login — always mounted, independent of SSO_ENABLED,
  // so staff can log in while the Entra tenant is unavailable.
  if (req.method === 'POST' && urlPath === '/auth/staff-login') {
    handleStaffPasswordLogin(req, res).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[api] staff password login failed:', err);
      if (!res.headersSent) res.writeHead(500).end('Login error');
    });
    return;
  }
  // Logout only clears the staff cookie — auth-method-agnostic, so it stays
  // mounted even when SSO is disabled (password sessions need it too).
  if (req.method === 'GET' && urlPath === '/auth/logout') {
    handleSsoLogout(req, res);
    return;
  }

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

  // Normalize the browser clients' `/trpc/{procedure}` convention down to
  // the bare `/{procedure}` the handler's default basePath expects. Bare
  // paths (e2e clients, and Docker/e2e's `/health` check — see comment on
  // trpcHandler above) pass through unchanged.
  if (urlPath?.startsWith('/trpc/')) {
    req.url = req.url!.slice('/trpc'.length);
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

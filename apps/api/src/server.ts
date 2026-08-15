// Standalone tRPC HTTP server entrypoint. Also mounts the exercise-PDF upload
// route (T2-I, docs/26 WF-P2-04) — a plain HTTP route OUTSIDE the tRPC
// router, since tRPC's JSON transport is a poor fit for raw binary bodies
// (see ./exercise/upload-route.ts). `createHTTPHandler` (rather than
// `createHTTPServer`) returns just the request listener, so it can be
// composed with the upload route inside one `http.createServer`.

// MUST be first — @sentry/node v10 auto-instruments on early init (no-op when
// SENTRY_DSN is unset, so local dev and a not-yet-up GlitchTip are both fine).
import { Sentry } from './lib/instrument.js';
import { createServer, type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { createPrismaClient } from '@cmc/db';
import { appRouter } from './router.js';
import { createContext } from './context.js';
import { serviceLogger } from './lib/logger.js';
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
import { TRACK_ERROR_PATH, handleTrackError } from './lib/track-error-route.js';

const port = Number(process.env.PORT ?? 3000);
const log = serviceLogger('api');

// Per-request correlation id. Attached to the request object (not the tRPC
// Context, which has ~14 construction sites) so both the raw-http error logs
// below and the tRPC onError hook can stamp the SAME reqId — an agent can then
// pull every log line for one failed request with `jq 'select(.reqId=="...")'`.
// Symbol-keyed so it never collides with any header/property on IncomingMessage.
const REQ_ID = Symbol('reqId');
function reqIdOf(req: IncomingMessage): string {
  const slot = req as IncomingMessage & { [REQ_ID]?: string };
  return (slot[REQ_ID] ??= randomUUID());
}

// A raw-http route handler failed. Log it structured (pino, always) AND report
// it to GlitchTip (no-op when SENTRY_DSN is unset). The reqId is stamped as a
// Sentry tag so an agent can pivot from a GlitchTip issue straight to the exact
// pino log lines for that request — the one correlation key across both tools.
function reportRouteError(req: IncomingMessage, route: string, err: unknown): void {
  const reqId = reqIdOf(req);
  log.error({ reqId, route, err }, `${route} failed`);
  Sentry.withScope((scope) => {
    scope.setTag('reqId', reqId);
    scope.setTag('route', route);
    Sentry.captureException(err);
  });
}

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
// tRPC error codes that are normal client-side rejections, not server
// incidents — logged at debug and never pushed to GlitchTip so they don't
// drown the error stream. Everything else (INTERNAL_SERVER_ERROR, or any code
// not listed) is treated as a genuine server fault. Defined once at module
// scope (not rebuilt per onError call).
const EXPECTED_CLIENT_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'BAD_REQUEST',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'PARSE_ERROR',
  'TIMEOUT',
  'CLIENT_CLOSED_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'UNPROCESSABLE_CONTENT',
  'METHOD_NOT_SUPPORTED',
  'UNSUPPORTED_MEDIA_TYPE',
]);

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) => createContext({ req }),
  onError({ error, path, type, req }) {
    // reqId matches the raw-http lines so one request's story is greppable
    // end to end across pino and GlitchTip.
    const reqId = reqIdOf(req);
    const line = { reqId, path, type, code: error.code, err: error };
    if (EXPECTED_CLIENT_CODES.has(error.code)) {
      log.debug(line, 'tRPC procedure rejected');
    } else {
      log.error(line, 'tRPC procedure error');
      // Genuine server fault → GlitchTip, tagged with the same reqId + the
      // procedure path so an agent can jump issue → logs → the failing procedure.
      Sentry.withScope((scope) => {
        scope.setTag('reqId', reqId);
        if (path) scope.setTag('trpcPath', path);
        Sentry.captureException(error);
      });
    }
  },
});

const SSO_ENABLED = process.env['SSO_ENABLED'] === 'true';

const server = createServer((req, res) => {
  const urlPath = req.url?.split('?')[0];

  // Email/password staff login — always mounted, independent of SSO_ENABLED,
  // so staff can log in while the Entra tenant is unavailable.
  if (req.method === 'POST' && urlPath === '/auth/staff-login') {
    handleStaffPasswordLogin(req, res).catch((err: unknown) => {
      reportRouteError(req, 'staff-login', err);
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
        reportRouteError(req, 'sso-login', err);
        if (!res.headersSent) res.writeHead(500).end('SSO error');
      });
      return;
    }
    if (req.method === 'GET' && urlPath === '/auth/callback') {
      handleSsoCallback(req, res).catch((err: unknown) => {
        reportRouteError(req, 'sso-callback', err);
        if (!res.headersSent) res.writeHead(500).end('SSO error');
      });
      return;
    }
  }

  if (req.method === 'POST' && urlPath === EXERCISE_PDF_UPLOAD_PATH) {
    handleExercisePdfUpload(req, res).catch((error: unknown) => {
      reportRouteError(req, 'exercise-pdf-upload', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Upload failed.' }));
    });
    return;
  }
  if (req.method === 'GET' && urlPath === EXERCISE_PDF_UPLOAD_PATH) {
    handleExercisePdfGet(req, res).catch((error: unknown) => {
      reportRouteError(req, 'exercise-pdf-get', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Fetch failed.' }));
    });
    return;
  }
  if (req.method === 'POST' && urlPath === SESSION_PHOTO_UPLOAD_PATH) {
    handleSessionPhotoUpload(req, res).catch((error: unknown) => {
      reportRouteError(req, 'session-photo-upload', error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Upload failed.' }));
    });
    return;
  }
  if (req.method === 'GET' && urlPath === SESSION_PHOTO_UPLOAD_PATH) {
    handleSessionPhotoGet(req, res).catch((error: unknown) => {
      reportRouteError(req, 'session-photo-get', error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Fetch failed.' }));
    });
    return;
  }
  // Same-origin client error report (admin/lms → api, plans/260815-1616-uat-live-test-audit P3).
  // Unauthenticated by design: window.onerror / unhandledrejection / boundary
  // catches fire before any session guarantee; nginx rate limits throttle abuse.
  if (req.method === 'POST' && urlPath === TRACK_ERROR_PATH) {
    handleTrackError(req, res, reqIdOf(req)).catch((error: unknown) => {
      reportRouteError(req, 'track-error', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Error report failed.' }));
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
    log.info({ port }, 'tRPC server listening');
  })
  .catch((err: unknown) => {
    log.fatal({ err }, 'boot check failed — refusing to start');
    process.exit(1);
  });

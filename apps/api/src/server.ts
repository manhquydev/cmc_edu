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
import { EXERCISE_PDF_UPLOAD_PATH, handleExercisePdfUpload, handleExercisePdfGet } from './exercise/upload-route.js';
import { assertCmcAppNotSuperuser } from './boot-checks.js';

const port = Number(process.env.PORT ?? 3000);

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) => createContext({ req }),
});

const server = createServer((req, res) => {
  const urlPath = req.url?.split('?')[0];
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
  trpcHandler(req, res);
});

// Boot-check: verify cmc_app is not a superuser before accepting requests
// (ADR 0042 — superuser bypasses RLS unconditionally). Uses a throw-away
// client scoped to APP_DATABASE_URL; the shared lazy singleton in context.ts
// is not used here to keep startup sequencing independent.
assertCmcAppNotSuperuser(createPrismaClient())
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

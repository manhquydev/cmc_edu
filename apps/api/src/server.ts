// Standalone tRPC HTTP server entrypoint. Also mounts the exercise-PDF upload
// route (T2-I, docs/26 WF-P2-04) — a plain HTTP route OUTSIDE the tRPC
// router, since tRPC's JSON transport is a poor fit for raw binary bodies
// (see ./exercise/upload-route.ts). `createHTTPHandler` (rather than
// `createHTTPServer`) returns just the request listener, so it can be
// composed with the upload route inside one `http.createServer`.

import { createServer } from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './router.js';
import { createContext } from './context.js';
import { EXERCISE_PDF_UPLOAD_PATH, handleExercisePdfUpload } from './exercise/upload-route.js';

const port = Number(process.env.PORT ?? 3000);

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) => createContext({ req }),
});

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === EXERCISE_PDF_UPLOAD_PATH) {
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
  trpcHandler(req, res);
});

server.listen(port);
// eslint-disable-next-line no-console
console.log(`[api] tRPC server listening on http://localhost:${port}`);

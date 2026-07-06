// Standalone tRPC HTTP server entrypoint.

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './router.js';
import { createContext } from './context.js';

const port = Number(process.env.PORT ?? 3000);

const server = createHTTPServer({
  router: appRouter,
  createContext: ({ req }) => createContext({ req }),
});

server.listen(port);
// eslint-disable-next-line no-console
console.log(`[api] tRPC server listening on http://localhost:${port}`);

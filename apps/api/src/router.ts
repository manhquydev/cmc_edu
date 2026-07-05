// Root tRPC router. Domain routers (finance, enrollment, ...) mount here as
// they are built; P0 exposes only the health check.

import { z } from 'zod';
import { publicProcedure, router } from './trpc.js';

const healthOutput = z.object({
  status: z.literal('ok'),
  ts: z.string().datetime(),
});

export const appRouter = router({
  // `health` is one of the very few allowed publicProcedures (TL11 §1).
  health: publicProcedure.output(healthOutput).query(() => ({
    status: 'ok' as const,
    ts: new Date().toISOString(),
  })),
});

export type AppRouter = typeof appRouter;

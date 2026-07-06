// Root tRPC router. Domain routers (finance, enrollment, ...) mount here as
// they are built; P0 exposes only the health check.

import { z } from 'zod';
import { crmRouter } from './crm/router.js';
import { enrollmentRouter } from './enrollment/router.js';
import { financeRouter } from './finance/router.js';
import { guardianRouter } from './guardian/router.js';
import { lmsAuthRouter } from './lms-auth/router.js';
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
  crm: crmRouter,
  finance: financeRouter,
  enrollment: enrollmentRouter,
  guardian: guardianRouter,
  lmsAuth: lmsAuthRouter,
});

export type AppRouter = typeof appRouter;

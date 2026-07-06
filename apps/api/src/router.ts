// Root tRPC router. Domain routers (finance, enrollment, ...) mount here as
// they are built; P0 exposes only the health check.

import { z } from 'zod';
import { attendanceRouter } from './attendance/router.js';
import { classBatchRouter } from './class/class-batch-router.js';
import { classSessionRouter } from './class/class-session-router.js';
import { scheduleRouter } from './class/schedule-router.js';
import { courseRouter } from './course/router.js';
import { crmRouter } from './crm/router.js';
import { enrollmentRouter } from './enrollment/router.js';
import { curriculumUnitRouter, exerciseRouter } from './exercise/router.js';
import { exerciseOpenTierRouter } from './exercise/open-tier.js';
import { facilityRouter } from './facility/router.js';
import { financeRouter } from './finance/router.js';
import { guardianRouter } from './guardian/router.js';
import { lmsAuthRouter } from './lms-auth/router.js';
import { roomRouter } from './room/router.js';
import { studentRouter } from './student/router.js';
import { submissionRouter } from './submission/router.js';
import { mergeRouters, publicProcedure, router } from './trpc.js';

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
  student: studentRouter,
  facility: facilityRouter,
  course: courseRouter,
  room: roomRouter,
  classBatch: classBatchRouter,
  classSession: classSessionRouter,
  schedule: scheduleRouter,
  attendance: attendanceRouter,
  curriculumUnit: curriculumUnitRouter,
  // T2-I (CRUD) merged with T2-II (ADR 0038 open-tier reads) under one key.
  exercise: mergeRouters(exerciseRouter, exerciseOpenTierRouter),
  submission: submissionRouter,
});

export type AppRouter = typeof appRouter;

// Root tRPC router. Domain routers (finance, enrollment, ...) mount here as
// they are built; P0 exposes only the health check.

import { z } from 'zod';
import { attendanceRouter } from './attendance/router.js';
import { assessmentRouter, reportCardRouter } from './assessment/router.js';
import { checkInOutRouter, manualPunchRouter } from './checkin/router.js';
import { userRouter } from './user/router.js';
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
import { sessionEvidenceRouter, guardianLmsRouter } from './session-evidence/router.js';
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
  // T3: merge LMS guardian consent procedures into the existing guardian router.
  guardian: mergeRouters(guardianRouter, guardianLmsRouter),
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
  // T3: assessment (AI draft → confirm) + report card aggregation.
  assessment: assessmentRouter,
  reportCard: reportCardRouter,
  // T3: session evidence (teacher-authored, photo-gated for parents).
  sessionEvidence: sessionEvidenceRouter,
  // P3-I: HR/identity — AppUser CRUD and facility network management.
  user: userRouter,
  // P3-I: time-punch (clock-in/out) and manual punch tickets.
  checkInOut: checkInOutRouter,
  manualPunch: manualPunchRouter,
});

export type AppRouter = typeof appRouter;

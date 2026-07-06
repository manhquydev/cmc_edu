// curriculumUnit + exercise routers — T2-I (docs/26 WF-P2-04, TL19 §1/§3,
// QĐ 0021/0022). Both `CurriculumUnit` and `Exercise` are GLOBAL tables (no
// `facilityId`, no RLS — see schema.prisma model comments), so these
// procedures call plain `ctx.db` directly, the same pattern
// ../facility/router.ts uses for the (also global) `Facility` catalog —
// NOT `withFacility`/`scoped`, which are for facility-scoped tables only.
//
// Authorization is `exercise.manage` (director/super_admin) for every
// procedure here, including the read (`curriculumUnit.list`/`exercise.list`)
// — the spec names no separate read-only permission (phase-03 §Procedures).
//
// Scope: create/publish/close + the read lists only (US-014). Open-tier
// visibility to students (ADR 0038) lives in ./open-tier.ts
// (`exerciseOpenTierRouter`, T2-II US-015) — merged with this router under
// the `exercise` key in ../router.ts (`mergeRouters`). Submission/grading
// (US-016/017) live in ../submission/router.ts.

import { z } from 'zod';
import type { PrismaClient } from '@cmc/db';
import { badRequest, conflict, notFound } from '../errors.js';
import { requirePermission, router } from '../trpc.js';

const exerciseTypeSchema = z.enum(['homework', 'test_entrance', 'test_periodic']);

export interface CurriculumUnitDto {
  id: string;
  program: string;
  level: number;
  monthIndex: number;
  unitType: string;
  title: string;
}

function toCurriculumUnitDto(row: {
  id: string;
  program: string;
  level: number;
  monthIndex: number;
  unitType: string;
  title: string;
}): CurriculumUnitDto {
  return {
    id: row.id,
    program: row.program,
    level: row.level,
    monthIndex: row.monthIndex,
    unitType: row.unitType,
    title: row.title,
  };
}

export interface ExerciseDto {
  id: string;
  curriculumUnitId: string;
  type: string;
  basePdfRef: string;
  maxScore: number;
  starReward: number;
  status: string;
  createdById: string;
}

export function toExerciseDto(row: {
  id: string;
  curriculumUnitId: string;
  type: string;
  basePdfRef: string;
  maxScore: number;
  starReward: number;
  status: string;
  createdById: string;
}): ExerciseDto {
  return {
    id: row.id,
    curriculumUnitId: row.curriculumUnitId,
    type: row.type,
    basePdfRef: row.basePdfRef,
    maxScore: row.maxScore,
    starReward: row.starReward,
    status: row.status,
    createdById: row.createdById,
  };
}

/** `P2002` = Postgres unique-violation, surfaced by Prisma. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

async function findExerciseOrThrow(db: PrismaClient, exerciseId: string) {
  const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) {
    throw notFound('Exercise not found.');
  }
  return exercise;
}

export const curriculumUnitRouter = router({
  list: requirePermission('exercise', 'manage').query(async ({ ctx }) => {
    const units = await ctx.db.curriculumUnit.findMany({
      orderBy: [{ program: 'asc' }, { level: 'asc' }, { monthIndex: 'asc' }],
    });
    return { items: units.map(toCurriculumUnitDto) };
  }),
});

const createExerciseInput = z.object({
  curriculumUnitId: z.string().uuid(),
  type: exerciseTypeSchema,
  /** The `blobRef` returned by `POST /upload/exercise-pdf` (../server.ts). */
  basePdfRef: z.string().min(1),
  maxScore: z.number().int().positive().max(1000).optional(),
  starReward: z.number().int().nonnegative().max(10_000).optional(),
});

const exerciseIdInput = z.object({ exerciseId: z.string().uuid() });

const exerciseListInput = z.object({ curriculumUnitId: z.string().uuid().optional() });

export const exerciseRouter = router({
  // `basePdfRef` must come from a prior `POST /upload/exercise-pdf` call —
  // this procedure does not validate the blob itself exists (the upload
  // route is the only writer of that blob, and re-validating a blob's
  // existence on every read would add a storage round-trip nothing here
  // needs — `exercise.create` trusts its own upload transport).
  create: requirePermission('exercise', 'manage')
    .input(createExerciseInput)
    .mutation(async ({ ctx, input }): Promise<ExerciseDto> => {
      const unit = await ctx.db.curriculumUnit.findUnique({ where: { id: input.curriculumUnitId } });
      if (!unit) {
        throw notFound('CurriculumUnit not found.');
      }

      try {
        const exercise = await ctx.db.exercise.create({
          data: {
            curriculumUnitId: input.curriculumUnitId,
            type: input.type,
            basePdfRef: input.basePdfRef,
            maxScore: input.maxScore ?? 10,
            starReward: input.starReward ?? 10,
            createdById: ctx.subject.userId,
          },
        });
        return toExerciseDto(exercise);
      } catch (error) {
        // TL19 §3: unique `[curriculumUnitId, type]` — a repeat create for
        // the same unit+type is a business conflict, not a validation error.
        if (isUniqueConstraintError(error)) {
          throw conflict('An exercise of this type already exists for this unit.');
        }
        throw error;
      }
    }),

  // draft -> published (WF-P2-04 state machine). Published is the precondition
  // for the ADR 0038 open-tier gate (T2-II), not evaluated here.
  publish: requirePermission('exercise', 'manage')
    .input(exerciseIdInput)
    .mutation(async ({ ctx, input }): Promise<ExerciseDto> => {
      const exercise = await findExerciseOrThrow(ctx.db, input.exerciseId);
      if (exercise.status !== 'draft') {
        throw badRequest('Only a draft exercise can be published.');
      }
      const updated = await ctx.db.exercise.update({
        where: { id: exercise.id },
        data: { status: 'published' },
      });
      return toExerciseDto(updated);
    }),

  // published -> closed (WF-P2-04 state machine).
  close: requirePermission('exercise', 'manage')
    .input(exerciseIdInput)
    .mutation(async ({ ctx, input }): Promise<ExerciseDto> => {
      const exercise = await findExerciseOrThrow(ctx.db, input.exerciseId);
      if (exercise.status !== 'published') {
        throw badRequest('Only a published exercise can be closed.');
      }
      const updated = await ctx.db.exercise.update({
        where: { id: exercise.id },
        data: { status: 'closed' },
      });
      return toExerciseDto(updated);
    }),

  list: requirePermission('exercise', 'manage')
    .input(exerciseListInput)
    .query(async ({ ctx, input }) => {
      const exercises = await ctx.db.exercise.findMany({
        where: input.curriculumUnitId ? { curriculumUnitId: input.curriculumUnitId } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      return { items: exercises.map(toExerciseDto) };
    }),
});

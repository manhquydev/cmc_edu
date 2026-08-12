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
// Exercise rows live in a folder (`folderId`), not on a curriculum unit.
//
// Scope: create/publish/close + the read lists only (US-014). Open-tier
// visibility to students (ADR 0038) lives in ./open-tier.ts
// (`exerciseOpenTierRouter`, T2-II US-015) — merged with this router under
// the `exercise` key in ../router.ts (`mergeRouters`). Submission/grading
// (US-016/017) live in ../submission/router.ts.

import { z } from 'zod';
import type { Prisma, PrismaClient } from '@cmc/db';
import { badRequest, conflict, notFound } from '../errors.js';
import { requirePermission, router } from '../trpc.js';
import { assertFolderWritable } from './folder-router.js';

const exerciseTypeSchema = z.enum(['homework', 'test_entrance', 'test_periodic']);

export interface CurriculumUnitDto {
  id: string;
  program: string;
  /**
   * Framework level code kept verbatim from the curriculum CSV
   * (e.g. UCREA `U2`/`U3`/`U4`, Bright I.G `J`/`C`/…, Black Hole `B`/`G`/`P`/`R`).
   * Not a numeric rank — sequence within a level is `monthIndex`.
   */
  level: string;
  monthIndex: number;
  unitType: string;
  title: string;
  /** Stable unit sequence within program (ADR 0046) — class start neo. */
  orderGlobal: number;
}

function toCurriculumUnitDto(row: {
  id: string;
  program: string;
  level: string;
  monthIndex: number;
  unitType: string;
  title: string;
  orderGlobal: number;
}): CurriculumUnitDto {
  return {
    id: row.id,
    program: row.program,
    level: row.level,
    monthIndex: row.monthIndex,
    unitType: row.unitType,
    title: row.title,
    orderGlobal: row.orderGlobal,
  };
}

export interface ExerciseDto {
  id: string;
  folderId: string;
  orderInFolder: number;
  title: string;
  type: string;
  basePdfRef: string;
  maxScore: number;
  starReward: number;
  status: string;
  createdById: string;
}

export function toExerciseDto(row: {
  id: string;
  folderId: string;
  orderInFolder: number;
  title: string;
  type: string;
  basePdfRef: string;
  maxScore: number;
  starReward: number;
  status: string;
  createdById: string;
}): ExerciseDto {
  return {
    id: row.id,
    folderId: row.folderId,
    orderInFolder: row.orderInFolder,
    title: row.title,
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
      orderBy: [{ program: 'asc' }, { orderGlobal: 'asc' }],
    });
    return { items: units.map(toCurriculumUnitDto) };
  }),
});

const createExerciseInput = z.object({
  folderId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  type: exerciseTypeSchema,
  /** The `blobRef` returned by `POST /upload/exercise-pdf` (../server.ts). */
  basePdfRef: z.string().min(1),
  maxScore: z.number().int().positive().max(1000).optional(),
  starReward: z.number().int().nonnegative().max(10_000).optional(),
});

const exerciseIdInput = z.object({ exerciseId: z.string().uuid() });

const exerciseListInput = z.object({
  folderId: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
  type: exerciseTypeSchema.optional(),
});

type FolderDb = PrismaClient | Prisma.TransactionClient;

/** Same class as `writeSequenceUpdate` (91004) / deliver (91005): serialize
 *  max(orderInFolder)+1 per folder so two creates cannot mint the same slot. */
async function lockFolderOrder(tx: Prisma.TransactionClient, folderId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext($1::text), 91006)`,
    folderId,
  );
}

async function nextOrderInFolder(db: FolderDb, folderId: string): Promise<number> {
  const agg = await db.exercise.aggregate({
    where: { folderId },
    _max: { orderInFolder: true },
  });
  return (agg._max.orderInFolder ?? 0) + 1;
}

export const exerciseRouter = router({
  // `basePdfRef` must come from a prior `POST /upload/exercise-pdf` call —
  // this procedure does not validate the blob itself exists (the upload
  // route is the only writer of that blob, and re-validating a blob's
  // existence on every read would add a storage round-trip nothing here
  // needs — `exercise.create` trusts its own upload transport).
  create: requirePermission('exercise', 'manage')
    .input(createExerciseInput)
    .mutation(async ({ ctx, input }): Promise<ExerciseDto> => {
      await assertFolderWritable(ctx.db, input.folderId);

      try {
        const exercise = await ctx.db.$transaction(async (tx) => {
          await lockFolderOrder(tx, input.folderId);
          return tx.exercise.create({
            data: {
              folderId: input.folderId,
              orderInFolder: await nextOrderInFolder(tx, input.folderId),
              title: input.title,
              type: input.type,
              basePdfRef: input.basePdfRef,
              maxScore: input.maxScore ?? 10,
              starReward: input.starReward ?? 10,
              createdById: ctx.subject.userId,
            },
          });
        });
        return toExerciseDto(exercise);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw conflict('An exercise already occupies this position in the folder.');
        }
        throw error;
      }
    }),

  update: requirePermission('exercise', 'manage')
    .input(
      z.object({
        exerciseId: z.string().uuid(),
        folderId: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ExerciseDto> => {
      const exercise = await findExerciseOrThrow(ctx.db, input.exerciseId);
      const nextFolderId = input.folderId ?? exercise.folderId;
      const moving = Boolean(input.folderId && input.folderId !== exercise.folderId);
      if (moving) {
        await assertFolderWritable(ctx.db, input.folderId!);
      }
      try {
        const updated = await ctx.db.$transaction(async (tx) => {
          if (moving) {
            await lockFolderOrder(tx, nextFolderId);
          }
          return tx.exercise.update({
            where: { id: exercise.id },
            data: {
              ...(input.title !== undefined ? { title: input.title } : {}),
              ...(moving
                ? {
                    folderId: nextFolderId,
                    orderInFolder: await nextOrderInFolder(tx, nextFolderId),
                  }
                : {}),
            },
          });
        });
        return toExerciseDto(updated);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw conflict('An exercise already occupies this position in the folder.');
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
        where: {
          ...(input.folderId ? { folderId: input.folderId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.type ? { type: input.type } : {}),
        },
        orderBy: [{ orderInFolder: 'asc' }, { createdAt: 'desc' }],
      });
      return { items: exercises.map(toExerciseDto) };
    }),

  /**
   * Staff: cold-start form by UUID (resource-centric form-depth).
   * Same exercise.manage gate as list/publish/close. Exercise is a global
   * catalog (no facilityId / RLS) — same as list.
   */
  get: requirePermission('exercise', 'manage')
    .input(exerciseIdInput)
    .query(async ({ ctx, input }) => {
      const exercise = await ctx.db.exercise.findUnique({
        where: { id: input.exerciseId },
        include: { folder: true },
      });
      if (!exercise) {
        throw notFound('Exercise not found.');
      }
      return {
        ...toExerciseDto(exercise),
        folder: {
          id: exercise.folder.id,
          name: exercise.folder.name,
          description: exercise.folder.description,
          archivedAt: exercise.folder.archivedAt,
        },
      };
    }),
});

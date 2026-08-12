// ExerciseFolder CRUD — global catalog (no facilityId, no RLS). Same gate as
// exercise.* (`exercise.manage`). Archive hides the folder from new writes;
// it does not rewrite ClassExerciseItem rows already frozen on a class.

import { z } from 'zod';
import type { PrismaClient } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router } from '../trpc.js';

const folderIdInput = z.object({ folderId: z.string().uuid() });

export interface ExerciseFolderDto {
  id: string;
  name: string;
  description: string | null;
  archivedAt: Date | null;
  createdById: string;
  createdAt: Date;
}

function toFolderDto(row: ExerciseFolderDto): ExerciseFolderDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    archivedAt: row.archivedAt,
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}

export const exerciseFolderRouter = router({
  create: requirePermission('exercise', 'manage')
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ExerciseFolderDto> => {
      const folder = await ctx.db.exerciseFolder.create({
        data: {
          name: input.name,
          description: input.description,
          createdById: ctx.subject.userId,
        },
      });
      return toFolderDto(folder);
    }),

  update: requirePermission('exercise', 'manage')
    .input(
      z.object({
        folderId: z.string().uuid(),
        name: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ExerciseFolderDto> => {
      const existing = await ctx.db.exerciseFolder.findUnique({ where: { id: input.folderId } });
      if (!existing) throw notFound('ExerciseFolder not found.');
      const folder = await ctx.db.exerciseFolder.update({
        where: { id: input.folderId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      return toFolderDto(folder);
    }),

  archive: requirePermission('exercise', 'manage')
    .input(folderIdInput)
    .mutation(async ({ ctx, input }): Promise<ExerciseFolderDto> => {
      const existing = await ctx.db.exerciseFolder.findUnique({ where: { id: input.folderId } });
      if (!existing) throw notFound('ExerciseFolder not found.');
      if (existing.archivedAt) return toFolderDto(existing);
      const folder = await ctx.db.exerciseFolder.update({
        where: { id: input.folderId },
        data: { archivedAt: new Date() },
      });
      return toFolderDto(folder);
    }),

  list: requirePermission('exercise', 'manage').query(async ({ ctx }) => {
    const folders = await ctx.db.exerciseFolder.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    return { items: folders.map(toFolderDto) };
  }),
});

export async function assertFolderWritable(db: PrismaClient, folderId: string): Promise<{ id: string }> {
  const folder = await db.exerciseFolder.findUnique({
    where: { id: folderId },
    select: { id: true, archivedAt: true },
  });
  if (!folder) throw notFound('ExerciseFolder not found.');
  if (folder.archivedAt) throw badRequest('Cannot add or move an exercise into an archived folder.');
  return { id: folder.id };
}

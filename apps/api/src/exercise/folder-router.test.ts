// ExerciseFolder CRUD — global catalog (no facilityId, no RLS).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupExerciseLibrary,
  cleanupFacility,
  createTestFacility,
  seedClassBatch,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('exerciseFolder.create/update/archive/list', () => {
  let facility: { id: string };
  let gddt: Caller;
  let teacher: Caller;
  const folderIds: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Folder Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-folder-1', roles: ['giam_doc_dao_tao'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-folder-1', roles: ['giao_vien'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupExerciseLibrary(...folderIds);
    folderIds.length = 0;
  });

  it('creates, lists, renames, and archives a folder without touching a class sequence', async () => {
    const created = await gddt.exerciseFolder.create({ name: 'UCREA T3', description: 'Tháng 3' });
    folderIds.push(created.id);
    expect(created.name).toBe('UCREA T3');
    expect(created.archivedAt).toBeNull();
    expect(created.description).toBe('Tháng 3');

    const listed = await gddt.exerciseFolder.list();
    expect(listed.items.some((f) => f.id === created.id)).toBe(true);

    const renamed = await gddt.exerciseFolder.update({
      folderId: created.id,
      name: 'UCREA T3 (đổi tên)',
    });
    expect(renamed.name).toBe('UCREA T3 (đổi tên)');

    const homework = await gddt.exercise.create({
      folderId: created.id,
      title: 'Bài 1',
      type: 'homework',
      basePdfRef: 'exercise-pdf/folder-1.pdf',
    });
    await gddt.exercise.publish({ exerciseId: homework.id });

    const batch = await seedClassBatch({ facilityId: facility.id });
    const seq = await gddt.lmsOps.assignExerciseSequence({
      classBatchId: batch.id,
      exerciseIds: [homework.id],
    });
    expect(seq.items).toEqual([{ position: 1, exerciseId: homework.id }]);

    const archived = await gddt.exerciseFolder.archive({ folderId: created.id });
    expect(archived.archivedAt).not.toBeNull();

    const afterArchive = await testDbBypass((tx) =>
      tx.classExerciseItem.findMany({ where: { classBatchId: batch.id }, select: { exerciseId: true } }),
    );
    expect(afterArchive.map((r) => r.exerciseId)).toEqual([homework.id]);

    await expect(
      gddt.exercise.create({
        folderId: created.id,
        title: 'Bài mới vào folder ẩn',
        type: 'homework',
        basePdfRef: 'exercise-pdf/folder-2.pdf',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects folder writes from a non-GĐĐT role', async () => {
    await expect(teacher.exerciseFolder.create({ name: 'No' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(teacher.exerciseFolder.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

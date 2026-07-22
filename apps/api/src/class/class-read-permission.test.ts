// Reading a class is not creating a class.
//
// `classBatch.list/get` and `classSession.list` used to gate on `class.create`
// (giam_doc_dao_tao only), so no business role could complete the flows that
// merely need to *pick* a class: drafting a tuition receipt (`sale`/GĐKD) and
// assessing a session (`giao_vien`). Reads now gate on `class.read`.
//
// `classBatch.listStudents` returns children's `fullName`, so it gates on a
// separate, narrower `classRoster.read` (teachers + GĐĐT). Sale/GĐKD deliberately
// do NOT get it: no screen they use calls it, and the API layer — not a nav or
// `canDo()` gate in the browser — is what actually stops a session from dumping
// every child's name.
//
// The FORBIDDEN cases below are the guard rail for that split: they must be
// green both before and after the registry change. If one of them ever goes
// red, a read permission has leaked into write or roster territory.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedClassBatch } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('class read permissions (class.read / classRoster.read)', () => {
  let facility: { id: string };
  let classBatch: { id: string; code: string; courseId: string };
  let gddt: Caller;
  let gdkd: Caller;
  let sale: Caller;
  let giaoVien: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('ClassRead-Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });

    const caller = (userId: string, role: string): Caller =>
      appRouter.createCaller(
        buildStaffContext({ facilityId: facility.id, userId, roles: [role as never] }),
      );

    gddt = caller('class-read-gddt-001', 'giam_doc_dao_tao');
    gdkd = caller('class-read-gdkd-001', 'giam_doc_kinh_doanh');
    sale = caller('class-read-sale-001', 'sale');
    giaoVien = caller('class-read-gv-001', 'giao_vien');
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  describe('writes stay locked to giam_doc_dao_tao', () => {
    it('sale cannot create a class batch', async () => {
      await expect(
        sale.classBatch.create({
          courseId: classBatch.courseId,
          startDate: '2099-03-01',
          endDate: '2099-03-31',
          slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('giao_vien cannot assign a teacher to a class batch', async () => {
      await expect(
        giaoVien.classBatch.assignTeacher({
          classBatchId: classBatch.id,
          teacherAppUserId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('the money gate (ADR-B separation of duties) is untouched', () => {
    it('giam_doc_dao_tao cannot draft a tuition receipt', async () => {
      await expect(
        gddt.finance.receiptCreate({
          studentName: 'Bé Kiểm Thử',
          parentPhone: '0994900001',
          amount: 1_000_000,
          classBatchId: classBatch.id,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('the child-roster read is narrower than the class-list read', () => {
    it('sale cannot list the students of a class', async () => {
      await expect(
        sale.classBatch.listStudents({ classBatchId: classBatch.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('giam_doc_kinh_doanh cannot list the students of a class', async () => {
      await expect(
        gdkd.classBatch.listStudents({ classBatchId: classBatch.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('giao_vien can list the students of a class', async () => {
      await expect(giaoVien.classBatch.listStudents({ classBatchId: classBatch.id })).resolves.toEqual([]);
    });

    it('giam_doc_dao_tao can list the students of a class', async () => {
      await expect(gddt.classBatch.listStudents({ classBatchId: classBatch.id })).resolves.toEqual([]);
    });
  });

  describe('picking a class works for every role that has to pick one', () => {
    it('sale can list class batches (drafting a tuition receipt)', async () => {
      const result = await sale.classBatch.list({ page: 1, pageSize: 20 });
      expect(result.items.map((b) => b.id)).toContain(classBatch.id);
    });

    it('giam_doc_kinh_doanh can list class batches', async () => {
      const result = await gdkd.classBatch.list({ page: 1, pageSize: 20 });
      expect(result.items.map((b) => b.id)).toContain(classBatch.id);
    });

    it('giao_vien can list class batches (session assessment, evidence, schedule)', async () => {
      const result = await giaoVien.classBatch.list({ page: 1, pageSize: 20 });
      expect(result.items.map((b) => b.id)).toContain(classBatch.id);
    });

    it('sale can read a single class batch', async () => {
      const result = await sale.classBatch.get({ classBatchId: classBatch.id });
      expect(result.id).toBe(classBatch.id);
    });

    it('giao_vien can list the sessions of a class batch', async () => {
      await expect(giaoVien.classSession.list({ classBatchId: classBatch.id })).resolves.toBeInstanceOf(Array);
    });

    it('sale can list the sessions of a class batch', async () => {
      await expect(sale.classSession.list({ classBatchId: classBatch.id })).resolves.toBeInstanceOf(Array);
    });
  });
});

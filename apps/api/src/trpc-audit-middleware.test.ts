// Phase-04 super-admin-completion: integration tests proving the audit
// middleware is actually wired into every procedure kind (public/protected/
// lms) — the pure logic (actor resolution, denylist, entity/entityId) is
// covered in isolation by src/audit/audit-helpers.test.ts; this file proves
// the WIRING: exactly 1 row on a successful mutation, 0 on a query, 0 on a
// failed mutation, and no duplicate for a path that already writes its own
// manual audit entry (the exclude list).
//
// Uses an ad-hoc test router built from trpc.ts's real exported procedure
// builders (publicProcedure/protectedProcedure/lmsProcedure) — those already
// carry the middleware once wired, so this proves the SAME wiring every real
// business router gets, without depending on any specific business router's
// side effects.

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { appRouter } from './router.js';
import { createCallerFactory, lmsProcedure, protectedProcedure, publicProcedure, router } from './trpc.js';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDb,
} from './test/db.js';

const testRouter = router({
  staffMutate: protectedProcedure
    .input(z.object({ id: z.string().optional(), password: z.string().optional() }).optional())
    .mutation(({ input }) => ({ id: input?.id ?? 'generated-id' })),
  staffQuery: protectedProcedure.query(() => ({ ok: true })),
  staffFail: protectedProcedure.mutation(() => {
    throw new Error('boom');
  }),
  publicMutate: publicProcedure.mutation(() => ({ ok: true })),
  lmsMutate: lmsProcedure.mutation(() => ({ ok: true })),
});

const createTestCaller = createCallerFactory(testRouter);

describe('audit middleware — wiring (phase-04)', () => {
  let facilityId: string;
  const phonesToClean: string[] = [];

  afterEach(async () => {
    if (facilityId) await cleanupFacility(facilityId);
    facilityId = '';
    if (phonesToClean.length > 0) {
      await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
      phonesToClean.length = 0;
    }
  });

  it('a successful staff mutation writes exactly 1 AuditLog row (actor=userId, action=path)', async () => {
    // AuditLog is append-only (cmc_app has no UPDATE/DELETE grant on it — see
    // security/append-only-privilege.test.ts) — testDb() cleanup can never
    // remove rows a prior run left behind, so a per-run unique entityId is
    // required for a stable exact-count assertion across repeated runs.
    const f = await createTestFacility('Audit Mw Staff Mutate');
    facilityId = f.id;
    const rowId = `row-${randomUUID()}`;
    const ctx = buildStaffContext({ facilityId, userId: 'audit-staff-1', roles: ['super_admin'] });
    await createTestCaller(ctx).staffMutate({ id: rowId });

    const rows = await testDb().auditLog.findMany({ where: { action: 'staffMutate', entityId: rowId } });
    expect(rows.length).toBe(1);
    expect(rows[0]?.actor).toBe('audit-staff-1');
    expect(rows[0]?.entity).toBe('staffMutate');
  });

  it('a query never writes an AuditLog row', async () => {
    const f = await createTestFacility('Audit Mw Staff Query');
    facilityId = f.id;
    const ctx = buildStaffContext({ facilityId, userId: 'audit-staff-query', roles: ['super_admin'] });
    const before = await testDb().auditLog.count({ where: { actor: 'audit-staff-query' } });
    await createTestCaller(ctx).staffQuery();
    const after = await testDb().auditLog.count({ where: { actor: 'audit-staff-query' } });
    expect(after).toBe(before);
  });

  it('a failed mutation never writes an AuditLog row', async () => {
    const f = await createTestFacility('Audit Mw Staff Fail');
    facilityId = f.id;
    const ctx = buildStaffContext({ facilityId, userId: 'audit-staff-fail', roles: ['super_admin'] });
    const before = await testDb().auditLog.count({ where: { actor: 'audit-staff-fail' } });
    await expect(createTestCaller(ctx).staffFail()).rejects.toThrow('boom');
    const after = await testDb().auditLog.count({ where: { actor: 'audit-staff-fail' } });
    expect(after).toBe(before);
  });

  it('a public mutation (no session) logs actor=anonymous', async () => {
    const ctx = { subject: null, facilityId: null, lmsSubject: null, db: testDb(), ip: null };
    await createTestCaller(ctx).publicMutate();
    const rows = await testDb().auditLog.findMany({
      where: { action: 'publicMutate', actor: 'anonymous' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(rows.length).toBe(1);
  });

  it('an LMS parent mutation logs actor=parent:<parentAccountId>', async () => {
    // requireLmsSession asserts a live ParentAccount row (assertLiveLmsSession).
    // seedParentAccount stores the phone as given; use already-normalized 84 + 9 digits.
    const phone = `849${String(Date.now()).slice(-8)}`;
    const parent = await seedParentAccount(phone);
    phonesToClean.push(phone);
    const ctx = buildLmsContext({ parentAccountId: parent.id, kind: 'parent' });
    await createTestCaller(ctx).lmsMutate();
    const rows = await testDb().auditLog.findMany({
      where: { action: 'lmsMutate', actor: `parent:${parent.id}` },
    });
    expect(rows.length).toBe(1);
  });

  it('an LMS student mutation logs actor=student:<studentId>', async () => {
    const phone = `848${String(Date.now()).slice(-8)}`;
    const parent = await seedParentAccount(phone);
    phonesToClean.push(phone);
    const facility = await createTestFacility('Audit Mw LMS Student');
    facilityId = facility.id;
    const classBatch = await seedClassBatch({ facilityId: facility.id });
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });
    const ctx = buildLmsContext({
      parentAccountId: parent.id,
      studentId: enrollment.studentId,
      kind: 'student',
    });
    await createTestCaller(ctx).lmsMutate();
    const rows = await testDb().auditLog.findMany({
      where: { action: 'lmsMutate', actor: `student:${enrollment.studentId}` },
    });
    expect(rows.length).toBe(1);
  });

  it('strips a sensitive-named field from the persisted data', async () => {
    const f = await createTestFacility('Audit Mw Denylist');
    facilityId = f.id;
    const ctx = buildStaffContext({ facilityId, userId: 'audit-staff-denylist', roles: ['super_admin'] });
    await createTestCaller(ctx).staffMutate({ id: 'row-secret', password: 'hunter2' });

    const row = await testDb().auditLog.findFirstOrThrow({
      where: { action: 'staffMutate', entityId: 'row-secret' },
    });
    expect(row.data).not.toHaveProperty('password');
    expect(row.data).toMatchObject({ id: 'row-secret' });
  });

  // ---- Exclude-list: paths that already write their own manual audit entry ----

  it('facility.create (already audits manually) still produces exactly 1 AuditLog row, not 2', async () => {
    const bootstrap = await createTestFacility('Audit Mw Dedupe Bootstrap');
    facilityId = bootstrap.id;
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId, userId: 'audit-dedupe-admin', roles: ['super_admin'] }),
    );
    const created = await admin.facility.create({ name: 'Audit Mw Dedupe Created' });

    const rows = await testDb().auditLog.findMany({
      where: { entity: 'Facility', entityId: created.id, action: 'facility.create' },
    });
    expect(rows.length).toBe(1);

    await testDb().facility.delete({ where: { id: created.id } });
  });
});

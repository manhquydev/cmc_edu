// T2-I integration tests (US-014, docs/26 WF-P2-04, TL19 §3, QĐ 0021/0022):
// exercise create/publish/close transitions, the unique [unit,type]
// conflict, the exercise.manage permission gate, classSession.assignUnit
// (facility-scoped + RLS negative), and the PDF upload route
// (../exercise/upload-route.ts). `CurriculumUnit`/`Exercise` are GLOBAL
// tables (no facilityId, no RLS — QĐ 0021/0022), so they are cleaned up via
// `cleanupCurriculumUnits()`, not `cleanupFacility()`.

import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBlobStorage } from '@cmc/storage';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  createTestFacility,
  seedClassBatch,
  seedCurriculumUnit,
  testDbBypass,
} from '../test/db.js';
import { handleExercisePdfUpload, MAX_EXERCISE_PDF_BYTES } from './upload-route.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('exercise.create/publish/close + classSession.assignUnit (T2-I, TL19 §3)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let teacher: Caller;
  let unit: { id: string };
  const seededUnitIds: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Exercise Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-ex-1', roles: ['giam_doc_dao_tao'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ex-1', roles: ['giao_vien'] }),
    );
    unit = await seedCurriculumUnit();
    seededUnitIds.push(unit.id);
  });

  afterEach(async () => {
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupFacility(facility.id);
  });

  // ---- create -> publish -> close transitions ----

  it('creates a draft exercise, publishes it, then closes it', async () => {
    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });
    expect(created.status).toBe('draft');
    expect(created.maxScore).toBe(10);
    expect(created.starReward).toBe(10);

    const published = await gddt.exercise.publish({ exerciseId: created.id });
    expect(published.status).toBe('published');

    const closed = await gddt.exercise.close({ exerciseId: created.id });
    expect(closed.status).toBe('closed');
  });

  it('rejects publishing a non-draft exercise with BAD_REQUEST', async () => {
    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });
    await gddt.exercise.publish({ exerciseId: created.id });

    await expect(gddt.exercise.publish({ exerciseId: created.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects closing a draft (not-yet-published) exercise with BAD_REQUEST', async () => {
    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });

    await expect(gddt.exercise.close({ exerciseId: created.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  // Structural check (full ADR 0038 open-tier gate is T2-II, not this phase):
  // a `draft` exercise carries no "open to students" signal at all — only
  // `published` even enters that later gate's precondition.
  it('a draft exercise is not yet "open" (status stays draft until publish)', async () => {
    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });

    expect(created.status).not.toBe('published');
    expect(created.status).toBe('draft');
  });

  // ---- unique [curriculumUnitId, type] ----

  it('rejects a duplicate [unit, type] exercise with CONFLICT', async () => {
    await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/first.pdf',
    });

    await expect(
      gddt.exercise.create({
        curriculumUnitId: unit.id,
        type: 'homework',
        basePdfRef: 'exercise-pdf/second.pdf',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  // ---- permission gate ----

  it('rejects exercise.create from a non-GĐĐT role with FORBIDDEN', async () => {
    await expect(
      teacher.exercise.create({
        curriculumUnitId: unit.id,
        type: 'homework',
        basePdfRef: 'exercise-pdf/seed.pdf',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects curriculumUnit.list from a non-GĐĐT role with FORBIDDEN', async () => {
    await expect(teacher.curriculumUnit.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // ---- classSession.assignUnit ----

  async function seedSession() {
    const classBatch = await seedClassBatch({ facilityId: facility.id });
    return testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: classBatch.id,
          sessionDate: new Date('2026-08-03T00:00:00.000Z'),
          startTime: new Date('2026-08-03T11:00:00.000Z'),
          endTime: new Date('2026-08-03T12:30:00.000Z'),
        },
      }),
    );
  }

  it('assignUnit sets curriculumUnitId on a session in the caller facility', async () => {
    const session = await seedSession();

    const updated = await gddt.classSession.assignUnit({
      sessionId: session.id,
      curriculumUnitId: unit.id,
    });

    expect(updated.curriculumUnitId).toBe(unit.id);
  });

  it('assignUnit rejects a session from a different facility (RLS negative)', async () => {
    const otherFacility = await createTestFacility('Exercise Facility (other)');
    const otherGddt = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'gddt-ex-2', roles: ['giam_doc_dao_tao'] }),
    );
    const session = await seedSession();

    try {
      await expect(
        otherGddt.classSession.assignUnit({ sessionId: session.id, curriculumUnitId: unit.id }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });

  it('assignUnit rejects an unknown curriculumUnitId with NOT_FOUND', async () => {
    const session = await seedSession();

    await expect(
      gddt.classSession.assignUnit({
        sessionId: session.id,
        curriculumUnitId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('status & lifecycle guards (scenario audit pattern #2): assignUnit rejects a done session', async () => {
    const session = await seedSession();
    await testDbBypass((tx) => tx.classSession.update({ where: { id: session.id }, data: { status: 'done' } }));

    await expect(
      gddt.classSession.assignUnit({ sessionId: session.id, curriculumUnitId: unit.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('status & lifecycle guards: assignUnit rejects a cancelled session too', async () => {
    const session = await seedSession();
    await testDbBypass((tx) =>
      tx.classSession.update({ where: { id: session.id }, data: { status: 'cancelled' } }),
    );

    await expect(
      gddt.classSession.assignUnit({ sessionId: session.id, curriculumUnitId: unit.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------
// PDF upload route (POST /upload/exercise-pdf, ../exercise/upload-route.ts)
// ---------------------------------------------------------------------------

describe('POST /upload/exercise-pdf (T2-I, docs/26 WF-P2-04)', () => {
  let blobDir: string;

  beforeAll(() => {
    blobDir = join(tmpdir(), `cmc-exercise-pdf-upload-test-${randomUUID()}`);
    process.env.BLOB_STORAGE_DIR = blobDir;
  });

  afterAll(async () => {
    delete process.env.BLOB_STORAGE_DIR;
    await rm(blobDir, { recursive: true, force: true });
  });

  function fakeRequest(body: Buffer, headers: Record<string, string>): IncomingMessage {
    const readable = Readable.from([body]) as unknown as IncomingMessage;
    Object.defineProperty(readable, 'headers', { value: headers, writable: true });
    return readable;
  }

  function fakeResponse(): ServerResponse & { statusCode: number; body: string } {
    const res = {
      statusCode: 0,
      headersSent: false,
      body: '',
      writeHead(status: number) {
        res.statusCode = status;
        res.headersSent = true;
        return res;
      },
      end(chunk?: string) {
        if (chunk) res.body += chunk;
      },
    };
    return res as unknown as ServerResponse & { statusCode: number; body: string };
  }

  const devUserHeader = (roles: string[]) =>
    JSON.stringify({ userId: 'gddt-upload-1', roles, facilityId: 'facility-does-not-matter' });

  it('accepts a valid PDF and returns a stored blobRef', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 fake content for a test');
    const req = fakeRequest(pdfBytes, {
      'x-dev-user': devUserHeader(['giam_doc_dao_tao']),
      'content-type': 'application/pdf',
      'content-length': String(pdfBytes.length),
    });
    const res = fakeResponse();

    await handleExercisePdfUpload(req, res);

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body) as { blobRef: string };
    expect(parsed.blobRef).toMatch(/^exercise-pdf\/.+\.pdf$/);

    const stored = await createBlobStorage().get(parsed.blobRef);
    expect(stored?.equals(pdfBytes)).toBe(true);
  });

  it('rejects a non-PDF content-type with 400', async () => {
    const bytes = Buffer.from('not a pdf');
    const req = fakeRequest(bytes, {
      'x-dev-user': devUserHeader(['giam_doc_dao_tao']),
      'content-type': 'image/png',
      'content-length': String(bytes.length),
    });
    const res = fakeResponse();

    await handleExercisePdfUpload(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('rejects an oversized payload (declared via Content-Length) with 400', async () => {
    const bytes = Buffer.from('%PDF-1.4 small body');
    const req = fakeRequest(bytes, {
      'x-dev-user': devUserHeader(['giam_doc_dao_tao']),
      'content-type': 'application/pdf',
      'content-length': String(MAX_EXERCISE_PDF_BYTES + 1),
    });
    const res = fakeResponse();

    await handleExercisePdfUpload(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('rejects a body that streams over the limit even with no/false Content-Length', async () => {
    const bytes = Buffer.alloc(MAX_EXERCISE_PDF_BYTES + 1, 1);
    const req = fakeRequest(bytes, {
      'x-dev-user': devUserHeader(['giam_doc_dao_tao']),
      'content-type': 'application/pdf',
    });
    const res = fakeResponse();

    await handleExercisePdfUpload(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing session with 401', async () => {
    const bytes = Buffer.from('%PDF-1.4 x');
    const req = fakeRequest(bytes, { 'content-type': 'application/pdf' });
    const res = fakeResponse();

    await handleExercisePdfUpload(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects an insufficiently-privileged session with 403', async () => {
    const bytes = Buffer.from('%PDF-1.4 x');
    const req = fakeRequest(bytes, {
      'x-dev-user': devUserHeader(['giao_vien']),
      'content-type': 'application/pdf',
      'content-length': String(bytes.length),
    });
    const res = fakeResponse();

    await handleExercisePdfUpload(req, res);

    expect(res.statusCode).toBe(403);
  });
});

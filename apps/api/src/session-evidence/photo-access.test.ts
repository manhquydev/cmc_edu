import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@cmc/db';
import type { LmsSubject } from '../trpc.js';

// Isolate the helper's own logic: getApprovedChildren is exercised by its own
// tests; here we control which children the subject may act for.
vi.mock('../guardian/approved-children.js', () => ({
  getApprovedChildren: vi.fn(),
}));
// withFacility just runs the callback with the same mock db in these tests.
vi.mock('@cmc/db', () => ({
  withFacility: (db: unknown, _fid: unknown, fn: (tx: unknown) => unknown) => fn(db),
}));

import { canAccessSessionPhoto } from './photo-access.js';
import { getApprovedChildren } from '../guardian/approved-children.js';

const PARENT: LmsSubject = { parentAccountId: 'pa-1', kind: 'parent' };
const REF = 'session-photos/abc.jpg';

interface MockOpts {
  photo?: unknown;
  enrolledStudentIds?: string[];
  consentStudentIds?: string[];
}
// enrollment/guardian mocks honor the `where.studentId.in` filter so the
// student-kind confinement (query restricted to the own id) is observable.
function inFilter(args: { where?: { studentId?: { in?: string[] } } }): string[] | null {
  return args?.where?.studentId?.in ?? null;
}
function makeDb(o: MockOpts): PrismaClient {
  return {
    sessionEvidencePhoto: { findFirst: async () => o.photo ?? null },
    enrollment: {
      findMany: async (args: object) => {
        const allow = inFilter(args);
        return (o.enrolledStudentIds ?? [])
          .filter((id) => !allow || allow.includes(id))
          .map((studentId) => ({ studentId }));
      },
    },
    guardian: {
      findMany: async (args: object) => {
        const allow = inFilter(args);
        return (o.consentStudentIds ?? [])
          .filter((id) => !allow || allow.includes(id))
          .map((studentId) => ({ studentId }));
      },
    },
  } as unknown as PrismaClient;
}
const publishedPhoto = {
  facilityId: 'f-1',
  sessionEvidence: { status: 'published', classSession: { classBatchId: 'cb-1' } },
};

describe('canAccessSessionPhoto (RT-3)', () => {
  beforeEach(() => {
    vi.mocked(getApprovedChildren).mockReset();
  });

  it('denies when the photo blobRef is unknown', async () => {
    vi.mocked(getApprovedChildren).mockResolvedValue([{ studentId: 's-1', fullName: 'A' }]);
    expect(await canAccessSessionPhoto(makeDb({ photo: null }), PARENT, REF)).toBe(false);
  });

  it('denies when the evidence is not published', async () => {
    vi.mocked(getApprovedChildren).mockResolvedValue([{ studentId: 's-1', fullName: 'A' }]);
    const draft = { ...publishedPhoto, sessionEvidence: { ...publishedPhoto.sessionEvidence, status: 'draft' } };
    expect(await canAccessSessionPhoto(makeDb({ photo: draft }), PARENT, REF)).toBe(false);
  });

  it('denies when the subject has no approved children', async () => {
    vi.mocked(getApprovedChildren).mockResolvedValue([]);
    expect(await canAccessSessionPhoto(makeDb({ photo: publishedPhoto }), PARENT, REF)).toBe(false);
  });

  it('denies when no approved child is enrolled in the photo batch', async () => {
    vi.mocked(getApprovedChildren).mockResolvedValue([{ studentId: 's-1', fullName: 'A' }]);
    expect(
      await canAccessSessionPhoto(makeDb({ photo: publishedPhoto, enrolledStudentIds: [] }), PARENT, REF),
    ).toBe(false);
  });

  it('denies when enrolled but photo consent is inactive', async () => {
    vi.mocked(getApprovedChildren).mockResolvedValue([{ studentId: 's-1', fullName: 'A' }]);
    expect(
      await canAccessSessionPhoto(
        makeDb({ photo: publishedPhoto, enrolledStudentIds: ['s-1'], consentStudentIds: [] }),
        PARENT,
        REF,
      ),
    ).toBe(false);
  });

  it('allows when enrolled + consent active', async () => {
    vi.mocked(getApprovedChildren).mockResolvedValue([{ studentId: 's-1', fullName: 'A' }]);
    expect(
      await canAccessSessionPhoto(
        makeDb({ photo: publishedPhoto, enrolledStudentIds: ['s-1'], consentStudentIds: ['s-1'] }),
        PARENT,
        REF,
      ),
    ).toBe(true);
  });

  it('student-kind subject is confined to their own studentId', async () => {
    // Approved list has a sibling s-2; the student token is for s-1 but the
    // photo batch only enrolls s-2 → student must NOT see the sibling's photo.
    vi.mocked(getApprovedChildren).mockResolvedValue([
      { studentId: 's-1', fullName: 'A' },
      { studentId: 's-2', fullName: 'B' },
    ]);
    const studentSubject: LmsSubject = { parentAccountId: 'pa-1', kind: 'student', studentId: 's-1' };
    expect(
      await canAccessSessionPhoto(
        makeDb({ photo: publishedPhoto, enrolledStudentIds: ['s-2'], consentStudentIds: ['s-2'] }),
        studentSubject,
        REF,
      ),
    ).toBe(false);
  });
});

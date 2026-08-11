// RT-3: server-side authorization for GET /upload/session-photo.
//
// A valid LMS session is necessary but NOT sufficient — the caller must be
// entitled to the specific child photo. Mirrors sessionEvidence.listForChild's
// gate (router.ts): the photo must belong to PUBLISHED evidence for a class the
// subject's approved child is enrolled in, AND that child's guardian consent
// must be active (Guardian.photoConsent = true AND photoConsentRevokedAt IS NULL,
// TL08 §7 / C2). Fails closed on any missing link.

import { withFacility, type PrismaClient } from '@cmc/db';
import type { LmsSubject } from '../trpc.js';
import { getApprovedChildren } from '../guardian/approved-children.js';

/**
 * Returns true iff `lmsSubject` may view the session photo at `blobRef`.
 * Never throws for an authz failure — returns false so the caller sends 403/404.
 */
export async function canAccessSessionPhoto(
  db: PrismaClient,
  lmsSubject: LmsSubject,
  blobRef: string,
): Promise<boolean> {
  // 1. Resolve the photo → its published-evidence class batch + facility.
  //    RLS bypass: blobRef is opaque and facility is unknown until resolved.
  const photo = await withFacility(
    db,
    null,
    (tx) =>
      tx.sessionEvidencePhoto.findFirst({
        where: { blobRef },
        select: {
          facilityId: true,
          sessionEvidence: {
            select: {
              status: true,
              classSession: { select: { classBatchId: true, status: true } },
            },
          },
        },
      }),
    { bypass: true },
  );
  if (!photo) return false;
  if (photo.sessionEvidence.status !== 'published') return false;
  // Cancelled sessions never ran — same family rule as listForChild (phase 5).
  if (photo.sessionEvidence.classSession.status === 'cancelled') return false;
  const { facilityId } = photo;
  const classBatchId = photo.sessionEvidence.classSession.classBatchId;

  // 2. Which students may this subject act for? Parent → all approved children;
  //    student → only their own id (and only if it's an approved child).
  const parentAccountId = lmsSubject.parentAccountId;
  const approved = await getApprovedChildren(db, parentAccountId);
  let candidateStudentIds = approved.map((c) => c.studentId);
  if (lmsSubject.kind === 'student') {
    const own = lmsSubject.studentId;
    candidateStudentIds = candidateStudentIds.filter((id) => id === own);
  }
  if (candidateStudentIds.length === 0) return false;

  // 3. Of those, who is enrolled in the photo's class batch (same facility)?
  const enrolled = await withFacility(db, facilityId, (tx) =>
    tx.enrollment.findMany({
      where: { studentId: { in: candidateStudentIds }, classBatchId, facilityId },
      select: { studentId: true },
    }),
  );
  if (enrolled.length === 0) return false;

  // 4. At least one enrolled candidate must have active photo consent.
  const guardians = await db.guardian.findMany({
    where: {
      parentAccountId,
      studentId: { in: enrolled.map((e) => e.studentId) },
      photoConsent: true,
      photoConsentRevokedAt: null,
    },
    select: { studentId: true },
  });
  return guardians.length > 0;
}

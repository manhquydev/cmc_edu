// HR remediation phase 7: the session-done engine (docs/26 phase-07,
// plan.md "Session-done engine"). A session transitions `planned|confirmed`
// -> `done` only when ALL 3 conditions hold, evaluated by the worker sweep
// (session-done-sweep.ts) — never by an event hook on the attendance/
// assessment/evidence routers (R2 #1: hooking those routers races across
// separate transactions with no real-time consumer to justify the risk).
//
//   1. Attendance: >=1 `present` row for the session (0 present routes to
//      the sweep's separate auto-cancel branch instead).
//   2. Assessment: EVERY `present` student has a `QualitativeAssessment`
//      scoped to this session (`classSessionId`) with status `confirmed`.
//   3. Evidence: `SessionEvidence` is `published` with >=1 photo.
//
// `doneAt` = the latest of the 3 conditions' own timestamps (last present
// `markedAt`, last required `confirmedAt`, evidence `publishedAt`) — frozen
// once set; re-marking attendance or discarding an assessment after `done`
// does not change it (`doneAt` is a snapshot, not a live-recomputed value).
//
// Time gate (R2 #C2): even if every condition's timestamp precedes the
// session's own `endTime` (e.g. a teacher pre-confirms before class ends),
// `evaluateSessionDone` refuses to return a result until `now >= endTime` —
// closes the gap where confirming ahead of time could game done/credit.

import type { Prisma } from '@cmc/db';

export interface AttendanceForEvaluation {
  studentId: string;
  status: string;
  markedAt: Date;
}

export interface AssessmentForEvaluation {
  studentId: string;
  status: string;
  confirmedAt: Date | null;
}

export interface EvidenceForEvaluation {
  status: string;
  publishedAt: Date | null;
  photoCount: number;
}

export interface SessionDoneEvaluationInput {
  endTime: Date;
  attendances: readonly AttendanceForEvaluation[];
  assessments: readonly AssessmentForEvaluation[];
  evidence: EvidenceForEvaluation | null;
}

export interface SessionDoneResult {
  doneAt: Date;
}

/** UI/hub progress flags — same 3 conditions as `evaluateSessionDone`, without collapsing to null. */
export interface SessionDoneProgress {
  /** ≥1 attendance row with status `present`. */
  attendanceOk: boolean;
  presentCount: number;
  /** Every present student has a confirmed qualitative assessment. */
  assessmentOk: boolean;
  assessmentsConfirmed: number;
  assessmentsRequired: number;
  /** Evidence published with ≥1 photo. */
  evidenceOk: boolean;
  photoCount: number;
  evidencePublished: boolean;
  /** `now >= endTime` (done-sweep time gate). */
  timeGatePassed: boolean;
  /** All 3 conditions + time gate (eligible for done flip). */
  eligible: boolean;
}

/**
 * Pure progress snapshot for session hub / checklist UI.
 * Does not flip session status — only reports condition flags.
 */
export function evaluateSessionDoneProgress(
  input: SessionDoneEvaluationInput,
  now: Date,
): SessionDoneProgress {
  const present = input.attendances.filter((a) => a.status === 'present');
  const attendanceOk = present.length > 0;

  const confirmedAtByStudent = new Map<string, Date>();
  for (const assessment of input.assessments) {
    if (assessment.status === 'confirmed' && assessment.confirmedAt) {
      confirmedAtByStudent.set(assessment.studentId, assessment.confirmedAt);
    }
  }
  let assessmentsConfirmed = 0;
  for (const attendance of present) {
    if (confirmedAtByStudent.has(attendance.studentId)) assessmentsConfirmed += 1;
  }
  const assessmentsRequired = present.length;
  const assessmentOk = attendanceOk && assessmentsConfirmed === assessmentsRequired;

  const photoCount = input.evidence?.photoCount ?? 0;
  const evidencePublished = input.evidence?.status === 'published';
  const evidenceOk =
    Boolean(input.evidence) &&
    evidencePublished &&
    photoCount >= 1 &&
    Boolean(input.evidence?.publishedAt);

  const timeGatePassed = now >= input.endTime;
  const eligible = attendanceOk && assessmentOk && evidenceOk && timeGatePassed;

  return {
    attendanceOk,
    presentCount: present.length,
    assessmentOk,
    assessmentsConfirmed,
    assessmentsRequired,
    evidenceOk,
    photoCount,
    evidencePublished,
    timeGatePassed,
    eligible,
  };
}

/**
 * Pure evaluation of the 3 done-conditions against already-fetched rows — no
 * DB access, fully unit-testable. Returns `null` whenever the session is not
 * (yet) eligible to become `done`; the caller decides what a `null` result
 * means for its own flow (done-sweep: leave as-is; cancel-sweep: a 0-present
 * `null` here is exactly its trigger to consider auto-cancel instead).
 */
export function evaluateSessionDone(
  input: SessionDoneEvaluationInput,
  now: Date,
): SessionDoneResult | null {
  const progress = evaluateSessionDoneProgress(input, now);
  if (!progress.eligible) return null;

  const present = input.attendances.filter((a) => a.status === 'present');
  const confirmedAtByStudent = new Map<string, Date>();
  for (const assessment of input.assessments) {
    if (assessment.status === 'confirmed' && assessment.confirmedAt) {
      confirmedAtByStudent.set(assessment.studentId, assessment.confirmedAt);
    }
  }

  // eligible ⇒ evidence published with publishedAt + ≥1 photo
  let doneAt = input.evidence!.publishedAt!;
  for (const attendance of present) {
    if (attendance.markedAt > doneAt) doneAt = attendance.markedAt;
    const confirmedAt = confirmedAtByStudent.get(attendance.studentId);
    if (confirmedAt && confirmedAt > doneAt) doneAt = confirmedAt;
  }

  return { doneAt };
}

/**
 * Loads a session's attendance/assessment/evidence rows, evaluates the 3
 * conditions, and — if eligible — flips it to `done` via a conditional
 * `updateMany` (`WHERE id AND status IN ('planned','confirmed')`), so a
 * session already handled by a concurrent sweep run is a silent no-op
 * (`count === 0`) rather than a double-mark. Shared by the done-sweep worker
 * task and the pre-activation backfill script (both need identical
 * eligibility logic, just different `now`/activation handling around it).
 */
export async function markSessionDoneIfEligible(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
): Promise<SessionDoneResult | null> {
  const session = await tx.classSession.findUnique({
    where: { id: sessionId },
    select: { endTime: true, status: true },
  });
  if (!session || (session.status !== 'planned' && session.status !== 'confirmed')) {
    return null;
  }

  const [attendances, assessments, evidence] = await Promise.all([
    tx.attendance.findMany({
      where: { classSessionId: sessionId },
      select: { studentId: true, status: true, markedAt: true },
    }),
    tx.qualitativeAssessment.findMany({
      where: { classSessionId: sessionId },
      select: { studentId: true, status: true, confirmedAt: true },
    }),
    tx.sessionEvidence.findUnique({
      where: { classSessionId: sessionId },
      select: { status: true, publishedAt: true, photos: { select: { id: true } } },
    }),
  ]);

  const result = evaluateSessionDone(
    {
      endTime: session.endTime,
      attendances,
      assessments,
      evidence: evidence
        ? { status: evidence.status, publishedAt: evidence.publishedAt, photoCount: evidence.photos.length }
        : null,
    },
    now,
  );
  if (!result) return null;

  const updated = await tx.classSession.updateMany({
    where: { id: sessionId, status: { in: ['planned', 'confirmed'] } },
    data: { status: 'done', doneAt: result.doneAt },
  });
  if (updated.count === 0) return null;

  return result;
}

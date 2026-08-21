/**
 * Session-scoped qualitative assessment roster (present students only).
 */
import { useState } from 'react';
import { Badge, Banner, Button, HStack, Skeleton, Stack, Text } from '@cmc/ui';
import { trpc } from '../../../lib/trpc.js';
import { RecordLink } from '../../../lib/record-link.js';
import {
  SessionRubricFields,
  draftFromPayload,
  emptyRubricDraft,
  isDraftComplete,
  toRubricPayload,
  type RubricDraft,
} from './session-rubric-fields.js';

interface RosterEntry {
  studentId: string;
  fullName: string;
}

export interface AssessmentPanelProps {
  sessionId: string;
  classBatchId: string;
  /** Hide duplicate 3/3 badges when hub already shows doneProgress. */
  hideDoneBadges?: boolean;
}

export function AssessmentPanel({
  sessionId,
  classBatchId,
  hideDoneBadges = false,
}: AssessmentPanelProps) {
  const [rubricDrafts, setRubricDrafts] = useState<Record<string, RubricDraft>>({});
  const [confirmAllError, setConfirmAllError] = useState<string | null>(null);
  const [confirmAllBusy, setConfirmAllBusy] = useState(false);

  const { data: studentsData } = trpc.classBatch.listStudents.useQuery(
    { classBatchId },
    { enabled: Boolean(classBatchId) },
  );
  const { data: rosterData, isLoading: rosterLoading } = trpc.attendance.listBySession.useQuery(
    { sessionId },
    { enabled: Boolean(sessionId) },
  );
  const {
    data: assessData,
    isLoading: assessLoading,
    refetch: refetchAssessments,
  } = trpc.assessment.listBySession.useQuery(
    { classSessionId: sessionId },
    { enabled: Boolean(sessionId) },
  );
  const { data: evidenceData, isLoading: evidenceLoading } = trpc.sessionEvidence.getBySession.useQuery(
    { classSessionId: sessionId },
    { enabled: Boolean(sessionId) },
  );

  const utils = trpc.useUtils();
  const draftMut = trpc.assessment.draftComment.useMutation({
    onSuccess: () => {
      void refetchAssessments();
      void utils.classSession.doneProgress.invalidate({ sessionId });
    },
  });
  const confirmMut = trpc.assessment.confirm.useMutation({
    onSuccess: () => {
      void refetchAssessments();
      void utils.classSession.doneProgress.invalidate({ sessionId });
    },
  });

  const nameByStudentId = new Map(
    ((studentsData ?? []) as Array<{ studentId: string; fullName: string }>).map((s) => [
      s.studentId,
      s.fullName,
    ]),
  );
  const attendanceItems = (rosterData?.items ?? []) as Array<{
    studentId: string;
    status: string | null;
  }>;
  const hasPresentAttendance = attendanceItems.some((r) => r.status === 'present');
  const roster: RosterEntry[] = attendanceItems
    .filter((r) => r.status === 'present')
    .map((r) => ({
      studentId: r.studentId,
      fullName: nameByStudentId.get(r.studentId) ?? r.studentId.slice(0, 8),
    }));

  const catalog = assessData?.catalog ?? null;

  interface AssessmentDto {
    id: string;
    studentId: string;
    status: string;
    content: string;
    rubric?: {
      version: 2;
      scores: Record<string, 1 | 2 | 3 | 4>;
      narratives?: { strength?: string; weakness?: string; recommendation?: string };
    } | null;
  }
  const assessmentByStudentId = new Map(
    ((assessData?.items ?? []) as AssessmentDto[]).map((a) => [a.studentId, a]),
  );

  const confirmedCount = roster.filter(
    (r) => assessmentByStudentId.get(r.studentId)?.status === 'confirmed',
  ).length;
  const draftPending = roster.filter(
    (r) => assessmentByStudentId.get(r.studentId)?.status === 'draft',
  );
  const allCommentsConfirmed = roster.length > 0 && confirmedCount === roster.length;
  const evidencePublished =
    evidenceData?.status === 'published' && (evidenceData.photos?.length ?? 0) >= 1;
  const allDoneConditionsMet = hasPresentAttendance && allCommentsConfirmed && evidencePublished;

  async function handleConfirmAll() {
    setConfirmAllBusy(true);
    setConfirmAllError(null);
    try {
      for (const entry of draftPending) {
        const a = assessmentByStudentId.get(entry.studentId)!;
        const draft = catalog
          ? (rubricDrafts[entry.studentId] ?? emptyRubricDraft(catalog))
          : undefined;
        if (catalog && draft && !isDraftComplete(catalog, draft)) {
          throw new Error('Chấm đủ tiêu chí trước khi xác nhận tất cả.');
        }
        await confirmMut.mutateAsync({
          assessmentId: a.id,
          rubric: draft ? toRubricPayload(draft) : undefined,
        });
      }
    } catch (err) {
      setConfirmAllError(err instanceof Error ? err.message : 'Lỗi xác nhận hàng loạt.');
    } finally {
      setConfirmAllBusy(false);
    }
  }

  return (
    <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
      {roster.length > 0 ? (
        <HStack justify="end">
          <Button
            label="Xác nhận tất cả"
            size="sm"
            variant="primary"
            isLoading={confirmAllBusy}
            isDisabled={draftPending.length === 0}
            onClick={() => void handleConfirmAll()}
          />
        </HStack>
      ) : null}

      {confirmAllError ? <Banner status="error" title={confirmAllError} /> : null}

      {!hideDoneBadges && !rosterLoading && !assessLoading && !evidenceLoading ? (
        <HStack gap={1} align="center" style={{ flexWrap: 'wrap' }}>
          <Badge
            label={hasPresentAttendance ? 'Điểm danh ✓' : 'Điểm danh ✗'}
            variant={hasPresentAttendance ? 'success' : 'neutral'}
          />
          <Badge
            label={`Nhận xét: ${confirmedCount}/${roster.length}`}
            variant={allCommentsConfirmed ? 'success' : 'neutral'}
          />
          <Badge
            label={evidencePublished ? 'Ảnh ✓' : 'Ảnh ✗'}
            variant={evidencePublished ? 'success' : 'neutral'}
          />
          {allDoneConditionsMet ? (
            <Badge label="Đủ điều kiện buổi tự chuyển done" variant="success" />
          ) : null}
        </HStack>
      ) : null}

      {(rosterLoading || assessLoading) && <Skeleton height={80} radius={1} />}

      {!rosterLoading && !assessLoading && roster.length === 0 ? (
        <Banner
          status="info"
          title="Chưa có học sinh có mặt"
          description="Điểm danh buổi học trước khi nhận xét (điều kiện 1 của buổi done)."
        />
      ) : null}

      <Stack gap={2}>
        {roster.map((entry) => {
          const assessment = assessmentByStudentId.get(entry.studentId);
          const isConfirmed = assessment?.status === 'confirmed';
          return (
            <Stack
              key={entry.studentId}
              gap={1}
              padding={2}
              style={{
                border: '1px solid var(--cmc-border)',
                borderRadius: 'var(--cmc-radius-control)',
              }}
            >
              <HStack justify="between" align="center">
                <Text type="body" size="sm" weight="medium">
                  <RecordLink entity="student" id={entry.studentId}>
                    {entry.fullName}
                  </RecordLink>
                </Text>
                {isConfirmed ? (
                  <Badge label="Đã xác nhận" variant="success" />
                ) : assessment ? (
                  <Badge label="Nháp AI" variant="warning" />
                ) : (
                  <Badge label="Chưa có nhận xét" variant="neutral" />
                )}
              </HStack>

              {!assessment ? (
                <Button
                  label="Tạo nhận xét AI"
                  size="sm"
                  variant="secondary"
                  style={{ alignSelf: 'flex-start' }}
                  isLoading={draftMut.isPending}
                  onClick={() =>
                    draftMut.mutate({ studentId: entry.studentId, classSessionId: sessionId })
                  }
                />
              ) : null}

              {assessment && !isConfirmed && catalog ? (
                <>
                  <SessionRubricFields
                    catalog={catalog}
                    value={rubricDrafts[entry.studentId] ?? emptyRubricDraft(catalog)}
                    onChange={(next) =>
                      setRubricDrafts((prev) => ({ ...prev, [entry.studentId]: next }))
                    }
                  />
                  <Button
                    label="Xác nhận"
                    size="sm"
                    variant="primary"
                    style={{ alignSelf: 'flex-start' }}
                    isLoading={confirmMut.isPending}
                    isDisabled={!isDraftComplete(catalog, rubricDrafts[entry.studentId] ?? emptyRubricDraft(catalog))}
                    onClick={() =>
                      confirmMut.mutate({
                        assessmentId: assessment.id,
                        rubric: toRubricPayload(
                          rubricDrafts[entry.studentId] ?? emptyRubricDraft(catalog),
                        ),
                      })
                    }
                  />
                </>
              ) : null}

              {isConfirmed && assessment && catalog && assessment.rubric ? (
                <SessionRubricFields
                  catalog={catalog}
                  value={draftFromPayload(catalog, assessment.rubric)}
                  readOnly
                />
              ) : isConfirmed && assessment ? (
                <Text type="body" size="sm">
                  {assessment.content}
                </Text>
              ) : null}
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}

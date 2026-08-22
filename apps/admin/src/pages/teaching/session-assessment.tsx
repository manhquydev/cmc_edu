// Nhận xét per-buổi — HR remediation phase 5 (R2 #C4, session-done engine
// điều kiện 2/3, apps/api/src/class/session-done.ts). Flow: pick lớp → pick
// buổi → roster HS `present` (attendance.listBySession) → AI draft
// (assessment.draftComment) → GV sửa + confirm từng em, hoặc "Xác nhận tất
// cả" (audit: mỗi confirm ghi confirmedById/confirmedAt — assessment/router.ts).
//
// Read companion added this phase: `assessment.listBySession` (no such read
// existed pre-phase-5 — only draft/confirm/discard mutations).
//
// Post-audit fix: tri-state progress display mirrors the 3 session-done
// conditions (session-done.ts's `evaluateSessionDone`) — điểm danh (≥1
// present), nhận xét (x/y confirmed), ảnh (evidence published + ≥1 photo,
// sessionEvidence.getBySession). This is a UI hint only — the server-side
// gate (the sweep worker / inline done-evaluate) is the actual source of
// truth for when a session flips to `done`.

import { useState } from 'react';
import {
  AsyncEntityCombobox,
  Badge,
  Banner,
  Button,
  FormPage,
  HStack,
  PageHeader,
  Selector,
  Skeleton,
  Stack,
  Text,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useClassBatchOptions } from '../../lib/use-class-batch-options.js';
import {
  SessionRubricFields,
  draftFromPayload,
  emptyRubricDraft,
  isDraftComplete,
  toRubricPayload,
  type RubricDraft,
} from './panels/session-rubric-fields.js';

interface RosterEntry {
  studentId: string;
  fullName: string;
}

export default function SessionAssessmentPage() {
  const [classBatchId, setClassBatchId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rubricDrafts, setRubricDrafts] = useState<Record<string, RubricDraft>>({});
  const [confirmAllError, setConfirmAllError] = useState<string | null>(null);
  const [confirmAllBusy, setConfirmAllBusy] = useState(false);

  const { data: sessions, isLoading: sessionsLoading } = trpc.classSession.list.useQuery(
    { classBatchId: classBatchId! },
    { enabled: Boolean(classBatchId) },
  );
  const { data: studentsData } = trpc.classBatch.listStudents.useQuery(
    { classBatchId: classBatchId! },
    { enabled: Boolean(classBatchId) },
  );
  const { data: rosterData, isLoading: rosterLoading } = trpc.attendance.listBySession.useQuery(
    { sessionId: sessionId! },
    { enabled: Boolean(sessionId) },
  );
  const {
    data: assessData,
    isLoading: assessLoading,
    refetch: refetchAssessments,
  } = trpc.assessment.listBySession.useQuery(
    { classSessionId: sessionId! },
    { enabled: Boolean(sessionId) },
  );
  const { data: evidenceData, isLoading: evidenceLoading } = trpc.sessionEvidence.getBySession.useQuery(
    { classSessionId: sessionId! },
    { enabled: Boolean(sessionId) },
  );

  const draftMut = trpc.assessment.draftComment.useMutation({
    onSuccess: () => void refetchAssessments(),
  });
  const confirmMut = trpc.assessment.confirm.useMutation({
    onSuccess: () => void refetchAssessments(),
  });

  const sessionOptions = (sessions ?? []).map((s) => ({
    value: s.id,
    label: `${new Date(s.sessionDate).toLocaleDateString('vi-VN')} | ${s.status}`,
  }));

  const nameByStudentId = new Map(
    ((studentsData ?? []) as Array<{ studentId: string; fullName: string }>).map((s) => [
      s.studentId,
      s.fullName,
    ]),
  );
  const attendanceItems = (rosterData?.items ?? []) as Array<{ studentId: string; status: string | null }>;
  const hasPresentAttendance = attendanceItems.some((r) => r.status === 'present');
  const roster: RosterEntry[] = attendanceItems
    .filter((r) => r.status === 'present')
    .map((r) => ({ studentId: r.studentId, fullName: nameByStudentId.get(r.studentId) ?? r.studentId.slice(0, 8) }));

  const catalog = assessData?.catalog ?? null;

  interface AssessmentDto {
    id: string;
    studentId: string;
    status: string;
    content: string;
    rubric?: { version: 2; scores: Record<string, 1 | 2 | 3 | 4>; narratives?: { strength?: string; weakness?: string; recommendation?: string } } | null;
  }
  const assessmentByStudentId = new Map(
    ((assessData?.items ?? []) as AssessmentDto[]).map((a) => [a.studentId, a]),
  );

  const confirmedCount = roster.filter((r) => assessmentByStudentId.get(r.studentId)?.status === 'confirmed').length;
  const draftPending = roster.filter((r) => assessmentByStudentId.get(r.studentId)?.status === 'draft');
  const allCommentsConfirmed = roster.length > 0 && confirmedCount === roster.length;
  const evidencePublished =
    evidenceData?.status === 'published' && (evidenceData.photos?.length ?? 0) >= 1;
  const allDoneConditionsMet = hasPresentAttendance && allCommentsConfirmed && evidencePublished;

  function resetSession() {
    setSessionId(null);
    setRubricDrafts({});
    setConfirmAllError(null);
  }

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
    <FormPage
      header={
        <PageHeader
          title="Nhận xét buổi học"
          subtitle="Điều kiện để buổi học tự chuyển trạng thái 'done'"
          breadcrumbs={[{ label: 'Giảng dạy', href: '/teaching' }, { label: 'Nhận xét buổi học' }]}
        />
      }
      actions={
        sessionId && roster.length > 0 ? (
          <Button
            label="Xác nhận tất cả"
            size="sm"
            variant="primary"
            isLoading={confirmAllBusy}
            isDisabled={draftPending.length === 0}
            onClick={handleConfirmAll}
          />
        ) : undefined
      }
      result={confirmAllError ? <Banner status="error" title={confirmAllError} /> : undefined}
    >
      <Stack gap={4} style={{ maxWidth: 720 }}>
        {/* Step 1: pick class */}
        <div>
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 'var(--cmc-space-1)' }}>
            1. Chọn lớp
          </Text>
          <AsyncEntityCombobox
            label="Chọn lớp học"
            isLabelHidden
            placeholder="Chọn lớp học"
            value={classBatchId ?? null}
            onChange={(v) => { setClassBatchId(v); resetSession(); }}
            useOptions={useClassBatchOptions}
            pinnedLabel={(id) => `Lớp đã chọn (${id.slice(0, 8)}…)`}
          />
        </div>

        {/* Step 2: pick session */}
        {classBatchId && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 'var(--cmc-space-1)' }}>
              2. Chọn buổi học
            </Text>
            {sessionsLoading ? (
              <Skeleton height={36} radius={1} />
            ) : (
              <Selector
                label="Chọn buổi học"
                isLabelHidden
                placeholder="Chọn buổi"
                options={sessionOptions}
                value={sessionId ?? undefined}
                onChange={(v) => { setSessionId(v ?? null); setRubricDrafts({}); setConfirmAllError(null); }}
                hasClear={false}
              />
            )}
          </div>
        )}

        {/* Step 3: roster + per-student assessment */}
        {sessionId && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 'var(--cmc-space-1)' }}>
              3. Nhận xét học sinh có mặt
            </Text>

            {!rosterLoading && !assessLoading && !evidenceLoading && (
              <HStack gap={1} align="center" style={{ marginBottom: 'var(--cmc-space-2)', flexWrap: 'wrap' }}>
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
                {allDoneConditionsMet && (
                  <Badge label="Đủ điều kiện buổi tự chuyển done" variant="success" />
                )}
              </HStack>
            )}

            {(rosterLoading || assessLoading) && <Skeleton height={80} radius={1} />}

            {!rosterLoading && !assessLoading && roster.length === 0 && (
              <Banner
                status="info"
                title="Chưa có học sinh có mặt"
                description="Điểm danh buổi học trước khi nhận xét (điều kiện 1 của buổi done)."
              />
            )}

            <Stack gap={2}>
              {roster.map((entry) => {
                const assessment = assessmentByStudentId.get(entry.studentId);
                const isConfirmed = assessment?.status === 'confirmed';
                return (
                  <Stack key={entry.studentId} gap={1} padding={2} style={{ border: '1px solid var(--cmc-border)', borderRadius: 'var(--cmc-radius-control)' }}>
                    <HStack justify="between" align="center">
                      <Text type="body" size="sm" weight="medium">{entry.fullName}</Text>
                      {isConfirmed ? (
                        <Badge label="Đã xác nhận" variant="success" />
                      ) : assessment ? (
                        <Badge label="Nháp AI" variant="warning" />
                      ) : (
                        <Badge label="Chưa có nhận xét" variant="neutral" />
                      )}
                    </HStack>

                    {!assessment && (
                      <Button
                        label="Tạo nhận xét AI"
                        size="sm"
                        variant="secondary"
                        style={{ alignSelf: 'flex-start' }}
                        isLoading={draftMut.isPending}
                        onClick={() => draftMut.mutate({ studentId: entry.studentId, classSessionId: sessionId })}
                      />
                    )}

                    {assessment && !isConfirmed && catalog && (
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
                    )}

                    {isConfirmed && catalog && assessment.rubric ? (
                      <SessionRubricFields
                        catalog={catalog}
                        value={draftFromPayload(catalog, assessment.rubric)}
                        readOnly
                      />
                    ) : isConfirmed ? (
                      <Text type="body" size="sm">{assessment.content}</Text>
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>
          </div>
        )}
      </Stack>
    </FormPage>
  );
}

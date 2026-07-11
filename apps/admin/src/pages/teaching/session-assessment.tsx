// Nhận xét per-buổi — HR remediation phase 5 (R2 #C4, session-done engine
// điều kiện 2/3, apps/api/src/class/session-done.ts). Flow: pick lớp → pick
// buổi → roster HS `present` (attendance.listBySession) → AI draft
// (assessment.draftComment) → GV sửa + confirm từng em, hoặc "Xác nhận tất
// cả" (audit: mỗi confirm ghi confirmedById/confirmedAt — assessment/router.ts).
//
// Read companion added this phase: `assessment.listBySession` (no such read
// existed pre-phase-5 — only draft/confirm/discard mutations).

import { useState } from 'react';
import {
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
  TextArea,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface RosterEntry {
  studentId: string;
  fullName: string;
}

export default function SessionAssessmentPage() {
  const [classBatchId, setClassBatchId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [confirmAllError, setConfirmAllError] = useState<string | null>(null);
  const [confirmAllBusy, setConfirmAllBusy] = useState(false);

  const { data: classData, isLoading: classLoading } = trpc.classBatch.list.useQuery({
    page: 1,
    pageSize: 100,
  });
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

  const draftMut = trpc.assessment.draftComment.useMutation({
    onSuccess: () => void refetchAssessments(),
  });
  const confirmMut = trpc.assessment.confirm.useMutation({
    onSuccess: () => void refetchAssessments(),
  });

  const classOptions = (classData?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.program}`,
  }));
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
  const roster: RosterEntry[] = ((rosterData?.items ?? []) as Array<{ studentId: string; status: string | null }>)
    .filter((r) => r.status === 'present')
    .map((r) => ({ studentId: r.studentId, fullName: nameByStudentId.get(r.studentId) ?? r.studentId.slice(0, 8) }));

  interface AssessmentDto {
    id: string;
    studentId: string;
    status: string;
    content: string;
  }
  const assessmentByStudentId = new Map(
    ((assessData?.items ?? []) as AssessmentDto[]).map((a) => [a.studentId, a]),
  );

  const confirmedCount = roster.filter((r) => assessmentByStudentId.get(r.studentId)?.status === 'confirmed').length;
  const draftPending = roster.filter((r) => assessmentByStudentId.get(r.studentId)?.status === 'draft');

  function resetSession() {
    setSessionId(null);
    setEdited({});
    setConfirmAllError(null);
  }

  function contentFor(studentId: string, assessment: AssessmentDto | undefined): string {
    return edited[studentId] ?? assessment?.content ?? '';
  }

  async function handleConfirmAll() {
    setConfirmAllBusy(true);
    setConfirmAllError(null);
    try {
      for (const entry of draftPending) {
        const a = assessmentByStudentId.get(entry.studentId)!;
        await confirmMut.mutateAsync({ assessmentId: a.id, content: contentFor(entry.studentId, a) });
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
          subtitle="Nhận xét cho học sinh có mặt trong buổi — điều kiện để buổi tự chuyển 'done'"
          breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Nhận xét buổi học' }]}
        />
      }
      actions={
        sessionId && roster.length > 0 ? (
          <HStack gap={1} align="center">
            <Text type="supporting" size="sm">
              Nhận xét: {confirmedCount}/{roster.length}
            </Text>
            <Button
              label="Xác nhận tất cả"
              size="sm"
              variant="primary"
              isLoading={confirmAllBusy}
              isDisabled={draftPending.length === 0}
              onClick={handleConfirmAll}
            />
          </HStack>
        ) : undefined
      }
      result={confirmAllError ? <Banner status="error" title={confirmAllError} /> : undefined}
    >
      <Stack gap={4} style={{ maxWidth: 720 }}>
        {/* Step 1: pick class */}
        <div>
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
            1. Chọn lớp
          </Text>
          {classLoading ? (
            <Skeleton height={36} radius={1} />
          ) : (
            <Selector
              label="Chọn lớp học"
              isLabelHidden
              placeholder="Chọn lớp học"
              options={classOptions}
              value={classBatchId ?? undefined}
              onChange={(v) => { setClassBatchId(v ?? null); resetSession(); }}
              hasSearch
              hasClear={false}
            />
          )}
        </div>

        {/* Step 2: pick session */}
        {classBatchId && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
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
                onChange={(v) => { setSessionId(v ?? null); setEdited({}); setConfirmAllError(null); }}
                hasClear={false}
              />
            )}
          </div>
        )}

        {/* Step 3: roster + per-student assessment */}
        {sessionId && (
          <div>
            <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
              3. Nhận xét học sinh có mặt
            </Text>

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
                  <Stack key={entry.studentId} gap={1} padding={2} style={{ border: '1px solid var(--cmc-border)', borderRadius: 'var(--cmc-radius-sm)' }}>
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

                    {assessment && !isConfirmed && (
                      <>
                        <TextArea
                          label={`Nhận xét — ${entry.fullName}`}
                          isLabelHidden
                          value={contentFor(entry.studentId, assessment)}
                          onChange={(v) => setEdited((prev) => ({ ...prev, [entry.studentId]: v }))}
                          rows={2}
                        />
                        <Button
                          label="Xác nhận"
                          size="sm"
                          variant="primary"
                          style={{ alignSelf: 'flex-start' }}
                          isLoading={confirmMut.isPending}
                          onClick={() =>
                            confirmMut.mutate({
                              assessmentId: assessment.id,
                              content: contentFor(entry.studentId, assessment),
                            })
                          }
                        />
                      </>
                    )}

                    {isConfirmed && (
                      <Text type="body" size="sm">{assessment.content}</Text>
                    )}
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

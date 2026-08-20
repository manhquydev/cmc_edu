/**
 * Teacher Session Detail hub — ClassSession as work object (RCWS).
 * /teaching/sessions/:sessionId?tab=overview|attendance|assessment|evidence
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  CmcTabs,
  DetailPage,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  PageHeader,
  SectionBlock,
  Spinner,
  Stack,
  StatusBadge,
  Text,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { RecordLink } from '../../lib/record-link.js';
import { AttendancePanel } from './panels/attendance-panel.js';
import { AssessmentPanel } from './panels/assessment-panel.js';
import { EvidencePanel } from './panels/evidence-panel.js';

const TABS = ['overview', 'attendance', 'assessment', 'evidence'] as const;
type TabId = (typeof TABS)[number];

function isTab(v: string | null): v is TabId {
  return v != null && (TABS as readonly string[]).includes(v);
}

function fmtRange(start: Date | string, end: Date | string): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return `${new Date(start).toLocaleString('vi-VN', opts)} – ${new Date(end).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const canCancelRestamp = canDo('schedule', 'generate');
  const canDeliver = canDo('exercise', 'manage');
  const canViewStaff = canDo('user', 'manage') || canDo('staff', 'pickList');

  const rawTab = searchParams.get('tab');
  const activeTab: TabId = isTab(rawTab) ? rawTab : 'attendance';

  const {
    data: session,
    isLoading,
    error,
  } = trpc.classSession.get.useQuery(
    { sessionId: sessionId ?? '' },
    { enabled: Boolean(sessionId) },
  );

  const { data: progress } = trpc.classSession.doneProgress.useQuery(
    { sessionId: sessionId ?? '' },
    { enabled: Boolean(sessionId) },
  );

  const { data: delivery } = trpc.lmsOps.sessionDeliveryStatus.useQuery(
    { classSessionId: sessionId ?? '' },
    { enabled: Boolean(sessionId) && canDeliver },
  );

  const utils = trpc.useUtils();
  const [deliverFalseReason, setDeliverFalseReason] = useState<string | null>(null);
  const cancelRestamp = trpc.lmsOps.cancelSessionAndRestamp.useMutation({
    onSuccess: async () => {
      await utils.classSession.get.invalidate({ sessionId: sessionId ?? '' });
      await utils.classSession.doneProgress.invalidate({ sessionId: sessionId ?? '' });
      await utils.lmsOps.rosterForSession.invalidate({ classSessionId: sessionId ?? '' });
      await utils.attendance.listBySession.invalidate({ sessionId: sessionId ?? '' });
    },
  });

  const deliverMut = trpc.lmsOps.deliverSessionExercise.useMutation({
    onSuccess: async (res) => {
      if (res.delivered === false) {
        setDeliverFalseReason(res.reason);
        return;
      }
      setDeliverFalseReason(null);
      await utils.lmsOps.sessionDeliveryStatus.invalidate({ classSessionId: sessionId ?? '' });
    },
  });

  useEffect(() => {
    cancelRestamp.reset();
    deliverMut.reset();
    setDeliverFalseReason(null);
  }, [sessionId]);

  function setTab(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  const progressLabel = useMemo(() => {
    if (!progress) return '…';
    if (progress.eligible || progress.status === 'done') return 'Đủ điều kiện done';
    const parts = [
      progress.attendanceOk ? 'Điểm danh ✓' : 'Điểm danh ✗',
      progress.assessmentOk
        ? `Nhận xét ✓ ${progress.assessmentsConfirmed}/${progress.assessmentsRequired}`
        : `Nhận xét ${progress.assessmentsConfirmed}/${progress.assessmentsRequired}`,
      progress.evidenceOk ? 'Nhật ký ✓' : 'Nhật ký ✗',
    ];
    return parts.join(' · ');
  }, [progress]);

  if (!sessionId) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Giảng dạy', href: '/teaching' },
              { label: 'Lịch dạy', href: '/teaching/schedule' },
              { label: 'Buổi học' },
            ]}
          />
        }
      >
        <Banner status="warning" title="Thiếu mã buổi học" description="URL không có sessionId." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Giảng dạy', href: '/teaching' },
              { label: 'Lịch dạy', href: '/teaching/schedule' },
              { label: '…' },
            ]}
          />
        }
      >
        <Stack hAlign="center" gap={2} style={{ paddingBlock: 'var(--cmc-space-4)' }}>
          <Spinner size="md" />
          <Text type="supporting" size="sm">
            Đang tải buổi học…
          </Text>
        </Stack>
      </DetailPage>
    );
  }

  if (error || !session) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Giảng dạy', href: '/teaching' },
              { label: 'Lịch dạy', href: '/teaching/schedule' },
              { label: 'Lỗi' },
            ]}
          />
        }
      >
        <Banner
          status="error"
          title="Không tải được buổi học"
          description={error?.message ?? 'Buổi không tồn tại hoặc không có quyền.'}
        />
      </DetailPage>
    );
  }

  const title = session.batchCode || session.classBatchId.slice(0, 8);
  const timeRange = fmtRange(session.startTime, session.endTime);
  const shortId = session.id.slice(0, 8);
  const statusLabel = session.status;
  const deliverReady = Boolean(
    delivery &&
      !delivery.cancelled &&
      delivery.ended &&
      delivery.hasUnit &&
      !delivery.hasDelivery &&
      delivery.sequenceLength > 0 &&
      delivery.nextPositionExists,
  );

  const overview = (
    <div className="console-detail-panel">
      <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
        <SectionBlock
          title="Thông tin buổi học"
          description="Cùng khung form chứng từ Console — tab điểm danh / nhận xét / nhật ký giữ nguyên."
        >
          <KeyValueList
            items={[
              {
                key: 'class',
                label: 'Lớp',
                value: (
                  <RecordLink entity="classBatch" id={session.classBatchId}>
                    {title}
                  </RecordLink>
                ),
              },
              { key: 'program', label: 'Chương trình', value: session.program ?? '—' },
              {
                key: 'teacher',
                label: 'Giáo viên',
                value: (
                  <RecordLink
                    entity="staff"
                    id={session.teacherAppUserId}
                    canView={canViewStaff}
                  >
                    {session.teacherFullName ?? '—'}
                  </RecordLink>
                ),
              },
              { key: 'time', label: 'Thời gian', value: timeRange },
              { key: 'status', label: 'Trạng thái', value: statusLabel },
              { key: 'progress', label: 'Tiến độ session-done', value: progressLabel },
            ]}
          />
        </SectionBlock>

        {progress ? (
          <HStack gap={1} style={{ flexWrap: 'wrap' }}>
            <Badge
              label={
                progress.attendanceOk
                  ? `Điểm danh ✓ (${progress.presentCount})`
                  : 'Điểm danh ✗'
              }
              variant={progress.attendanceOk ? 'success' : 'neutral'}
            />
            <Badge
              label={`Nhận xét ${progress.assessmentsConfirmed}/${progress.assessmentsRequired}`}
              variant={progress.assessmentOk ? 'success' : 'neutral'}
            />
            <Badge
              label={progress.evidenceOk ? `Ảnh ✓ (${progress.photoCount})` : 'Ảnh ✗'}
              variant={progress.evidenceOk ? 'success' : 'neutral'}
            />
            <Badge
              label={progress.timeGatePassed ? 'Đã qua endTime' : 'Chưa endTime'}
              variant={progress.timeGatePassed ? 'success' : 'neutral'}
            />
          </HStack>
        ) : null}

        <HStack gap={2} style={{ flexWrap: 'wrap' }}>
          <Button
            label="Điểm danh"
            size="sm"
            variant="primary"
            onClick={() => setTab('attendance')}
          />
          <Button
            label="Nhận xét"
            size="sm"
            variant="secondary"
            onClick={() => setTab('assessment')}
          />
          <Button
            label="Nhật ký"
            size="sm"
            variant="secondary"
            onClick={() => setTab('evidence')}
          />
          <Button
            label="Lớp học"
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/admin/classes/${session.classBatchId}`)}
          />
          {canCancelRestamp && session.status !== 'cancelled' && session.status !== 'done' ? (
            <Button
              label={cancelRestamp.isPending ? 'Đang hủy…' : 'Hủy buổi + restamp unit'}
              size="sm"
              variant="secondary"
              isLoading={cancelRestamp.isPending}
              isDisabled={cancelRestamp.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Hủy buổi này và restamp unit cho các buổi còn lại?',
                  )
                ) {
                  return;
                }
                cancelRestamp.mutate({ classSessionId: session.id });
              }}
            />
          ) : null}
        </HStack>

        {cancelRestamp.isError ? (
          <Banner
            status="error"
            title="Không hủy được buổi"
            description={cancelRestamp.error.message}
          />
        ) : null}
        {cancelRestamp.isSuccess ? (
          <Banner
            status="success"
            title="Đã hủy buổi"
            description={`Restamp ${cancelRestamp.data.restamped} buổi.`}
          />
        ) : null}
      </Stack>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Tổng quan', content: overview },
    {
      id: 'attendance',
      label: 'Điểm danh',
      content: (
        <AttendancePanel sessionId={session.id} classBatchId={session.classBatchId} embedded />
      ),
    },
    {
      id: 'assessment',
      label: 'Nhận xét',
      content: (
        <AssessmentPanel
          sessionId={session.id}
          classBatchId={session.classBatchId}
          hideDoneBadges
        />
      ),
    },
    {
      id: 'evidence',
      label: 'Nhật ký',
      content: <EvidencePanel sessionId={session.id} />,
    },
  ];

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Giảng dạy', href: '/teaching' },
            { label: 'Lịch dạy', href: '/teaching/schedule' },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} style={{ flexWrap: 'wrap' }}>
              <CopyLinkButton mode="go" entity="classSession" id={session.id} />
              <Button
                label="Về lịch"
                size="sm"
                variant="ghost"
                onClick={() => navigate('/teaching/schedule')}
              />
            </HStack>
          }
        />
      }
      entity={
        <EntityHeader
          title={title}
          subtitle={`${session.program ? `${session.program} · ` : ''}${timeRange}`}
          initials={title.slice(0, 2).toUpperCase()}
          badges={<StatusBadge status={session.status} label={session.status} />}
          meta={<span style={{ fontSize: 'var(--cmc-font-size-data)' }}>{progressLabel}</span>}
          actions={
            <HStack gap={1} wrap="wrap">
              {canDeliver ? (
                <Button
                  label={delivery?.hasDelivery ? 'Đã phát bài' : 'Phát bài'}
                  size="sm"
                  variant="primary"
                  isDisabled={!deliverReady || deliverMut.isPending}
                  isLoading={deliverMut.isPending}
                  onClick={() => deliverMut.mutate({ classSessionId: session.id })}
                />
              ) : null}
              <Button
                label="Điểm danh"
                size="sm"
                variant="primary"
                onClick={() => setTab('attendance')}
              />
              <Button
                label="Nhận xét"
                size="sm"
                variant="secondary"
                onClick={() => setTab('assessment')}
              />
            </HStack>
          }
        />
      }
      summary={
        <HighlightStrip
          items={[
            {
              key: 'status',
              label: 'Trạng thái',
              value: <StatusBadge status={session.status} label={statusLabel} />,
            },
            { key: 'time', label: 'Thời gian', value: timeRange },
            { key: 'progress', label: 'Session-done', value: progressLabel },
          ]}
        />
      }
      tabs={<CmcTabs tabs={tabs} activeTab={activeTab} onTabChange={setTab} />}
    >
      {canDeliver && (deliverMut.isError || deliverFalseReason || (deliverMut.isSuccess && !deliverFalseReason)) ? (
        <Stack gap={2} style={{ paddingInline: 'var(--cmc-space-3)', paddingBottom: 'var(--cmc-space-2)' }}>
          {deliverMut.isError ? (
            <Banner
              status="error"
              title="Không phát được bài"
              description={deliverMut.error.message}
            />
          ) : null}
          {deliverFalseReason ? (
            <Banner
              status="error"
              title="Không phát được bài"
              description={
                deliverFalseReason === 'no_sequence_or_exhausted'
                  ? 'Dãy bài trống hoặc đã hết vị trí.'
                  : deliverFalseReason
              }
            />
          ) : null}
          {deliverMut.isSuccess && !deliverFalseReason ? (
            <Banner status="success" title="Đã phát bài" />
          ) : null}
        </Stack>
      ) : null}
    </DetailPage>
  );
}

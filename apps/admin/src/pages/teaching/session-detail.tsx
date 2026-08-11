/**
 * Teacher Session Detail hub — ClassSession as work object (RCWS).
 * /teaching/sessions/:sessionId?tab=overview|attendance|assessment|evidence
 */
import { useEffect, useMemo } from 'react';
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

  const utils = trpc.useUtils();
  const cancelRestamp = trpc.lmsOps.cancelSessionAndRestamp.useMutation({
    onSuccess: async () => {
      await utils.classSession.get.invalidate({ sessionId: sessionId ?? '' });
      await utils.classSession.doneProgress.invalidate({ sessionId: sessionId ?? '' });
      await utils.lmsOps.rosterForSession.invalidate({ classSessionId: sessionId ?? '' });
      await utils.attendance.listBySession.invalidate({ sessionId: sessionId ?? '' });
    },
  });

  useEffect(() => {
    cancelRestamp.reset();
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
            title="Buổi học"
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
            title="Buổi học"
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
            title="Buổi học"
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
  const statusLabel = session.isMakeup ? `${session.status} · buổi bù` : session.status;

  const overview = (
    <div className="console-detail-panel">
      <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
        <SectionBlock
          title="Thông tin buổi học"
          description="Cùng khung form chứng từ Console — tab điểm danh / nhận xét / nhật ký giữ nguyên."
        >
          <KeyValueList
            items={[
              { key: 'class', label: 'Lớp', value: title },
              { key: 'program', label: 'Chương trình', value: session.program ?? '—' },
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
                    'Hủy buổi này và restamp unit cho các buổi còn lại? Không tạo buổi bù.',
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
            description={`Restamp ${cancelRestamp.data.restamped} buổi (không makeup).`}
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
          meta={<span style={{ fontSize: 12 }}>{progressLabel}</span>}
          actions={
            <HStack gap={1} wrap="wrap">
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
      {null}
    </DetailPage>
  );
}

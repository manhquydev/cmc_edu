/**
 * Teacher Session Detail hub — ClassSession as work object (RCWS).
 * Browse: /teaching/schedule → open /teaching/sessions/:sessionId?tab=
 * Tabs: overview | attendance | assessment | evidence
 */
import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Banner,
  Button,
  CmcTabs,
  DetailPage,
  EntityHeader,
  KeyValueList,
  PageHeader,
  SectionBlock,
  Spinner,
  Stack,
  StatusBadge,
  Text,
  WorkflowStatusbar,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
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

  function setTab(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  // ProgressSteps: i < activeIndex = done; i === activeIndex = current.
  // Order: Điểm danh → Nhận xét → Nhật ký → Done.
  const progressIndex = useMemo(() => {
    if (!progress) return 0;
    if (progress.eligible || progress.status === 'done') return 3;
    // All three conditions met but time-gate / sweep pending → Done is current.
    if (progress.attendanceOk && progress.assessmentOk && progress.evidenceOk) return 3;
    if (progress.attendanceOk && progress.assessmentOk) return 2;
    if (progress.attendanceOk) return 1;
    return 0;
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
  const subtitle = session.program || undefined;

  const overview = (
    <div className="tpl-detail-panel">
      <div className="tpl-detail-stack">
        <SectionBlock title="Thông tin buổi" description="Bản ghi ClassSession — điểm vào các thao tác ngày dạy.">
          <KeyValueList
            items={[
              { key: 'code', label: 'Lớp', value: title },
              { key: 'program', label: 'Chương trình', value: session.program || '—' },
              {
                key: 'time',
                label: 'Thời gian',
                value: fmtRange(session.startTime, session.endTime),
              },
              {
                key: 'status',
                label: 'Trạng thái',
                value: <StatusBadge status={session.status} label={session.status} />,
              },
              {
                key: 'makeup',
                label: 'Buổi bù',
                value: session.isMakeup ? 'Có' : 'Không',
              },
            ]}
          />
        </SectionBlock>
        {progress ? (
          <SectionBlock title="Tiến độ hoàn tất buổi (session-done)">
            <KeyValueList
              items={[
                {
                  key: 'att',
                  label: 'Điểm danh',
                  value: progress.attendanceOk
                    ? `✓ ${progress.presentCount} có mặt`
                    : '✗ Chưa có present',
                },
                {
                  key: 'asm',
                  label: 'Nhận xét',
                  value: progress.assessmentOk
                    ? `✓ ${progress.assessmentsConfirmed}/${progress.assessmentsRequired}`
                    : `${progress.assessmentsConfirmed}/${progress.assessmentsRequired} confirmed`,
                },
                {
                  key: 'ev',
                  label: 'Nhật ký / ảnh',
                  value: progress.evidenceOk
                    ? `✓ published · ${progress.photoCount} ảnh`
                    : progress.evidencePublished
                      ? `published nhưng thiếu ảnh`
                      : '✗ Chưa công bố',
                },
                {
                  key: 'time',
                  label: 'Cổng giờ (endTime)',
                  value: progress.timeGatePassed ? '✓ Đã qua giờ kết thúc' : 'Chưa đến endTime',
                },
                {
                  key: 'elig',
                  label: 'Đủ điều kiện done',
                  value: progress.eligible ? 'Có' : 'Chưa',
                },
              ]}
            />
          </SectionBlock>
        ) : null}
        <SectionBlock title="Thao tác nhanh">
          <Stack gap={2} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button label="Điểm danh" size="sm" variant="primary" onClick={() => setTab('attendance')} />
            <Button label="Nhận xét" size="sm" variant="secondary" onClick={() => setTab('assessment')} />
            <Button label="Nhật ký" size="sm" variant="secondary" onClick={() => setTab('evidence')} />
            <Button
              label="Lớp học"
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/admin/classes/${session.classBatchId}`)}
            />
          </Stack>
        </SectionBlock>
      </div>
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
            { label: title },
          ]}
        />
      }
      entity={
        <EntityHeader
          title={title}
          subtitle={subtitle}
          initials={title.slice(0, 2).toUpperCase()}
          badges={
            <>
              <StatusBadge status={session.status} label={session.status} />
              {session.isMakeup ? <StatusBadge status="planned" label="Buổi bù" /> : null}
            </>
          }
          meta={fmtRange(session.startTime, session.endTime)}
        />
      }
      summary={
        <WorkflowStatusbar
          steps={[
            { id: 'att', label: 'Điểm danh' },
            { id: 'asm', label: 'Nhận xét' },
            { id: 'ev', label: 'Nhật ký' },
            { id: 'done', label: 'Done' },
          ]}
          activeIndex={progressIndex}
          onStepClick={(i) => {
            if (i === 0) setTab('attendance');
            else if (i === 1) setTab('assessment');
            else if (i === 2) setTab('evidence');
            else setTab('overview');
          }}
        />
      }
      tabs={<CmcTabs tabs={tabs} activeTab={activeTab} onTabChange={setTab} />}
    />
  );
}

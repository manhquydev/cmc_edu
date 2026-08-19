import { useState } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  DetailPage,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatusBadge,
  useToast,
} from '@cmc/ui';
import { UUID_RE, parentMeetingSectionPath } from '@cmc/links';
import { trpc } from '../../lib/trpc.js';
import { CompleteParentMeetingDialog } from './complete-parent-meeting-dialog.js';
import { ParentMeetingActivitySection } from './parent-meeting-activity.js';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Đã đặt lịch',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

function fmtDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ParentMeetingDetailPage() {
  const { meetingId = '', section } = useParams<{ meetingId: string; section?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { success: toastSuccess } = useToast();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const idOk = UUID_RE.test(meetingId);
  const { data, isLoading, error, refetch } = trpc.parentMeeting.get.useQuery(
    { meetingId },
    { enabled: idOk },
  );
  const cancelMutation = trpc.parentMeeting.cancel.useMutation({
    onSuccess: () => {
      setCancelOpen(false);
      toastSuccess('Đã huỷ cuộc họp.');
      void refetch();
    },
  });

  if (!idOk) {
    return (
      <DetailPage header={<PageHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Họp sau bán' }, { label: 'ID không hợp lệ' }]} />}>
        <Banner status="error" title="ID không hợp lệ" description="URL cần UUID cuộc họp." />
      </DetailPage>
    );
  }
  if (isLoading) {
    return <DetailPage header={<PageHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Họp sau bán' }, { label: '…' }]} />}><ResultPanel status="loading" title="Đang tải cuộc họp…" /></DetailPage>;
  }
  if (error || !data) {
    return (
      <DetailPage header={<PageHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Họp sau bán', href: '/crm/post-sale-meeting' }, { label: 'Không tìm thấy' }]} />}>
        <Banner status="error" title="Không tìm thấy cuộc họp" description={error?.message ?? 'Cuộc họp không tồn tại hoặc không thuộc cơ sở hiện tại.'} />
      </DetailPage>
    );
  }

  const overview = (
    <div className="console-detail-panel">
      <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
        {cancelMutation.error ? <Banner status="error" title="Huỷ cuộc họp thất bại" description={cancelMutation.error.message} /> : null}
        <SectionBlock title="Thông tin cuộc họp" description="Hồ sơ chi tiết cuộc họp phụ huynh theo cơ sở.">
          <KeyValueList
            items={[
              { key: 'student', label: 'Học viên', value: data.studentName ?? '—' },
              { key: 'scheduledAt', label: 'Thời gian', value: fmtDateTime(data.scheduledAt) },
              { key: 'status', label: 'Trạng thái', value: STATUS_LABELS[data.status] ?? data.status },
              { key: 'createdAt', label: 'Ngày tạo', value: fmtDateTime(data.createdAt) },
              { key: 'result', label: 'Kết quả', value: data.result ?? 'Chưa ghi nhận' },
            ]}
          />
        </SectionBlock>
        {data.status === 'scheduled' ? (
          <HStack gap={1}>
            <Button label="Hoàn thành" variant="primary" size="sm" onClick={() => setCompleteOpen(true)} />
            <Button label="Huỷ cuộc họp" variant="secondary" size="sm" onClick={() => setCancelOpen(true)} />
          </HStack>
        ) : null}
      </Stack>
    </div>
  );
  const activeSection = section === 'activity' ? 'activity' : 'overview';
  const content = activeSection === 'activity' ? <ParentMeetingActivitySection meetingId={meetingId} /> : overview;

  return (
    <>
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'CRM' },
              { label: 'Họp sau bán', href: '/crm/post-sale-meeting' },
              { label: meetingId.slice(0, 8) },
            ]}
            actions={
              <Button
                label="← Danh sách"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/crm/post-sale-meeting')}
              />
            }
          />
        }
        entity={<EntityHeader title={data.studentName ?? 'Cuộc họp phụ huynh'} subtitle={fmtDateTime(data.scheduledAt)} initials="HH" badges={<StatusBadge status={data.status} label={STATUS_LABELS[data.status] ?? data.status} />} />}
        summary={<HighlightStrip items={[{ key: 'student', label: 'Học viên', value: data.studentName ?? '—' }, { key: 'time', label: 'Thời gian', value: fmtDateTime(data.scheduledAt) }, { key: 'status', label: 'Trạng thái', value: STATUS_LABELS[data.status] ?? data.status }]} />}
        tabs={<nav className="console-section-tabs" aria-label="Phân đoạn cuộc họp"><NavLink to={{ pathname: parentMeetingSectionPath(meetingId, 'overview'), search: location.search }} end>Tổng quan</NavLink><NavLink to={{ pathname: parentMeetingSectionPath(meetingId, 'activity'), search: location.search }} end>Lịch sử vận hành</NavLink></nav>}
        children={content}
      />
      <CompleteParentMeetingDialog meetingId={completeOpen ? meetingId : null} onClose={() => { setCompleteOpen(false); void refetch(); }} />
      <ConfirmDialog opened={cancelOpen} title="Huỷ cuộc họp?" message="Cuộc họp sẽ chuyển sang trạng thái đã huỷ và không thể huỷ lần nữa." confirmLabel="Huỷ cuộc họp" confirmColor="red" loading={cancelMutation.isPending} onConfirm={() => cancelMutation.mutate({ meetingId })} onCancel={() => setCancelOpen(false)} />
    </>
  );
}

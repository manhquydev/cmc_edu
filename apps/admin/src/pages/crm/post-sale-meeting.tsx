import { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  HStack,
  LineIcon,
  ListPage,
  ListPagination,
  PageHeader,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useParentMeetingActions } from './use-parent-meeting-actions.js';
import { ScheduleParentMeetingDialog } from './schedule-parent-meeting-dialog.js';
import { CompleteParentMeetingDialog } from './complete-parent-meeting-dialog.js';

const PAGE_SIZE = 20;

type BadgeVariant = ComponentProps<typeof Badge>['variant'];
type MeetingStatus = 'scheduled' | 'done' | 'cancelled';
type StatusFilter = 'all' | MeetingStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'scheduled', label: 'Đã đặt lịch' },
  { value: 'done', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const MEETING_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: STATUS_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({
      value: o.value,
      label: o.label,
    })),
    placeholder: 'Tất cả',
  },
];

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Đã đặt lịch',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const STATUS_VARIANT: Record<MeetingStatus, BadgeVariant> = {
  scheduled: 'blue',
  done: 'success',
  cancelled: 'error',
};

function fmtDateTime(v: string): string {
  return new Date(v).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// NOTE: `parentMeeting.list` deliberately never returns `remindedAt` (that
// column is dropped in phase 10, apps/api/src/meeting/router.ts) — this row
// shape and every render below must never reference it.
interface MeetingRow {
  id: string;
  studentId: string;
  studentName: string | null;
  scheduledAt: string;
  status: string;
  result: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export default function PostSaleMeetingPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ status: '' });
  const [page, setPage] = useState(1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completeMeetingId, setCompleteMeetingId] = useState<string | null>(null);

  const statusRaw = filters.status ?? '';
  const status: StatusFilter =
    statusRaw && STATUS_FILTER_OPTIONS.some((o) => o.value === statusRaw)
      ? (statusRaw as StatusFilter)
      : 'all';

  const { data, isLoading, error } = trpc.parentMeeting.list.useQuery({
    ...(status !== 'all' ? { status } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const { cancelMutation } = useParentMeetingActions();

  const rows = (data?.items ?? []) as MeetingRow[];
  const total = data?.total ?? 0;

  const columns: TableColumn<MeetingRow>[] = [
    { key: 'studentName', label: 'Học viên', render: (v) => (v as string | null) ?? '—' },
    {
      key: 'scheduledAt',
      label: 'Thời gian họp',
      width: 170,
      render: (v) => fmtDateTime(String(v)),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 140,
      render: (v) => (
        <Badge
          label={STATUS_LABELS[String(v) as MeetingStatus] ?? String(v)}
          variant={STATUS_VARIANT[String(v) as MeetingStatus] ?? 'neutral'}
        />
      ),
    },
    { key: 'result', label: 'Kết quả', render: (v) => (v as string | null) ?? '—' },
    {
      key: 'id',
      label: 'Hành động',
      width: 200,
      render: (_v, row) =>
        row.status === 'scheduled' ? (
          <HStack gap={1}>
            <Button label="Hoàn thành" size="sm" variant="secondary" onClick={() => setCompleteMeetingId(row.id)} />
            <Button
              label="Hủy"
              size="sm"
              variant="ghost"
              isLoading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ meetingId: row.id })}
            />
          </HStack>
        ) : null,
    },
  ];

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Họp phụ huynh sau bán"
            subtitle="Lên lịch và theo dõi họp phụ huynh sau khi ký hợp đồng"
            breadcrumbs={[{ label: 'CRM' }, { label: 'Họp sau bán' }]}
            actions={
              <Button
                label="Đặt lịch họp"
                size="sm"
                variant="primary"
                endContent={<LineIcon name="plus" size={14} />}
                onClick={() => setScheduleOpen(true)}
              />
            }
          />
        }
        filters={
          <FilterBar
            filters={MEETING_FILTERS}
            value={filters}
            onChange={(next) => {
              setFilters({ status: next.status ?? '' });
              setPage(1);
            }}
          />
        }
        controlFooter={
          <ListPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        }
      >
        <DataTable<MeetingRow>
          columns={columns}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có lịch họp phụ huynh nào"
        />
      </ListPage>

      <ScheduleParentMeetingDialog opened={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <CompleteParentMeetingDialog meetingId={completeMeetingId} onClose={() => setCompleteMeetingId(null)} />
    </>
  );
}

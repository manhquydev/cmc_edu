import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  DataTable,
  FilterBar,
  ListPage,
  ListPagination,
  PageHeader,
  StatusBadge,
  Text,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { links } from '@cmc/links';
import { trpc } from '../../lib/trpc.js';

// Staff redemption queue — list is index-only (resource-centric).
// Lifecycle Duyệt / Giao quà / Từ chối lives on /admin/engagement/rewards/:rewardId.
const REWARD_STATUS_VALUES = ['pending', 'approved', 'delivered', 'rejected'] as const;
type RewardStatus = (typeof REWARD_STATUS_VALUES)[number];

const STATUS_LABELS: Record<RewardStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  delivered: 'Đã giao',
  rejected: 'Từ chối',
};

interface RewardRow {
  id: string;
  studentId: string;
  status: string;
  redeemedAt: string | Date;
  gift: { id: string; name: string; starsRequired: number };
  [key: string]: unknown;
}

const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: REWARD_STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    placeholder: 'Tất cả',
  },
];

export default function RewardsQueuePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const statusParam = searchParams.get('status');
  const status: RewardStatus | undefined =
    statusParam && (REWARD_STATUS_VALUES as readonly string[]).includes(statusParam)
      ? (statusParam as RewardStatus)
      : undefined;

  const { data, isLoading, error } = trpc.rewards.list.useQuery({ status });
  const allRows = (data as RewardRow[] | undefined) ?? [];
  const pageRows = allRows.slice((page - 1) * pageSize, page * pageSize);

  function openReward(row: RewardRow) {
    navigate(links.reward(row.id));
  }

  const COLUMNS: TableColumn<RewardRow>[] = [
    {
      key: 'studentId',
      label: 'Học viên',
      render: (v) => <Text type="body" size="sm">{String(v).slice(0, 8)}</Text>,
    },
    { key: 'gift', label: 'Quà tặng', render: (_v, row) => row.gift.name },
    {
      key: 'starsRequired',
      label: 'Sao',
      width: 80,
      render: (_v, row) => (
        <Text type="body" size="sm" hasTabularNumbers>{row.gift.starsRequired}</Text>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 130,
      render: (v) => (
        <StatusBadge status={String(v)} label={STATUS_LABELS[String(v) as RewardStatus] ?? String(v)} />
      ),
    },
    {
      key: 'redeemedAt',
      label: 'Ngày đổi',
      width: 120,
      render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
    },
    {
      key: 'id',
      label: 'Hành động',
      width: 120,
      render: (_v, row) => (
        <Button label="Mở phiếu" size="sm" variant="primary" onClick={() => openReward(row)} />
      ),
    },
  ];

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Yêu cầu đổi quà"
          subtitle="Danh sách phiếu · mở form để duyệt / giao / từ chối (không duyệt trên list)"
          breadcrumbs={[
            { label: 'Quản trị' },
            { label: 'Engagement' },
            { label: 'Đổi quà' },
          ]}
        />
      }
      filters={<FilterBar filters={FILTERS} />}
      controlFooter={
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={allRows.length}
          onPageChange={setPage}
        />
      }
    >
      <DataTable<RewardRow>
        columns={COLUMNS}
        data={pageRows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có yêu cầu đổi quà nào"
        onRowClick={openReward}
      />
    </ListPage>
  );
}

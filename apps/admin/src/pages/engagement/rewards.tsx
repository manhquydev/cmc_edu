import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  DataTable,
  FilterBar,
  HStack,
  ListPage,
  PageHeader,
  StatusBadge,
  Text,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// Staff redemption queue — backend already exists (rewards.list +
// approve/deliver/reject, apps/api/src/rewards/reward-router.ts). Row-action
// buttons are gated by status to mirror the server's lifecycle guards
// (approve: pending only; deliver: approved only; reject: pending|approved) —
// this is UX-only; the server remains the authority.
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
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();

  const statusParam = searchParams.get('status');
  const status: RewardStatus | undefined =
    statusParam && (REWARD_STATUS_VALUES as readonly string[]).includes(statusParam)
      ? (statusParam as RewardStatus)
      : undefined;

  const { data, isLoading, error } = trpc.rewards.list.useQuery({ status });

  // Track which row triggered the current mutation so only that row's button
  // spins — otherwise `isPending` from useMutation applies globally and every
  // row's button flashes a spinner during one action.
  const [pendingRewardId, setPendingRewardId] = useState<string | null>(null);
  const clearPending = () => setPendingRewardId(null);
  const invalidate = () => {
    clearPending();
    void utils.rewards.list.invalidate();
  };
  const approveMut = trpc.rewards.approve.useMutation({ onSuccess: invalidate, onError: clearPending });
  const deliverMut = trpc.rewards.deliver.useMutation({ onSuccess: invalidate, onError: clearPending });
  const rejectMut = trpc.rewards.reject.useMutation({ onSuccess: invalidate, onError: clearPending });

  const runAction = (rewardId: string, mutate: (input: { rewardId: string }) => void) => {
    setPendingRewardId(rewardId);
    mutate({ rewardId });
  };

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
      width: 220,
      render: (_v, row) => {
        const canApprove = row.status === 'pending';
        const canDeliver = row.status === 'approved';
        const canReject = row.status === 'pending' || row.status === 'approved';
        if (!canApprove && !canDeliver && !canReject) return null;
        return (
          <HStack gap={1}>
            {canApprove && (
              <Button
                label="Duyệt"
                variant="primary"
                size="sm"
                isLoading={approveMut.isPending && pendingRewardId === row.id}
                onClick={() => runAction(row.id, approveMut.mutate)}
              />
            )}
            {canDeliver && (
              <Button
                label="Giao quà"
                variant="primary"
                size="sm"
                isLoading={deliverMut.isPending && pendingRewardId === row.id}
                onClick={() => runAction(row.id, deliverMut.mutate)}
              />
            )}
            {canReject && (
              <Button
                label="Từ chối"
                variant="secondary"
                size="sm"
                isLoading={rejectMut.isPending && pendingRewardId === row.id}
                onClick={() => runAction(row.id, rejectMut.mutate)}
              />
            )}
          </HStack>
        );
      },
    },
  ];

  return (
    <ListPage
      header={
        <PageHeader
          title="Yêu cầu đổi quà"
          subtitle="Danh sách học viên đang chờ nhận phần thưởng"
          breadcrumbs={[
            { label: 'Quản trị' },
            { label: 'Engagement' },
            { label: 'Đổi quà' },
          ]}
        />
      }
      filters={<FilterBar filters={FILTERS} />}
    >
      <DataTable<RewardRow>
        columns={COLUMNS}
        data={(data as RewardRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có yêu cầu đổi quà nào"
      />
    </ListPage>
  );
}

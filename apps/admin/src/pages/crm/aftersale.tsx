import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Badge, Button, DataTable, HStack, LineIcon, ListPage, PageHeader, Selector, Stack, Text } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useAfterSaleActions } from './use-after-sale-actions.js';
import { CreateAfterSaleCaseDialog } from './create-after-sale-case-dialog.js';
import { ResolveAfterSaleCaseDialog } from './resolve-after-sale-case-dialog.js';

const PAGE_SIZE = 20;

type BadgeVariant = ComponentProps<typeof Badge>['variant'];
type CaseStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type StatusFilter = 'all' | CaseStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'open', label: 'Mở' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'closed', label: 'Đã đóng' },
];

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Mở',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
};

const STATUS_VARIANT: Record<CaseStatus, BadgeVariant> = {
  open: 'blue',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

const PRIORITY_LABELS: Record<string, string> = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' };

interface CaseRow {
  id: string;
  studentId: string;
  studentName: string | null;
  priority: string;
  status: string;
  description: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export default function AfterSalePage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveCaseId, setResolveCaseId] = useState<string | null>(null);

  const { data, isLoading, error } = trpc.afterSale.list.useQuery({
    ...(status !== 'all' ? { status } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const { advanceMutation, closeMutation } = useAfterSaleActions();

  const rows = (data?.items ?? []) as CaseRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: TableColumn<CaseRow>[] = [
    { key: 'studentName', label: 'Học viên', render: (v) => (v as string | null) ?? '—' },
    { key: 'description', label: 'Mô tả' },
    {
      key: 'priority',
      label: 'Ưu tiên',
      width: 110,
      render: (v) => PRIORITY_LABELS[String(v)] ?? String(v),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 140,
      render: (v) => (
        <Badge
          label={STATUS_LABELS[String(v) as CaseStatus] ?? String(v)}
          variant={STATUS_VARIANT[String(v) as CaseStatus] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'id',
      label: 'Hành động',
      width: 220,
      render: (_v, row) => (
        <HStack gap={1}>
          {row.status === 'open' && (
            <Button
              label="Tiếp nhận"
              size="sm"
              variant="secondary"
              isLoading={advanceMutation.isPending}
              onClick={() => advanceMutation.mutate({ caseId: row.id })}
            />
          )}
          {(row.status === 'open' || row.status === 'in_progress') && (
            <Button
              label="Giải quyết"
              size="sm"
              variant="secondary"
              onClick={() => setResolveCaseId(row.id)}
            />
          )}
          {row.status === 'resolved' && (
            <Button
              label="Đóng"
              size="sm"
              variant="ghost"
              isLoading={closeMutation.isPending}
              onClick={() => closeMutation.mutate({ caseId: row.id })}
            />
          )}
        </HStack>
      ),
    },
  ];

  return (
    <>
      <ListPage
        header={
          <PageHeader
            title="Chăm sóc sau bán"
            subtitle="Theo dõi các case chăm sóc khách hàng sau bán"
            breadcrumbs={[{ label: 'CRM' }, { label: 'Sau bán' }]}
            actions={
              <Button
                label="Tạo case"
                size="sm"
                variant="primary"
                endContent={<LineIcon name="plus" size={14} />}
                onClick={() => setCreateOpen(true)}
              />
            }
          />
        }
        filters={
          <div style={{ padding: '0 22px', width: 220 }}>
            <Selector
              label="Trạng thái"
              isLabelHidden
              value={status}
              onChange={(v) => {
                setStatus(v as StatusFilter);
                setPage(1);
              }}
              options={STATUS_FILTER_OPTIONS}
              size="sm"
            />
          </div>
        }
      >
        <Stack gap={3}>
          <DataTable<CaseRow>
            columns={columns}
            data={rows}
            loading={isLoading}
            error={error?.message}
            empty="Chưa có case chăm sóc sau bán nào"
          />
          {!isLoading && !error && (
            <HStack justify="between" align="center">
              <Text type="supporting" size="xsm">
                Trang {page}/{totalPages} — {total} case
              </Text>
              <HStack gap={1}>
                <Button
                  label="Trang trước"
                  size="sm"
                  variant="secondary"
                  isDisabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
                <Button
                  label="Trang sau"
                  size="sm"
                  variant="secondary"
                  isDisabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </HStack>
            </HStack>
          )}
        </Stack>
      </ListPage>

      <CreateAfterSaleCaseDialog opened={createOpen} onClose={() => setCreateOpen(false)} />
      <ResolveAfterSaleCaseDialog caseId={resolveCaseId} onClose={() => setResolveCaseId(null)} />
    </>
  );
}

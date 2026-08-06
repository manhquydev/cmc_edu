import { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Badge,
  BulkActionBar,
  Button,
  DataTable,
  FilterBar,
  HStack,
  LineIcon,
  ListPage,
  ListPagination,
  PageHeader,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
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

const AFTERSALE_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    // Empty value = all (FilterBar select clear)
    options: STATUS_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({
      value: o.value,
      label: o.label,
    })),
    placeholder: 'Tất cả',
  },
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
  const [filters, setFilters] = useState<Record<string, string>>({ status: '' });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveCaseId, setResolveCaseId] = useState<string | null>(null);
  const { success: toastSuccess } = useToast();

  const statusRaw = filters.status ?? '';
  const status: StatusFilter =
    statusRaw && STATUS_FILTER_OPTIONS.some((o) => o.value === statusRaw)
      ? (statusRaw as StatusFilter)
      : 'all';

  const { data, isLoading, error } = trpc.afterSale.list.useQuery({
    ...(status !== 'all' ? { status } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const { advanceMutation, closeMutation } = useAfterSaleActions();

  const rows = (data?.items ?? []) as CaseRow[];
  const total = data?.total ?? 0;

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
        density="ops"
        header={
          <PageHeader
            title="Chăm sóc sau bán"
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
          <FilterBar
            filters={AFTERSALE_FILTERS}
            value={filters}
            onChange={(next) => {
              setFilters({ status: next.status ?? '' });
              setPage(1);
              setSelectedIds([]);
            }}
          />
        }
        controlFooter={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Sao chép mô tả"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0}
                onClick={() => {
                  const texts = rows
                    .filter((r) => selectedIds.includes(r.id))
                    .map((r) => `${r.studentName ?? '—'} · ${r.description}`);
                  void navigator.clipboard?.writeText(texts.join('\n'));
                  toastSuccess(`Đã sao chép ${texts.length} case`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds([]);
              }}
            />
          </div>
        }
      >
        <DataTable<CaseRow>
          columns={columns}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có case chăm sóc sau bán nào"
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </ListPage>

      <CreateAfterSaleCaseDialog opened={createOpen} onClose={() => setCreateOpen(false)} />
      <ResolveAfterSaleCaseDialog caseId={resolveCaseId} onClose={() => setResolveCaseId(null)} />
    </>
  );
}

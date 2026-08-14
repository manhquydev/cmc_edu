import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  BulkActionBar,
  Button,
  DataTable,
  FilterBar,
  LineIcon,
  ListPage,
  ListPagination,
  PageHeader,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn, TableEmptySpec } from '@cmc/ui';
import { links } from '@cmc/links';
import { trpc } from '../../lib/trpc.js';
import { CreateAfterSaleCaseDialog } from './create-after-sale-case-dialog.js';

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
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string>>({ status: '' });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
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

  // List = index only (resource-centric). Lifecycle HITL lives on form
  // /crm/aftersale/:caseId (advance / resolve / close).

  const rows = (data?.items ?? []) as CaseRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!data) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const statusFilterActive = status !== 'all';
  // afterSale.list returns only the filtered total — never claim `filtered`
  // without an unfiltered baseline. Under-claim with a bare string.
  const listEmpty: string | TableEmptySpec =
    total > 0
      ? 'Không có dòng trên trang này'
      : !statusFilterActive
        ? {
            kind: 'first-run',
            title: 'Chưa có case chăm sóc sau bán nào',
            description: 'Tạo case khi cần theo dõi học viên sau ghi danh.',
            action: (
              <Button
                label="Thêm case đầu tiên"
                size="sm"
                variant="primary"
                endContent={<LineIcon name="plus" size={14} />}
                onClick={() => setCreateOpen(true)}
              />
            ),
          }
        : 'Không có case khớp bộ lọc trạng thái này';

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
      width: 120,
      render: (_v, row) => (
        <Button
          label="Mở phiếu"
          size="sm"
          variant="ghost"
          onClick={() => navigate(links.afterSaleCase(row.id))}
        />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cmc-space-2)', width: '100%' }}>
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
          empty={listEmpty}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={(row) => navigate(links.afterSaleCase(row.id))}
        />
      </ListPage>

      <CreateAfterSaleCaseDialog opened={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

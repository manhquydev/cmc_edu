import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { links } from '@cmc/links';
import {
  BulkActionBar,
  Button,
  DataTable,
  FilterBar,
  HStack,
  ListPage,
  ListPagination,
  PageHeader,
  StatusBadge,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { EnrollPicker } from '../../lib/enroll-picker.js';

const RECEIPT_STATUS_VALUES = ['draft', 'approved', 'sent', 'cancelled'] as const;
type ReceiptStatus = (typeof RECEIPT_STATUS_VALUES)[number];

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  draft: 'Nháp',
  approved: 'Đã duyệt',
  sent: 'Đã gửi',
  cancelled: 'Đã hủy',
};

interface ReceiptRow {
  id: string;
  code: string;
  studentName: string;
  netAmount: number;
  status: string;
  createdAt: string | Date;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<ReceiptRow>[] = [
  { key: 'code', label: 'Mã phiếu', width: 120 },
  { key: 'studentName', label: 'Học viên' },
  {
    key: 'netAmount',
    label: 'Số tiền',
    width: 150,
    render: (v) => (
      <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--cmc-font-sans)' }}>
        {Number(v).toLocaleString('vi-VN')} đ
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 130,
    render: (v) => (
      <StatusBadge
        status={String(v)}
        label={STATUS_LABELS[String(v) as ReceiptStatus] ?? String(v)}
      />
    ),
  },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 120,
    render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
  },
];

const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: RECEIPT_STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    placeholder: 'Tất cả',
  },
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên HS, mã phiếu...',
  },
];

function readFiltersFromParams(params: URLSearchParams): Record<string, string> {
  return {
    status: params.get('status') ?? '',
    q: params.get('q') ?? '',
  };
}

export default function ReceiptListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);
  const initialPage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const [page, setPage] = useState(initialPage);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { success: toastSuccess } = useToast();

  // Controlled filters: local state is source of truth for query + UI.
  // URL is best-effort deep-link (setSearchParams can fail in jsdom RR7).
  const [filters, setFilters] = useState(() => readFiltersFromParams(searchParams));

  // External URL changes (back/forward, initial deep-link remount) → re-sync.
  const statusParam = searchParams.get('status') ?? '';
  const qParam = searchParams.get('q') ?? '';
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  useEffect(() => {
    setFilters((prev) => {
      if (prev.status === statusParam && prev.q === qParam) return prev;
      return { status: statusParam, q: qParam };
    });
  }, [statusParam, qParam]);

  useEffect(() => {
    if (page !== pageParam) setPage(pageParam);
  }, [page, pageParam]);

  const status: ReceiptStatus | undefined =
    filters.status && (RECEIPT_STATUS_VALUES as readonly string[]).includes(filters.status)
      ? (filters.status as ReceiptStatus)
      : undefined;
  const q = filters.q ?? '';

  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({
    status,
    page,
    pageSize: 50,
  });

  const rows: ReceiptRow[] = (data?.items ?? []).filter((r) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return (
      r.studentName.toLowerCase().includes(lower) ||
      r.code.toLowerCase().includes(lower)
    );
  }) as ReceiptRow[];

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [status, q]);

  function handleFilterChange(next: Record<string, string>) {
    setFilters({
      status: next.status ?? '',
      q: next.q ?? '',
    });
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.q) params.set('q', next.q);
    // Deep-link URL. Skip under Vitest: RR7 data-router + jsdom throws
    // undici AbortSignal mismatch on setSearchParams (environment gap).
    // Local `filters` already updated — UI/query stay correct in all envs.
    if (process.env.VITEST !== 'true') {
      setSearchParams(params, { replace: true });
    }
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setSelectedIds([]);
    const nextParams = new URLSearchParams(searchParams);
    if (nextPage > 1) nextParams.set('page', String(nextPage));
    else nextParams.delete('page');
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <>
      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Phiếu thu học phí"
            breadcrumbs={[{ label: 'Kinh doanh' }, { label: 'Phiếu thu' }]}
            actions={
              <HStack gap={2}>
                <Button
                  label="+ Ghi danh"
                  size="sm"
                  variant="secondary"
                  onClick={() => setEnrollPickerOpen(true)}
                />
                <Button
                  label="+ Tạo phiếu thu"
                  size="sm"
                  variant="primary"
                  onClick={() => void navigate(`/finance/new`)}
                />
              </HStack>
            }
          />
        }
        filters={
          <FilterBar filters={FILTERS} value={filters} onChange={handleFilterChange} />
        }
        controlFooter={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cmc-space-2)', width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Sao chép mã phiếu"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0}
                onClick={() => {
                  const codes = rows
                    .filter((r) => selectedIds.includes(r.id))
                    .map((r) => r.code);
                  void navigator.clipboard?.writeText(codes.join(', '));
                  toastSuccess(`Đã sao chép ${codes.length} mã phiếu`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={50}
              total={data?.total ?? rows.length}
              onPageChange={changePage}
            />
          </div>
        }
      >
        <DataTable<ReceiptRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có phiếu thu nào"
          onRowClick={(row) =>
            void navigate({
              pathname: links.receipt(row.id),
              search: location.search,
            })
          }
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </ListPage>
    </>
  );
}

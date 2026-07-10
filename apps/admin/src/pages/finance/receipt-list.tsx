import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, DataTable, FilterBar, HStack, PageHeader, StatusBadge } from '@cmc/ui';
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

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);

  const statusParam = searchParams.get('status');
  const q = searchParams.get('q') ?? '';

  // Validate status against allowed enum values before passing to API.
  const status: ReceiptStatus | undefined =
    statusParam && (RECEIPT_STATUS_VALUES as readonly string[]).includes(statusParam)
      ? (statusParam as ReceiptStatus)
      : undefined;

  // Page state — not in URL to keep FilterBar simple; reset when filter changes.
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({
    status,
    page,
    pageSize: 50,
  });

  // Client-side text filter: applied on top of the server status filter.
  const rows: ReceiptRow[] = (data?.items ?? []).filter((r) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return (
      r.studentName.toLowerCase().includes(lower) ||
      r.code.toLowerCase().includes(lower)
    );
  }) as ReceiptRow[];

  // Reset page when filters change.
  const handleFiltersChange = () => setPage(1);

  return (
    <>
      <PageHeader
        title="Phiếu thu học phí"
        subtitle="Danh sách phiếu thu — tìm kiếm và duyệt học phí"
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
              onClick={() => void navigate('/finance/new')}
            />
          </HStack>
        }
      />
      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
      <FilterBar filters={FILTERS} onChange={handleFiltersChange} />
      <DataTable<ReceiptRow>
        columns={COLUMNS}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có phiếu thu nào"
        onRowClick={(row) => void navigate(`/finance/${row.id}`)}
      />
    </>
  );
}

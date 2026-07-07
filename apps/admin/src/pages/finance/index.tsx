import { useNavigate } from 'react-router-dom';
import { DataTable, PageHeader, StatusBadge } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

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
    width: 140,
    render: (v) => (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Number(v).toLocaleString('vi-VN')} đ
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 120,
    render: (v) => <StatusBadge status={String(v)} />,
  },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 120,
    render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
  },
];

export default function FinancePage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({});

  return (
    <>
      <PageHeader
        title="Phiếu thu"
        subtitle="Danh sách phiếu thu học phí"
        breadcrumbs={[{ label: 'Kinh doanh' }, { label: 'Phiếu thu' }]}
      />
      <DataTable<ReceiptRow>
        columns={COLUMNS}
        data={(data?.items as ReceiptRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có phiếu thu nào"
        onRowClick={(row) => void navigate(`/finance/${row.id}`)}
      />
    </>
  );
}

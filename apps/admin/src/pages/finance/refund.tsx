// Hoàn tiền — resource-centric index (not a role product).
// RefundRecord is append-only ledger on Receipt. HITL lives on
// /finance/:receiptId; this page lists approved receipts to open that form.

import { links } from '@cmc/links';
import {
  Banner,
  Button,
  DataTable,
  ListPage,
  ListPagination,
  PageHeader,
  Spinner,
  Stack,
  Text,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface ReceiptRow {
  id: string;
  code: string;
  studentName: string;
  netAmount: number;
  status: string;
  createdAt: string | Date;
  [key: string]: unknown;
}

function fmt(n: number) {
  return n.toLocaleString('vi-VN') + ' đ';
}

const COLUMNS: TableColumn<ReceiptRow>[] = [
  { key: 'code', label: 'Mã phiếu', width: 120 },
  { key: 'studentName', label: 'Học viên' },
  {
    key: 'netAmount',
    label: 'Số tiền',
    width: 150,
    render: (v) => (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(v))}</span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 120,
    render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
  },
];

export default function RefundPage() {
  const navigate = useNavigate();
  const { canDo } = useSession();
  const canList = canDo('finance', 'receiptList');
  const canRefund = canDo('finance', 'refundCreate');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = trpc.finance.receiptList.useQuery(
    { status: 'approved', page, pageSize },
    { enabled: canList },
  );

  if (!canList) {
    return (
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Hoàn tiền"
            breadcrumbs={[{ label: 'Tài chính' }, { label: 'Hoàn tiền' }]}
          />
        }
      >
        <Banner
          status="warning"
          title="Không có quyền xem phiếu thu"
          description="Bạn không có quyền xem danh sách phiếu thu. Ghi hoàn tiền chỉ Giám đốc Kinh doanh."
        />
      </ListPage>
    );
  }

  const items = (data?.items ?? []) as ReceiptRow[];
  const total = data?.total ?? 0;

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Hoàn tiền"
          subtitle="Chỉ mục phiếu đã duyệt — mở form phiếu thu để ghi hoàn (sổ cái append-only)."
          breadcrumbs={[{ label: 'Tài chính' }, { label: 'Hoàn tiền' }]}
        />
      }
      isEmpty={!isLoading && !error && items.length === 0}
      empty={
        <Stack gap={2} style={{ padding: 'var(--cmc-space-4)' }}>
          <Text type="body" size="sm">
            Không có phiếu thu đã duyệt trong cơ sở hiện tại.
          </Text>
          <Button label="Danh sách phiếu thu" size="sm" variant="secondary" onClick={() => navigate('/finance')} />
        </Stack>
      }
    >
      <Stack gap={2}>
        {!canRefund && (
          <Banner
            status="info"
            title="Chỉ xem sổ / mở phiếu"
            description="Bạn có thể mở phiếu thu để xem sổ; ghi hoàn tiền chỉ dành cho Giám đốc Kinh doanh."
          />
        )}
        {error && (
          <Banner status="error" title="Không tải được danh sách" description={error.message} />
        )}
        {isLoading ? (
          <Stack hAlign="center" gap={2} style={{ paddingBlock: 'var(--cmc-space-4)' }}>
            <Spinner size="md" />
            <Text type="supporting" size="sm">
              Đang tải phiếu đã duyệt…
            </Text>
          </Stack>
        ) : (
          <>
            <DataTable
              columns={[
                ...COLUMNS,
                {
                  key: 'actions',
                  label: '',
                  width: 120,
                  render: (_v, row) => (
                    <Button
                      label="Mở phiếu"
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(links.receipt(row.id))}
                    />
                  ),
                },
              ]}
              data={items}
              onRowClick={(row) => void navigate(links.receipt(row.id))}
            />
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </Stack>
    </ListPage>
  );
}

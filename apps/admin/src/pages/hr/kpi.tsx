// KPI shared board — resource-centric (docs/ux-resource-centric-structure.md).
//   kpi.list         — directors: branch-scoped; staff: self-only.
//   kpi.confirm / override — form only (/hr/kpi/:scoreId).
//   kpi.bulkApprove  — "Đã trả lương kỳ X" period-level on this board (kept).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  FilterBar,
  ListPage,
  PageHeader,
  Stack,
  StatusBadge,
  useToast,
} from '@cmc/ui';
import type { FilterDef, SoftTone, TableColumn } from '@cmc/ui';
import { links } from '@cmc/links';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function defaultPeriodICT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
}

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

const KPI_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  approved: 'Đã duyệt',
};

// `submitted` is the only KPI state waiting on someone else (the manager).
// `draft` stays on the default neutral map — the employee is still editing it.
function kpiStatusTone(status: string): SoftTone | undefined {
  return status === 'submitted' ? 'brand' : undefined;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'submitted', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'draft', label: 'Nháp' },
];

const KPI_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: STATUS_FILTER_OPTIONS,
    placeholder: 'Tất cả',
  },
  {
    key: 'period',
    label: 'Kỳ (YYYY-MM)',
    type: 'text',
    placeholder: 'YYYY-MM',
  },
];

interface KpiRow {
  id: string;
  appUserId: string;
  status: string;
  value: unknown;
  override: boolean;
  overrideReason: string | null;
  tierMissing: boolean;
  fullName: string;
  position: string;
  viewerCanConfirm?: boolean;
  viewerCanOverride?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Page root — list is index + period bulk settle; row HITL is form-only.
// ---------------------------------------------------------------------------
export default function KpiPage() {
  const navigate = useNavigate();
  const { canDo } = useSession();
  const utils = trpc.useUtils();
  const { success: toastSuccess } = useToast();
  const [filterValues, setFilterValues] = useState({
    status: 'submitted',
    period: defaultPeriodICT(),
  });
  const period = filterValues.period;
  const statusFilter = filterValues.status || undefined;
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const isPeriodValid = PERIOD_PATTERN.test(period);

  // Query only once the period looks like YYYY-MM — otherwise every keystroke
  // while typing (e.g. "2026-", "2026-0") fires a request that the server
  // rejects with a Zod validation error.
  const { data, isLoading, error } = trpc.kpi.list.useQuery(
    {
      period,
      ...(statusFilter ? { status: statusFilter as 'draft' | 'submitted' | 'confirmed' | 'approved' } : {}),
    },
    { enabled: isPeriodValid },
  );

  const bulkApproveMut = trpc.kpi.bulkApprove.useMutation({
    onSuccess(res) {
      setBulkConfirmOpen(false);
      setResult({
        ok: true,
        text: `Đã tất toán ${res.approved} phiếu KPI. ${res.skippedSelf > 0 ? `${res.skippedSelf} phiếu của bạn bị loại tự động. ` : ''}${res.skippedUnfinalized.length > 0 ? `${res.skippedUnfinalized.length} phiếu chưa chốt lương, bỏ qua.` : ''}`,
      });
      toastSuccess('Đã tất toán KPI');
      void utils.kpi.list.invalidate();
    },
    onError(err) {
      setBulkConfirmOpen(false);
      setResult({ ok: false, text: err.message ?? 'Lỗi tất toán KPI.' });
    },
  });

  const rows: KpiRow[] = (data as KpiRow[] | undefined) ?? [];
  const confirmedRows = rows.filter((r) => r.status === 'confirmed');
  const bulkMessage =
    confirmedRows.length > 0
      ? `Sẽ tất toán ${confirmedRows.length} phiếu KPI đã xác nhận (kỳ ${period}): ${confirmedRows.map((r) => r.fullName).join(', ')}. Chỉ phiếu đã chốt lương mới được duyệt; phiếu của chính bạn (nếu có) sẽ tự động bị loại.`
      : `Không có phiếu KPI đã xác nhận nào ở kỳ ${period}.`;

  const columns: TableColumn<KpiRow>[] = [
    { key: 'fullName', label: 'Họ tên' },
    { key: 'position', label: 'Chức vụ', width: 140 },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 140,
      render: (v) => (
        <StatusBadge
          status={String(v)}
          label={KPI_STATUS_LABELS[String(v)] ?? String(v)}
          tone={kpiStatusTone(String(v))}
        />
      ),
    },
    {
      key: 'value',
      label: 'Phần KPI',
      width: 140,
      render: (v) => `${Number(v).toLocaleString('vi-VN')} đ`,
    },
    {
      key: 'tierMissing',
      label: '',
      width: 110,
      render: (v) => (v ? <StatusBadge status="warning" label="Chưa gán bậc" /> : null),
    },
    {
      key: '_actions',
      label: '',
      width: 120,
      render: (_v, row) => (
        <Button
          label="Mở phiếu"
          size="sm"
          variant="ghost"
          onClick={() => navigate(links.kpiScore(row.id))}
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
            title="KPI"
            subtitle="Phiếu KPI · mở form /hr/kpi/:id để xem chi tiết"
            breadcrumbs={[{ label: 'Nhân sự' }, { label: 'KPI' }]}
            actions={
              canDo('kpi', 'bulkApprove') ? (
                <Button
                  label={`Đã trả lương kỳ ${period}`}
                  size="sm"
                  variant="primary"
                  onClick={() => setBulkConfirmOpen(true)}
                />
              ) : undefined
            }
          />
        }
        filters={
          <FilterBar
            filters={KPI_FILTERS}
            value={filterValues}
            onChange={(next) =>
              setFilterValues({
                status: next.status ?? '',
                period: next.period || defaultPeriodICT(),
              })
            }
          />
        }
      >
        <Stack gap={2}>
          {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}

          <DataTable<KpiRow>
            columns={columns}
            data={rows}
            loading={isLoading}
            error={error?.message}
            empty="Không có phiếu KPI nào phù hợp bộ lọc."
            onRowClick={(row) => navigate(links.kpiScore(row.id))}
          />
        </Stack>
      </ListPage>

      <ConfirmDialog
        opened={bulkConfirmOpen}
        title={`Đã trả lương kỳ ${period}`}
        message={bulkMessage}
        confirmLabel="Tất toán"
        confirmColor="red"
        loading={bulkApproveMut.isPending}
        onConfirm={() => bulkApproveMut.mutate({ period })}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </>
  );
}

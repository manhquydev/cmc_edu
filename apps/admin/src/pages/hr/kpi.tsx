// Duyệt KPI — HR remediation phase 5 (R3-10, red-team #24). Rebuilt on the
// auto-score lifecycle procedures added in phase 3:
//   kpi.list         — GĐ/super_admin inbox, already branch-scoped server-side.
//   kpi.confirm      — direct manager confirms a submitted slip (no reason).
//   kpi.override     — director sets `value` directly (reason required).
//   kpi.bulkApprove  — "Đã trả lương kỳ X" tất toán action (period-level).
//
// Migrated inventory (red-team #24 — the OLD getForUser/approve callers this
// file used to have are GONE from the API): getForUser → list (client no
// longer filters to one employee — this IS the inbox), single-score approve →
// bulkApprove (period-level, no per-score procedure exists), confirm kept
// as-is.

import { useState } from 'react';
import {
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogHeader,
  HStack,
  NumberInput,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  TextArea,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
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

const STATUS_FILTER_OPTIONS = [
  { value: 'submitted', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'draft', label: 'Nháp' },
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
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Override modal
// ---------------------------------------------------------------------------
function OverrideModal({
  target,
  onClose,
}: {
  target: KpiRow | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [value, setValue] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState('');

  const overrideMut = trpc.kpi.override.useMutation({
    onSuccess() {
      void utils.kpi.list.invalidate();
      setValue(undefined);
      setReason('');
      onClose();
    },
  });

  const canSubmit = value !== undefined && value >= 0 && reason.trim().length > 0;

  return (
    <Dialog
      isOpen={target !== null}
      onOpenChange={(next) => { if (!next && !overrideMut.isPending) { onClose(); overrideMut.reset(); } }}
      width={420}
      purpose="form"
    >
      <DialogHeader
        title={`Ghi đè điểm KPI — ${target?.fullName ?? ''}`}
        onOpenChange={(next) => { if (!next) onClose(); }}
      />
      <Stack gap={2}>
        <NumberInput label="Giá trị mới (VND)" min={0} value={value} onChange={setValue} />
        <TextArea
          label="Lý do ghi đè"
          placeholder="Nêu lý do ghi đè điểm KPI…"
          value={reason}
          onChange={setReason}
          rows={3}
          maxLength={2000}
        />
        {overrideMut.error && <Banner status="error" title={overrideMut.error.message} />}
        <HStack justify="end" gap={1}>
          <Button label="Hủy" variant="secondary" size="sm" onClick={onClose} />
          <Button
            label="Ghi đè"
            size="sm"
            variant="primary"
            isLoading={overrideMut.isPending}
            isDisabled={!canSubmit}
            onClick={() =>
              target &&
              value !== undefined &&
              overrideMut.mutate({ kpiScoreId: target.id, value, overrideReason: reason.trim() })
            }
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function KpiPage() {
  const { canDo } = useSession();
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState(defaultPeriodICT());
  const [statusFilter, setStatusFilter] = useState<string | undefined>('submitted');
  const [confirmTarget, setConfirmTarget] = useState<KpiRow | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<KpiRow | null>(null);
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

  const confirmMut = trpc.kpi.confirm.useMutation({
    onSuccess() {
      setConfirmTarget(null);
      void utils.kpi.list.invalidate();
    },
    onError(err) {
      setConfirmTarget(null);
      setResult({ ok: false, text: err.message ?? 'Lỗi xác nhận KPI.' });
    },
  });

  const bulkApproveMut = trpc.kpi.bulkApprove.useMutation({
    onSuccess(res) {
      setBulkConfirmOpen(false);
      setResult({
        ok: true,
        text: `Đã tất toán ${res.approved} phiếu KPI. ${res.skippedSelf > 0 ? `${res.skippedSelf} phiếu của bạn bị loại tự động. ` : ''}${res.skippedUnfinalized.length > 0 ? `${res.skippedUnfinalized.length} phiếu chưa chốt lương, bỏ qua.` : ''}`,
      });
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
      render: (v) => <StatusBadge status={String(v)} label={KPI_STATUS_LABELS[String(v)] ?? String(v)} />,
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
      width: 200,
      render: (_v, row) => (
        <HStack gap={1}>
          {row.status === 'submitted' && canDo('kpi', 'confirm') && (
            <Button label="Xác nhận" size="sm" variant="primary" onClick={() => setConfirmTarget(row)} />
          )}
          {(row.status === 'submitted' || row.status === 'confirmed') && canDo('kpi', 'approve') && (
            <Button label="Ghi đè" size="sm" variant="secondary" onClick={() => setOverrideTarget(row)} />
          )}
        </HStack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Duyệt KPI"
        subtitle="Xác nhận, ghi đè và tất toán điểm KPI theo kỳ"
        breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Duyệt KPI' }]}
        actions={
          <HStack gap={1} align="end">
            <div style={{ width: 160 }}>
              <Selector
                label="Trạng thái"
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
              />
            </div>
            <div style={{ width: 130 }}>
              <TextInput size="sm" label="Kỳ (YYYY-MM)" value={period} onChange={(v) => setPeriod(v)} />
            </div>
            {canDo('kpi', 'bulkApprove') && (
              <Button
                label={`Đã trả lương kỳ ${period}`}
                size="sm"
                variant="primary"
                onClick={() => setBulkConfirmOpen(true)}
              />
            )}
          </HStack>
        }
      />

      <div style={{ padding: 16 }}>
        <Stack gap={2}>
          {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}

          <DataTable<KpiRow>
            columns={columns}
            data={rows}
            loading={isLoading}
            error={error?.message}
            empty="Không có phiếu KPI nào phù hợp bộ lọc."
          />
        </Stack>
      </div>

      <ConfirmDialog
        opened={confirmTarget !== null}
        title="Xác nhận điểm KPI"
        message={`Xác nhận điểm KPI của ${confirmTarget?.fullName ?? ''} cho kỳ ${period}?`}
        confirmLabel="Xác nhận"
        confirmColor="blue"
        loading={confirmMut.isPending}
        onConfirm={() => confirmTarget && confirmMut.mutate({ kpiScoreId: confirmTarget.id })}
        onCancel={() => setConfirmTarget(null)}
      />

      <OverrideModal target={overrideTarget} onClose={() => setOverrideTarget(null)} />

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

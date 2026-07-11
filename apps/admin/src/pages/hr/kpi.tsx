// KPI — P05 (QĐ0011, WF-P3-05).
//
// HR remediation phase 3 (docs/20) MINIMAL shim: `kpi.getForUser` and the
// standalone `kpi.approve` procedure were REMOVED (auto-score lifecycle —
// `approved` is now reachable ONLY via the bulk `kpi.bulkApprove({period})`
// tất toán action, which has no per-employee UI yet). This file is patched
// to the MINIMUM needed to keep `pnpm --filter @cmc/admin typecheck` green:
//   - `kpi.getForUser.useQuery` -> `kpi.list.useQuery({period})`, client-side
//     filtered to the selected employee (list is director/super_admin-only,
//     matching this page's existing director-only usage).
//   - The "Duyệt (GĐ)" single-score approve button + its mutation/dialog are
//     REMOVED (no replacement procedure at this grain — bulkApprove operates
//     on a whole period, not one score).
//   - The retired `kpiMax` display row is dropped (KpiScore.kpiMax is
//     nullable/unused under the tier model).
// A full rebuild (kpi.refresh/submitSlip/override UI, bulkApprove screen) is
// phase 5 scope — this shim intentionally does not add that surface.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DetailPage,
  HStack,
  LineIcon,
  PageHeader,
  Stack,
  StatusBadge,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Staff list types
// ---------------------------------------------------------------------------
interface StaffRow {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string;
  [key: string]: unknown;
}

const STAFF_COLS: TableColumn<StaffRow>[] = [
  { key: 'employeeCode', label: 'Mã NV', width: 100 },
  { key: 'fullName', label: 'Họ tên' },
  { key: 'position', label: 'Chức vụ' },
];

// ---------------------------------------------------------------------------
// KPI status helpers
// ---------------------------------------------------------------------------
const KPI_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  approved: 'Đã duyệt',
};

// ---------------------------------------------------------------------------
// KPI detail (per employee × period)
// ---------------------------------------------------------------------------
interface KpiDetailProps {
  appUserId: string;
  period: string;
  employeeName: string;
  onBack: () => void;
}

function KpiDetail({ appUserId, period, employeeName, onBack }: KpiDetailProps) {
  const { canDo } = useSession();
  const [confirmAction, setConfirmAction] = useState<'confirm' | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);

  // `kpi.getForUser` was removed (HR remediation phase 3) — `kpi.list` is the
  // director/super_admin-only replacement; filter client-side to this employee.
  const { data: listData, isLoading, error, refetch } = trpc.kpi.list.useQuery(
    { period },
    { retry: false },
  );
  const data = listData?.find((row) => row.appUserId === appUserId);

  const confirmMut = trpc.kpi.confirm.useMutation({
    onSuccess() {
      setConfirmAction(null);
      setMutError(null);
      void refetch();
    },
    onError(err) {
      setConfirmAction(null);
      setMutError(err.message ?? 'Lỗi xác nhận KPI.');
    },
  });

  const isBusy = confirmMut.isPending;

  return (
    <Stack gap={3}>
      {/* Back nav */}
      <HStack gap={2} align="center">
        <Button
          label="Danh sách nhân viên"
          icon={
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <LineIcon name="chevron" size={14} />
            </span>
          }
          variant="ghost"
          size="sm"
          onClick={onBack}
        />
        <Text type="supporting" size="sm" weight="semibold">
          {employeeName} · {period}
        </Text>
      </HStack>

      {isLoading && (
        <Text type="supporting" size="sm">
          Đang tải…
        </Text>
      )}

      {error && (
        <Banner status="warning" title="Không tải được danh sách KPI" description={error.message} />
      )}

      {!isLoading && !error && !data && (
        <Banner
          status="warning"
          title="Chưa có điểm KPI"
          description={`Kỳ ${period} chưa có điểm KPI cho nhân viên này.`}
        />
      )}

      {mutError && <Banner status="error" title={mutError} />}

      {data && (
        <Card padding={3}>
          <Stack gap={2}>
            {/* Status */}
            <HStack justify="between">
              <Text
                type="supporting"
                size="2xs"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Trạng thái
              </Text>
              <StatusBadge
                status={data.status}
                label={KPI_STATUS_LABELS[data.status] ?? data.status}
              />
            </HStack>

            {/* Score */}
            <HStack justify="between">
              <Text type="body" size="sm">Điểm KPI</Text>
              <Text type="body" size="xl" weight="bold" hasTabularNumbers>
                {Number(data.value).toLocaleString('vi-VN')}
              </Text>
            </HStack>

            {/* Override badge */}
            {data.override && (
              <Banner
                status="warning"
                title="Đã ghi đè (override)"
                description={
                  data.overrideReason
                    ? String(data.overrideReason)
                    : 'Giá trị đã được GĐ ghi đè.'
                }
              />
            )}

            {/* Action buttons — gated per role */}
            <HStack
              gap={1}
              paddingBlock={1}
              style={{ borderTop: '1px solid var(--cmc-border)' }}
            >
              {/* Confirm: direct manager */}
              {canDo('kpi', 'confirm') && data.status === 'submitted' && (
                <Button
                  label="Xác nhận (Quản lý)"
                  size="sm"
                  variant="primary"
                  isDisabled={isBusy}
                  onClick={() => setConfirmAction('confirm')}
                />
              )}

              {/* Standalone per-score approve is gone (bulkApprove-only,
                  HR remediation phase 3) — a confirmed score awaits the
                  period-level "Tất toán" action (phase 5 UI, not built here). */}
              {data.status === 'confirmed' && (
                <Badge label="Chờ tất toán theo kỳ (bulkApprove)" variant="neutral" />
              )}

              {data.status === 'approved' && (
                <Badge label="Đã duyệt — hoàn tất" variant="success" />
              )}
            </HStack>
          </Stack>
        </Card>
      )}

      {/* Confirm: manager confirm */}
      <ConfirmDialog
        opened={confirmAction === 'confirm'}
        title="Xác nhận điểm KPI"
        message={`Xác nhận điểm KPI của ${employeeName} cho kỳ ${period}? Bạn là quản lý trực tiếp của nhân viên này.`}
        confirmLabel="Xác nhận"
        confirmColor="blue"
        loading={isBusy}
        onConfirm={() => {
          if (data) confirmMut.mutate({ kpiScoreId: data.id });
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function KpiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultPeriod = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    .slice(0, 7);
  const period = searchParams.get('period') ?? defaultPeriod;

  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoading, error } = trpc.user.list.useQuery();

  const staffRows: StaffRow[] = (data?.items ?? []).map((u) => ({
    id: u.id,
    fullName: u.fullName,
    employeeCode: u.employeeCode,
    position: u.position,
  }));

  function setPeriod(value: string) {
    const p = new URLSearchParams(searchParams);
    if (value) {
      p.set('period', value);
    } else {
      p.delete('period');
    }
    setSearchParams(p, { replace: true });
  }

  if (selectedUser) {
    return (
      <DetailPage
        header={
          <PageHeader
            title="KPI"
            subtitle="Chi tiết điểm KPI nhân viên"
            breadcrumbs={[
              { label: 'HR' },
              { label: 'KPI' },
              { label: selectedUser.name },
            ]}
            actions={
              <div style={{ width: 110 }}>
                <TextInput
                  size="sm"
                  label="Kỳ"
                  value={period}
                  onChange={(v) => setPeriod(v)}
                />
              </div>
            }
          />
        }
      >
        <KpiDetail
          appUserId={selectedUser.id}
          period={period}
          employeeName={selectedUser.name}
          onBack={() => setSelectedUser(null)}
        />
      </DetailPage>
    );
  }

  return (
    <>
      <PageHeader
        title="KPI"
        subtitle="Xem và duyệt điểm KPI nhân viên theo kỳ"
        breadcrumbs={[{ label: 'HR' }, { label: 'KPI' }]}
        actions={
          <div style={{ width: 130 }}>
            <TextInput
              size="sm"
              label="Kỳ (YYYY-MM)"
              placeholder={defaultPeriod}
              value={period}
              onChange={(v) => setPeriod(v)}
            />
          </div>
        }
      />
      <div style={{ padding: 16 }}>
        <DataTable<StaffRow>
          columns={STAFF_COLS}
          data={staffRows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có nhân viên nào"
          onRowClick={(row) =>
            setSelectedUser({ id: row.id, name: row.fullName })
          }
        />
      </div>
    </>
  );
}

// KPI — P05 (QĐ0011, WF-P3-05).
//
// Key invariants:
// - kpi.confirm button: gated to canDo('kpi','confirm') — direct manager.
// - kpi.approve button: gated to canDo('kpi','approve') — GĐ only.
// - Neither button is rendered for roles that lack the permission (server
//   enforces as well; client gate is UI-only).
//
// Flow: staff list (user.list) → click employee → KpiDetail for
// selected employee × period. Period is synced to ?period= URL param.
//
// Note: no kpi.list endpoint exists. The list is built from user.list
// with per-user KPI queries opened on demand.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { ConfirmDialog, DataTable, PageHeader, StatusBadge } from '@cmc/ui';
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
  const [confirmAction, setConfirmAction] = useState<'confirm' | 'approve' | null>(
    null,
  );
  const [mutError, setMutError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = trpc.kpi.getForUser.useQuery(
    { appUserId, period },
    { retry: false },
  );

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

  const approveMut = trpc.kpi.approve.useMutation({
    onSuccess() {
      setConfirmAction(null);
      setMutError(null);
      void refetch();
    },
    onError(err) {
      setConfirmAction(null);
      setMutError(err.message ?? 'Lỗi duyệt KPI.');
    },
  });

  const isBusy = confirmMut.isPending || approveMut.isPending;

  return (
    <Stack gap="md">
      {/* Back nav */}
      <Group>
        <Button variant="subtle" size="xs" radius="xs" onClick={onBack}>
          ← Danh sách nhân viên
        </Button>
        <Text fw={600} fz="sm" c="dimmed">
          {employeeName} · {period}
        </Text>
      </Group>

      {isLoading && (
        <Text fz="sm" c="dimmed">
          Đang tải…
        </Text>
      )}

      {error && (
        <Alert color="orange" title="Chưa có điểm KPI" radius="xs">
          {error.message.toLowerCase().includes('not found')
            ? `Kỳ ${period} chưa có điểm KPI cho nhân viên này.`
            : error.message}
        </Alert>
      )}

      {mutError && (
        <Alert color="red" radius="xs">
          {mutError}
        </Alert>
      )}

      {data && (
        <Paper withBorder radius="xs" p="md">
          <Stack gap="sm">
            {/* Status */}
            <Group justify="space-between">
              <Text fz="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: '0.04em' }}>
                Trạng thái
              </Text>
              <StatusBadge
                status={data.status}
                label={KPI_STATUS_LABELS[data.status] ?? data.status}
              />
            </Group>

            {/* Score */}
            <Group justify="space-between">
              <Text fz="sm">Điểm KPI</Text>
              <Text fz="xl" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number(data.value).toLocaleString('vi-VN')}
              </Text>
            </Group>

            {/* Max */}
            <Group justify="space-between">
              <Text fz="sm" c="dimmed">
                Tối đa (kpiMax)
              </Text>
              <Text fz="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number(data.kpiMax).toLocaleString('vi-VN')}
              </Text>
            </Group>

            {/* Override badge */}
            {data.override && (
              <Alert color="orange" variant="light" radius="xs" title="Đã ghi đè (override)">
                {data.overrideReason
                  ? String(data.overrideReason)
                  : 'Giá trị đã được GĐ ghi đè.'}
              </Alert>
            )}

            {/* Action buttons — gated per role */}
            <Group gap="xs" pt="xs" style={{ borderTop: '1px solid var(--cmc-border)' }}>
              {/* Confirm: direct manager */}
              {canDo('kpi', 'confirm') && data.status === 'submitted' && (
                <Button
                  size="xs"
                  radius="xs"
                  color="blue"
                  variant="light"
                  disabled={isBusy}
                  onClick={() => setConfirmAction('confirm')}
                >
                  Xác nhận (Quản lý)
                </Button>
              )}

              {/* Approve: GĐ only — gated to kpi.approve permission */}
              {canDo('kpi', 'approve') && data.status === 'confirmed' && (
                <Button
                  size="xs"
                  radius="xs"
                  color="green"
                  disabled={isBusy}
                  onClick={() => setConfirmAction('approve')}
                >
                  Duyệt (GĐ)
                </Button>
              )}

              {data.status === 'approved' && (
                <Badge color="green" variant="light" radius="xs">
                  Đã duyệt — hoàn tất
                </Badge>
              )}
            </Group>
          </Stack>
        </Paper>
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

      {/* Confirm: GĐ approve */}
      <ConfirmDialog
        opened={confirmAction === 'approve'}
        title="Duyệt điểm KPI"
        message={`Duyệt điểm KPI của ${employeeName} cho kỳ ${period}? Hành động này khóa điểm KPI để tính lương.`}
        confirmLabel="Duyệt"
        confirmColor="green"
        loading={isBusy}
        onConfirm={() => {
          if (data) approveMut.mutate({ kpiScoreId: data.id });
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
      <>
        <PageHeader
          title="KPI"
          subtitle="Chi tiết điểm KPI nhân viên"
          breadcrumbs={[
            { label: 'HR' },
            { label: 'KPI' },
            { label: selectedUser.name },
          ]}
          actions={
            <TextInput
              size="xs"
              radius="xs"
              label="Kỳ"
              value={period}
              onChange={(e) => setPeriod(e.currentTarget.value)}
              w={110}
            />
          }
        />
        <Box p="md">
          <KpiDetail
            appUserId={selectedUser.id}
            period={period}
            employeeName={selectedUser.name}
            onBack={() => setSelectedUser(null)}
          />
        </Box>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="KPI"
        subtitle="Xem và duyệt điểm KPI nhân viên theo kỳ"
        breadcrumbs={[{ label: 'HR' }, { label: 'KPI' }]}
        actions={
          <TextInput
            size="xs"
            radius="xs"
            label="Kỳ (YYYY-MM)"
            placeholder={defaultPeriod}
            value={period}
            onChange={(e) => setPeriod(e.currentTarget.value)}
            w={130}
          />
        }
      />
      <Box p="md">
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
      </Box>
    </>
  );
}

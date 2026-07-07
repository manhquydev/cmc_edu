// Bảng lương — P05 (QĐ0025, WF-P3-05/06).
//
// Key invariants (QĐ0025):
// - Phạt (penaltyAmount) MUST be a separate, visually distinct line item.
//   It must NEVER be merged into base / variable / KPI rows.
// - Payslip access: own payslip or director/super_admin (server enforces;
//   user.list requires user.manage so this page is naturally director-facing).
//
// Flow: staff list (user.list) → click employee → PayslipDetail for
// selected employee × period. Period is synced to ?period= URL param.
//
// Note: no payslip.list endpoint exists. The list is built from user.list +
// per-user payslip queries opened on demand.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable, PageHeader, StatusBadge } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtVND(raw: unknown): string {
  return `${Number(raw).toLocaleString('vi-VN')} đ`;
}

function fmtInt(raw: unknown): number {
  return Number(raw);
}

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
// Payslip detail (per employee × period)
// ---------------------------------------------------------------------------
interface PayslipDetailProps {
  appUserId: string;
  period: string;
  employeeName: string;
  onBack: () => void;
}

function PayslipDetail({
  appUserId,
  period,
  employeeName,
  onBack,
}: PayslipDetailProps) {
  const { canDo } = useSession();

  const { data, isLoading, error, refetch } = trpc.payslip.getForUser.useQuery(
    { appUserId, period },
    { retry: false },
  );

  const assembleMut = trpc.payslip.assemble.useMutation({
    onSuccess() {
      void refetch();
    },
  });

  const finalizeMut = trpc.payslip.finalize.useMutation({
    onSuccess() {
      void refetch();
    },
  });

  const reopenMut = trpc.payslip.reopen.useMutation({
    onSuccess() {
      void refetch();
    },
  });

  const anyMutating =
    assembleMut.isPending || finalizeMut.isPending || reopenMut.isPending;

  const mutError =
    assembleMut.error?.message ??
    finalizeMut.error?.message ??
    reopenMut.error?.message;

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

      {/* Action bar */}
      {canDo('payslip', 'assemble') && (
        <Group gap="xs">
          <Button
            size="xs"
            radius="xs"
            variant="default"
            loading={anyMutating}
            onClick={() => assembleMut.mutate({ appUserId, period })}
          >
            Tính lương (assemble)
          </Button>
          {data && data.status === 'draft' && canDo('payslip', 'finalize') && (
            <Button
              size="xs"
              radius="xs"
              color="green"
              loading={anyMutating}
              onClick={() =>
                finalizeMut.mutate({ payslipId: data.id })
              }
            >
              Chốt bảng lương
            </Button>
          )}
          {data && data.status === 'finalized' && canDo('payslip', 'reopen') && (
            <Button
              size="xs"
              radius="xs"
              color="orange"
              variant="light"
              loading={anyMutating}
              onClick={() =>
                reopenMut.mutate({ payslipId: data.id })
              }
            >
              Mở lại (reopen)
            </Button>
          )}
        </Group>
      )}

      {mutError && (
        <Alert color="red" radius="xs">
          {mutError}
        </Alert>
      )}

      {isLoading && (
        <Text fz="sm" c="dimmed">
          Đang tải…
        </Text>
      )}

      {error && (
        <Alert color="orange" title="Chưa có bảng lương" radius="xs">
          {error.message.toLowerCase().includes('not found')
            ? `Kỳ ${period} chưa có bảng lương. Nhấn "Tính lương" để tạo bản nháp.`
            : error.message}
        </Alert>
      )}

      {/* ----------------------------------------------------------------
          Payslip breakdown
          Rule QĐ0025: penalties MUST appear as a separate deduction row,
          visually distinct from income components (base / variable / KPI).
      ---------------------------------------------------------------- */}
      {data && (
        <Paper withBorder radius="xs" p={0} style={{ overflow: 'hidden' }}>
          {/* Header */}
          <Box
            px="md"
            py="sm"
            style={{ background: 'var(--cmc-surface-2)', borderBottom: '1px solid var(--cmc-border)' }}
          >
            <Group justify="space-between">
              <Text fz="sm" fw={600}>
                Phiếu lương · {period}
              </Text>
              <StatusBadge
                status={data.status}
                label={data.status === 'finalized' ? 'Đã chốt' : 'Nháp'}
              />
            </Group>
          </Box>

          {/* Line items */}
          <Stack gap={0} px="md">
            {/* Income components */}
            <LineRow label="Lương cơ bản" value={fmtVND(data.baseSalary)} />
            <LineRow label="Lương biến đổi" value={fmtVND(data.variablePay)} />
            <LineRow label="Thưởng KPI" value={fmtVND(data.kpiBonus)} />

            {/* ---- Penalty row ---- MUST be a separate, distinct deduction */}
            <PenaltyRow
              penaltyAmount={data.penaltyAmount}
              lateMinutes={fmtInt(data.lateMinutes)}
              earlyMinutes={fmtInt(data.earlyMinutes)}
              unpunchedDays={fmtInt(data.unpunchedDays)}
            />

            {/* Net total */}
            <NetRow value={fmtVND(data.totalNet)} />
          </Stack>

          {/* Attendance detail footer */}
          <Box
            px="md"
            py="xs"
            style={{
              borderTop: '1px solid var(--cmc-border)',
              background: 'var(--cmc-surface-2)',
            }}
          >
            <Text fz="xs" c="dimmed">
              Chấm công không có ca:{' '}
              <Text span fw={500}>
                {fmtInt(data.flaggedPunches)} lần
              </Text>{' '}
              (ghi nhận, không phạt — xem chi tiết trong payslip.assemble)
            </Text>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for payslip rows
// ---------------------------------------------------------------------------
function LineRow({ label, value }: { label: string; value: string }) {
  return (
    <Group
      justify="space-between"
      py={10}
      style={{ borderBottom: '1px solid var(--cmc-border)' }}
    >
      <Text fz="sm">{label}</Text>
      <Text fz="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Group>
  );
}

/** Penalty row — visually distinct per QĐ0025. Red background, separate label. */
function PenaltyRow({
  penaltyAmount,
  lateMinutes,
  earlyMinutes,
  unpunchedDays,
}: {
  penaltyAmount: unknown;
  lateMinutes: number;
  earlyMinutes: number;
  unpunchedDays: number;
}) {
  const hasDetail = lateMinutes > 0 || earlyMinutes > 0 || unpunchedDays > 0;
  return (
    <Group
      justify="space-between"
      py={10}
      px={12}
      mx={-16}
      style={{
        borderBottom: '1px solid var(--cmc-border)',
        background: 'color-mix(in srgb, var(--cmc-danger) 7%, transparent)',
      }}
    >
      <Stack gap={2}>
        <Text fz="sm" fw={600} c="red">
          Phạt khấu trừ
        </Text>
        {hasDetail && (
          <Text fz="xs" c="dimmed">
            {lateMinutes > 0 ? `Đi muộn ${lateMinutes} phút` : ''}
            {lateMinutes > 0 && (earlyMinutes > 0 || unpunchedDays > 0)
              ? ' · '
              : ''}
            {earlyMinutes > 0 ? `Về sớm ${earlyMinutes} phút` : ''}
            {earlyMinutes > 0 && unpunchedDays > 0 ? ' · ' : ''}
            {unpunchedDays > 0 ? `Vắng ${unpunchedDays} ngày` : ''}
          </Text>
        )}
      </Stack>
      <Text fz="sm" fw={600} c="red" style={{ fontVariantNumeric: 'tabular-nums' }}>
        − {fmtVND(penaltyAmount)}
      </Text>
    </Group>
  );
}

function NetRow({ value }: { value: string }) {
  return (
    <Group
      justify="space-between"
      py={12}
      style={{ background: 'var(--cmc-surface-2)', margin: '0 -16px', padding: '12px 16px' }}
    >
      <Text fz="sm" fw={700}>
        Thực lĩnh (Net)
      </Text>
      <Text
        fz="lg"
        fw={700}
        style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--cmc-brand)' }}
      >
        {value}
      </Text>
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function PayrollPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Default to current YYYY-MM in ICT
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
          title="Bảng lương"
          subtitle="Chi tiết phiếu lương nhân viên"
          breadcrumbs={[
            { label: 'HR' },
            { label: 'Bảng lương' },
            { label: selectedUser.name },
          ]}
          actions={
            <TextInput
              size="xs"
              radius="xs"
              label="Kỳ lương"
              value={period}
              onChange={(e) => setPeriod(e.currentTarget.value)}
              w={120}
            />
          }
        />
        <Box p="md">
          <PayslipDetail
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
        title="Bảng lương"
        subtitle="Chọn nhân viên để xem / chốt lương theo tháng"
        breadcrumbs={[{ label: 'HR' }, { label: 'Bảng lương' }]}
        actions={
          <TextInput
            size="xs"
            radius="xs"
            label="Kỳ lương (YYYY-MM)"
            placeholder={defaultPeriod}
            value={period}
            onChange={(e) => setPeriod(e.currentTarget.value)}
            w={140}
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

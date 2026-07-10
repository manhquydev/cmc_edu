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
  Banner,
  Button,
  Card,
  DataTable,
  HStack,
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
    <Stack gap={3}>
      {/* Back nav */}
      <HStack gap={2} align="center">
        <Button label="← Danh sách nhân viên" variant="ghost" size="sm" onClick={onBack} />
        <Text type="supporting" size="sm" weight="semibold">
          {employeeName} · {period}
        </Text>
      </HStack>

      {/* Action bar */}
      {canDo('payslip', 'assemble') && (
        <HStack gap={1}>
          <Button
            label="Tính lương (assemble)"
            size="sm"
            variant="secondary"
            isLoading={anyMutating}
            isDisabled={anyMutating}
            onClick={() => assembleMut.mutate({ appUserId, period })}
          />
          {data && data.status === 'draft' && canDo('payslip', 'finalize') && (
            <Button
              label="Chốt bảng lương"
              size="sm"
              variant="primary"
              isLoading={anyMutating}
              isDisabled={anyMutating}
              onClick={() => finalizeMut.mutate({ payslipId: data.id })}
            />
          )}
          {data && data.status === 'finalized' && canDo('payslip', 'reopen') && (
            <Button
              label="Mở lại (reopen)"
              size="sm"
              variant="secondary"
              isLoading={anyMutating}
              isDisabled={anyMutating}
              onClick={() => reopenMut.mutate({ payslipId: data.id })}
            />
          )}
        </HStack>
      )}

      {mutError && <Banner status="error" title={mutError} />}

      {isLoading && (
        <Text type="supporting" size="sm">
          Đang tải…
        </Text>
      )}

      {error && (
        <Banner
          status="warning"
          title="Chưa có bảng lương"
          description={
            error.message.toLowerCase().includes('not found')
              ? `Kỳ ${period} chưa có bảng lương. Nhấn "Tính lương" để tạo bản nháp.`
              : error.message
          }
        />
      )}

      {/* ----------------------------------------------------------------
          Payslip breakdown
          Rule QĐ0025: penalties MUST appear as a separate deduction row,
          visually distinct from income components (base / variable / KPI).
      ---------------------------------------------------------------- */}
      {data && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--cmc-surface-2)',
              borderBottom: '1px solid var(--cmc-border)',
            }}
          >
            <HStack justify="between">
              <Text type="body" size="sm" weight="semibold">
                Phiếu lương · {period}
              </Text>
              <StatusBadge
                status={data.status}
                label={data.status === 'finalized' ? 'Đã chốt' : 'Nháp'}
              />
            </HStack>
          </div>

          {/* Line items */}
          <Stack gap={0} paddingInline={4}>
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
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--cmc-border)',
              background: 'var(--cmc-surface-2)',
            }}
          >
            <Text type="supporting" size="2xs">
              Chấm công không có ca:{' '}
              <Text type="supporting" size="2xs" weight="medium" as="span">
                {fmtInt(data.flaggedPunches)} lần
              </Text>{' '}
              (ghi nhận, không phạt — xem chi tiết trong payslip.assemble)
            </Text>
          </div>
        </Card>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for payslip rows
// ---------------------------------------------------------------------------
function LineRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack
      justify="between"
      paddingBlock={1.5}
      style={{ borderBottom: '1px solid var(--cmc-border)' }}
    >
      <Text type="body" size="sm">{label}</Text>
      <Text type="body" size="sm" weight="medium" hasTabularNumbers>
        {value}
      </Text>
    </HStack>
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
    <HStack
      justify="between"
      paddingBlock={1.5}
      style={{
        paddingInline: 12,
        margin: '0 -16px',
        borderBottom: '1px solid var(--cmc-border)',
        background: 'color-mix(in srgb, var(--cmc-danger) 7%, transparent)',
      }}
    >
      <Stack gap={0.5}>
        {/* TODO(astryx-review): Text's `color` prop is a fixed semantic enum
            (primary/secondary/disabled/placeholder/accent/inherit) with no
            danger/red slot — kept as a plain <span style> per the documented
            fallback (same pattern as receipt-detail's pipeline labels). */}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cmc-danger)' }}>
          Phạt khấu trừ
        </span>
        {hasDetail && (
          <Text type="supporting" size="2xs">
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
      {/* TODO(astryx-review): same raw-color fallback as the label above. */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--cmc-danger)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        − {fmtVND(penaltyAmount)}
      </span>
    </HStack>
  );
}

function NetRow({ value }: { value: string }) {
  return (
    <HStack
      justify="between"
      style={{ background: 'var(--cmc-surface-2)', margin: '0 -16px', padding: '12px 16px' }}
    >
      <Text type="body" size="sm" weight="bold">
        Thực lĩnh (Net)
      </Text>
      {/* TODO(astryx-review): brand-color net total has no Text color-enum
          slot — kept as a plain <span style> per the documented fallback. */}
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--cmc-brand)',
        }}
      >
        {value}
      </span>
    </HStack>
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
            <div style={{ width: 120 }}>
              <TextInput
                size="sm"
                label="Kỳ lương"
                value={period}
                onChange={(v) => setPeriod(v)}
              />
            </div>
          }
        />
        <div style={{ padding: 16 }}>
          <PayslipDetail
            appUserId={selectedUser.id}
            period={period}
            employeeName={selectedUser.name}
            onBack={() => setSelectedUser(null)}
          />
        </div>
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
          <div style={{ width: 140 }}>
            <TextInput
              size="sm"
              label="Kỳ lương (YYYY-MM)"
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

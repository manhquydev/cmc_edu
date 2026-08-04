// Bảng lương — P05 (QĐ0025, WF-P3-05/06).
//
// Key invariants (QĐ0025):
// - Phạt (penaltyAmount) MUST be a separate, visually distinct line item.
//   It must NEVER be merged into base / variable / KPI rows.
// - Payslip access: own payslip or director/super_admin (server enforces).
//   The staff picker reads `user.pickList` (key `staff.pickList`, the two
//   directors) — it used to call `user.list`, which needs `user.manage`, an
//   empty roster only super_admin satisfies, so the directors this page is
//   built for saw an empty list.
//
// HR remediation phase 5 (R3-2): the tier-based salary model REPLACED the old
// formula (base + variable + kpiBonus). `variablePay` is now a deprecated
// column that is always written 0 (payroll/router.ts) — the "Lương biến đổi"
// row is REMOVED from this breakdown (showing a permanent 0 row would be
// misleading, not merely stale). `kpiBonus` is REUSED to carry "PHẦN NHÂN"
// (%côngca × %chỉ-số × đơn giá) — relabeled accordingly, value unchanged.
//
// Flow: staff list (user.pickList) → click employee → PayslipDetail for
// selected employee × period. Period is synced to ?period= URL param.
//
// Note: no payslip.list endpoint exists. The list is built from user.pickList +
// per-user payslip queries opened on demand.

import { useSearchParams } from 'react-router-dom';
import { UUID_RE, readUuidParam } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import {
  Banner,
  Button,
  Card,
  DataTable,
  DetailPage,
  HStack,
  LineIcon,
  ListPage,
  PageHeader,
  Skeleton,
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

// HR remediation (post-audit fix): branch on `err.data.appCode`
// (PAYSLIP_NOT_FOUND — trpc.ts's errorFormatter, apps/api/src/errors.ts's
// AppCodeError), NOT string-matching err.message (same posture as
// attendance/check-in-out.tsx's `readAppCode`).
function readAppCode(err: { data?: unknown; message?: string } | null | undefined): string | undefined {
  const data = err?.data as { appCode?: unknown } | null | undefined;
  return typeof data?.appCode === 'string' ? data.appCode : undefined;
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

  // Only surface the LAST-triggered mutation's error, and clear siblings
  // before firing a new one — otherwise a stale error from a prior failed
  // assemble sticks in the banner even when finalize/reopen succeed.
  const activeMut =
    assembleMut.isPending ? assembleMut
    : finalizeMut.isPending ? finalizeMut
    : reopenMut.isPending ? reopenMut
    : (assembleMut.error ? assembleMut
      : finalizeMut.error ? finalizeMut
      : reopenMut.error ? reopenMut
      : null);
  const mutError = activeMut?.error?.message;

  const runAssemble = () => {
    finalizeMut.reset();
    reopenMut.reset();
    assembleMut.mutate({ appUserId, period });
  };
  const runFinalize = (payslipId: string) => {
    assembleMut.reset();
    reopenMut.reset();
    finalizeMut.mutate({ payslipId });
  };
  const runReopen = (payslipId: string) => {
    assembleMut.reset();
    finalizeMut.reset();
    reopenMut.mutate({ payslipId });
  };

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

      {/* Action bar */}
      {canDo('payslip', 'assemble') && (
        <HStack gap={1}>
          <Button
            label="Tính lương (assemble)"
            size="sm"
            variant="secondary"
            isLoading={anyMutating}
            isDisabled={anyMutating}
            onClick={runAssemble}
          />
          {data && data.status === 'draft' && canDo('payslip', 'finalize') && (
            <Button
              label="Chốt bảng lương"
              size="sm"
              variant="primary"
              isLoading={anyMutating}
              isDisabled={anyMutating}
              onClick={() => runFinalize(data.id)}
            />
          )}
          {data && data.status === 'finalized' && canDo('payslip', 'reopen') && (
            <Button
              label="Mở lại (reopen)"
              size="sm"
              variant="secondary"
              isLoading={anyMutating}
              isDisabled={anyMutating}
              onClick={() => runReopen(data.id)}
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
            readAppCode(error) === 'PAYSLIP_NOT_FOUND'
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
            {/* Income components — HR remediation phase 5 (R3-2): "Lương biến
                đổi" row removed (variablePay is a deprecated column always
                written 0 under the tier model); "Thưởng KPI" relabeled to
                describe the tier formula (kpiBonus column reused, value
                unchanged — see payroll/router.ts). */}
            <LineRow label="Lương cơ bản" value={fmtVND(data.baseSalary)} />
            <LineRow label="Phần KPI (%côngca × %chỉ-số × đơn giá)" value={fmtVND(data.kpiBonus)} />

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
        paddingInline: 'var(--cmc-space-3)',
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
  // AppUser.id in the URL — hydrate name from pickList (never breadcrumb `undefined`).
  const userIdParam = readUuidParam(searchParams, 'userId');

  const { data, isLoading, error } = trpc.user.pickList.useQuery({});

  const staffRows: StaffRow[] = (data?.items ?? []).map((u) => ({
    id: u.id,
    fullName: u.fullName,
    employeeCode: u.employeeCode,
    position: u.position,
  }));

  const selectedFromList = userIdParam
    ? staffRows.find((r) => r.id === userIdParam) ?? null
    : null;

  function setPeriod(value: string) {
    const p = new URLSearchParams(searchParams);
    if (value) {
      p.set('period', value);
    } else {
      p.delete('period');
    }
    setSearchParams(p, { replace: true });
  }

  function selectUser(user: { id: string; name: string } | null) {
    const p = new URLSearchParams(searchParams);
    if (user && UUID_RE.test(user.id)) p.set('userId', user.id);
    else p.delete('userId');
    setSearchParams(p, { replace: true });
  }

  // Frame branch only — all hooks above run unconditionally (list + detail share
  // period/search state; payslip queries live inside PayslipDetail).

  // Deep-link hydrate: userId present, pickList still loading → explicit loading
  // chrome (not breadcrumb with undefined name).
  if (userIdParam && isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            title="Bảng lương"
            subtitle="Chi tiết phiếu lương nhân viên"
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Bảng lương' },
              { label: 'Đang tải…' },
            ]}
            actions={<CopyLinkButton mode="current" />}
          />
        }
      >
        <Skeleton height={200} radius={1} />
      </DetailPage>
    );
  }

  // Resolved selection from pickList. Stale userId (not in list) falls through
  // to the staff list — treat as unset, never render undefined employee name.
  if (userIdParam && selectedFromList) {
    return (
      <DetailPage
        header={
          <PageHeader
            title="Bảng lương"
            subtitle="Chi tiết phiếu lương nhân viên"
            breadcrumbs={[
              { label: 'Nhân sự' },
              { label: 'Bảng lương' },
              { label: selectedFromList.fullName },
            ]}
            actions={
              <HStack gap={1} align="end">
                <CopyLinkButton mode="current" />
                <div style={{ width: 120 }}>
                  <TextInput
                    size="sm"
                    label="Kỳ lương"
                    value={period}
                    onChange={(v) => setPeriod(v)}
                  />
                </div>
              </HStack>
            }
          />
        }
      >
        <PayslipDetail
          appUserId={selectedFromList.id}
          period={period}
          employeeName={selectedFromList.fullName}
          onBack={() => selectUser(null)}
        />
      </DetailPage>
    );
  }

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Bảng lương"
          subtitle="Chọn nhân viên để xem / chốt lương theo tháng"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Bảng lương' }]}
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
      }
    >
      <DataTable<StaffRow>
        columns={STAFF_COLS}
        data={staffRows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có nhân viên nào"
        onRowClick={(row) =>
          selectUser({ id: row.id, name: row.fullName })
        }
      />
    </ListPage>
  );
}

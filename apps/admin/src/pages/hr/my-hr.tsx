// "Của tôi" — HR remediation phase 5 (R3-10, red-team #22): gộp trang
// my-kpi + my-payslip thành 1 trang 2 tab (KPI | Lương). Payslip/phiếu KPI
// chỉ dành cho sale/giao_vien (validate s4 — lương 2 GĐ/super_admin ngoài
// hệ thống) — cả hai tab render EmptyState cho vai trò GĐ/super_admin.

import { useState } from 'react';
import {
  Banner,
  Button,
  Card,
  CmcTabs,
  DetailPage,
  EmptyState,
  HStack,
  LineIcon,
  PageHeader,
  Stack,
  StatusBadge,
  Text,
  TextInput,
} from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function defaultPeriodICT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
}

function nowICTDateOnly(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Mirrors auto-score.ts's `submitSlipOpensAt` (day 3 of the FOLLOWING ICT
 * month) for the disabled/tooltip UX only — the server remains authoritative. */
function submitOpensAtDateOnly(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-03`;
}

function submitSlipIsOpen(period: string): boolean {
  return nowICTDateOnly() >= submitOpensAtDateOnly(period);
}

function isPayrollEligible(roles: readonly string[]): boolean {
  return roles.includes('sale') || roles.includes('giao_vien');
}

function fmtVND(raw: unknown): string {
  return `${Number(raw).toLocaleString('vi-VN')} đ`;
}

const KPI_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  approved: 'Đã duyệt',
};

// ---------------------------------------------------------------------------
// KPI tab
// ---------------------------------------------------------------------------
function MyKpiTab({ period }: { period: string }) {
  const { data, isLoading, error, refetch } = trpc.kpi.myScore.useQuery({ period });

  const refreshMut = trpc.kpi.refresh.useMutation({ onSuccess: () => void refetch() });
  const submitMut = trpc.kpi.submitSlip.useMutation({ onSuccess: () => void refetch() });

  const slipOpen = submitSlipIsOpen(period);
  const canSubmit = Boolean(data) && data!.status === 'draft' && slipOpen && !data!.tierMissing;

  return (
    <Stack gap={3} padding={4}>
      <HStack gap={1}>
        <Button
          label="Tính lại"
          size="sm"
          variant="secondary"
          isLoading={refreshMut.isPending}
          onClick={() => refreshMut.mutate({ period })}
        />
        <Button
          label="Nộp"
          size="sm"
          variant="primary"
          isLoading={submitMut.isPending}
          isDisabled={!canSubmit}
          onClick={() => submitMut.mutate({ period })}
        />
      </HStack>

      {!slipOpen && (
        <Text type="supporting" size="xsm">
          Chỉ có thể nộp phiếu KPI kỳ {period} từ ngày {submitOpensAtDateOnly(period).slice(8, 10)}/
          {submitOpensAtDateOnly(period).slice(5, 7)}/{submitOpensAtDateOnly(period).slice(0, 4)} (ICT).
        </Text>
      )}

      {refreshMut.error && <Banner status="error" title={refreshMut.error.message} />}
      {submitMut.error && <Banner status="error" title={submitMut.error.message} />}

      {isLoading && (
        <Text type="supporting" size="sm">
          Đang tải…
        </Text>
      )}

      {error && (
        <Banner status="warning" title="Không tải được điểm KPI" description={error.message} />
      )}

      {!isLoading && !error && !data && (
        <Banner
          status="info"
          title="Chưa có phiếu KPI"
          description={`Kỳ ${period} chưa có phiếu KPI. Nhấn "Tính lại" để hệ thống tự tính.`}
        />
      )}

      {data && (
        <Card padding={3}>
          <Stack gap={2}>
            <HStack justify="between">
              <Text type="supporting" size="2xs" weight="semibold" style={{ textTransform: 'uppercase' }}>
                Trạng thái
              </Text>
              <StatusBadge status={data.status} label={KPI_STATUS_LABELS[data.status] ?? data.status} />
            </HStack>

            {data.tierMissing && (
              <Banner
                status="warning"
                title="Chưa gán bậc lương"
                description="Liên hệ GĐ để được gán bậc lương trước khi phiếu KPI có thể nộp."
              />
            )}

            <HStack justify="between">
              <Text type="body" size="sm">
                Công ca (%công ca thực/yêu cầu)
              </Text>
              <Text type="body" size="sm" weight="medium" hasTabularNumbers>
                {data.shiftActual ?? 0} / {data.shiftRequired ?? '—'}
              </Text>
            </HStack>

            <HStack justify="between">
              <Text type="body" size="sm">
                Chỉ số (thực/yêu cầu)
              </Text>
              <Text type="body" size="sm" weight="medium" hasTabularNumbers>
                {data.metricValue !== null && data.metricValue !== undefined
                  ? Number(data.metricValue).toLocaleString('vi-VN')
                  : '—'}{' '}
                / {data.quotaSnapshot !== null && data.quotaSnapshot !== undefined
                  ? Number(data.quotaSnapshot).toLocaleString('vi-VN')
                  : '—'}
              </Text>
            </HStack>

            <HStack justify="between" paddingBlock={1} style={{ borderTop: '1px solid var(--cmc-border)' }}>
              <Text type="body" size="sm" weight="semibold">
                Phần KPI (%côngca × %chỉ-số × đơn giá)
              </Text>
              <Text type="body" size="xl" weight="bold" hasTabularNumbers>
                {fmtVND(data.value)}
              </Text>
            </HStack>

            {data.override && (
              <Banner
                status="warning"
                title="Đã ghi đè (override)"
                description={data.overrideReason ? String(data.overrideReason) : 'Giá trị đã được GĐ ghi đè.'}
              />
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Lương tab
// ---------------------------------------------------------------------------
function MyPayslipTab({ period }: { period: string }) {
  const { data, isLoading, error } = trpc.payslip.my.useQuery({ period });

  return (
    <Stack gap={3} padding={4}>
      {isLoading && (
        <Text type="supporting" size="sm">
          Đang tải…
        </Text>
      )}

      {error && (
        <Banner status="warning" title="Không tải được bảng lương" description={error.message} />
      )}

      {!isLoading && !error && !data && (
        <EmptyState
          title="Chưa có bảng lương"
          description={`Kỳ ${period} chưa được tính lương.`}
          icon={<LineIcon name="dollar" size={28} />}
        />
      )}

      {data && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: 'var(--cmc-space-2) var(--cmc-space-3)',
              background: 'var(--cmc-surface-2)',
              borderBottom: '1px solid var(--cmc-border)',
            }}
          >
            <HStack justify="between">
              <Text type="body" size="sm" weight="semibold">
                Phiếu lương · {period}
              </Text>
              <StatusBadge status={data.status} label={data.status === 'finalized' ? 'Đã chốt' : 'Nháp'} />
            </HStack>
          </div>
          <Stack gap={0} paddingInline={4}>
            <HStack justify="between" paddingBlock={1.5} style={{ borderBottom: '1px solid var(--cmc-border)' }}>
              <Text type="body" size="sm">Lương cơ bản</Text>
              <Text type="body" size="sm" weight="medium" hasTabularNumbers>{fmtVND(data.baseSalary)}</Text>
            </HStack>
            <HStack justify="between" paddingBlock={1.5} style={{ borderBottom: '1px solid var(--cmc-border)' }}>
              <Text type="body" size="sm">Phần KPI (%côngca × %chỉ-số × đơn giá)</Text>
              <Text type="body" size="sm" weight="medium" hasTabularNumbers>{fmtVND(data.kpiBonus)}</Text>
            </HStack>
            {/* TODO(astryx-review): danger-colour deduction row has no Text
                color-enum slot — same documented fallback as payroll.tsx. */}
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
              <span style={{ fontSize: 'var(--cmc-font-size-data)', fontWeight: 600, color: 'var(--cmc-danger)' }}>Phạt khấu trừ</span>
              <span style={{ fontSize: 'var(--cmc-font-size-data)', fontWeight: 600, color: 'var(--cmc-danger)', fontVariantNumeric: 'tabular-nums' }}>
                − {fmtVND(data.penaltyAmount)}
              </span>
            </HStack>
            <HStack justify="between" style={{ background: 'var(--cmc-surface-2)', margin: '0 -16px', padding: '12px var(--cmc-space-3)' }}>
              <Text type="body" size="sm" weight="bold">Thực lĩnh</Text>
              <span style={{ fontSize: 'var(--cmc-fs-title)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--cmc-brand)' }}>
                {fmtVND(data.totalNet)}
              </span>
            </HStack>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function MyHrPage() {
  const { me } = useSession();
  const [period, setPeriod] = useState(defaultPeriodICT());
  const [activeTab, setActiveTab] = useState('kpi');

  const eligible = isPayrollEligible(me?.roles ?? []);

  const kpiContent = eligible ? (
    <MyKpiTab period={period} />
  ) : (
    <EmptyState
      title="Không áp dụng cho vai trò Giám đốc"
      description="Lương giám đốc/Quản trị hệ thống quản lý ngoài hệ thống — không có phiếu KPI."
      icon={<LineIcon name="target" size={28} />}
    />
  );

  const payslipContent = eligible ? (
    <MyPayslipTab period={period} />
  ) : (
    <EmptyState
      title="Không áp dụng cho vai trò Giám đốc"
      description="Lương giám đốc/Quản trị hệ thống quản lý ngoài hệ thống."
      icon={<LineIcon name="dollar" size={28} />}
    />
  );

  return (
    <DetailPage
      header={
        <PageHeader
          title="Của tôi"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Của tôi' }]}
          actions={
            <div style={{ width: 130 }}>
              <TextInput size="sm" label="Kỳ (YYYY-MM)" value={period} onChange={(v) => setPeriod(v)} />
            </div>
          }
        />
      }
      tabs={
        <CmcTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            { id: 'kpi', label: 'KPI', content: kpiContent },
            { id: 'payslip', label: 'Lương', content: payslipContent },
          ]}
        />
      }
    />
  );
}

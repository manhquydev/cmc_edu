// Báo cáo tuyển sinh CRM — P1 (read-only aggregates).
//
// Three time-labeled blocks (plan 260808-2217 phase-01):
//  1. Ảnh chụp phễu hiện tại (no date filter)
//  2. Nhóm lead vào theo kỳ (createdAt)
//  3. Kết quả đóng trong kỳ (closedAt)
//
// Pattern: tables + % ratios like revenue-report — no chart library (YAGNI).

import { useMemo, useState } from 'react';
import {
  Banner,
  DashboardPage,
  FilterBar,
  Grid,
  HStack,
  Panel,
  Skeleton,
  Stack,
  StatCard,
  Text,
  type FilterDef,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { LOST_REASON_LABELS } from './mark-lost-dialog.js';
import { SOURCE_LABELS } from './create-lead-dialog.js';

// ---------------------------------------------------------------------------
// Stage labels (same map as pipeline.tsx / cockpit)
// ---------------------------------------------------------------------------
const STAGE_ORDER = [
  'O1_LEAD',
  'O2_CONTACTED',
  'O3_TEST_SCHEDULED',
  'O4_TESTED',
  'O5_ENROLLED',
] as const;

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch kiểm tra',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const FILTERS: FilterDef[] = [
  { key: 'from', label: 'Từ ngày', type: 'date' },
  { key: 'to', label: 'Đến ngày', type: 'date' },
];

function defaultMonthRange(): { from: string; to: string } {
  // Local calendar month (admin users operate in VN / ICT).
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function toFromIso(dateText: string): string | undefined {
  if (!dateText || !DATE_ONLY.test(dateText)) return undefined;
  const d = new Date(`${dateText}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toToIso(dateText: string): string | undefined {
  if (!dateText || !DATE_ONLY.test(dateText)) return undefined;
  const d = new Date(`${dateText}T23:59:59.999+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function isInverted(from: string, to: string): boolean {
  return Boolean(from && to && DATE_ONLY.test(from) && DATE_ONLY.test(to) && from > to);
}

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

function formatSource(source: string | null): string {
  if (!source) return '(Không rõ nguồn)';
  return SOURCE_LABELS[source] ?? source;
}

function formatReason(reason: string): string {
  return LOST_REASON_LABELS[reason] ?? reason;
}

function SimpleTable({
  headers,
  rows,
  empty,
  testId,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  empty: string;
  testId?: string;
}) {
  if (rows.length === 0) {
    return (
      <div data-testid={testId ? `${testId}-empty` : undefined}>
        <Text type="supporting" size="sm">
          {empty}
        </Text>
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }} data-testid={testId}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: 'var(--cmc-space-2) 10px',
                  borderBottom: '1px solid var(--cmc-border)',
                  fontWeight: 600,
                  fontSize: 'var(--cmc-fs-meta)',
                  color: 'var(--cmc-text-supporting)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: 'var(--cmc-space-2) 10px',
                    borderBottom: '1px solid var(--cmc-border-subtle, var(--cmc-border))',
                    fontSize: 'var(--cmc-font-size-data)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CrmReportPage() {
  const { me } = useSession();
  const isManager = Boolean(
    me?.roles.includes('giam_doc_kinh_doanh') || me?.roles.includes('super_admin'),
  );
  const defaults = useMemo(() => defaultMonthRange(), []);
  const [filters, setFilters] = useState<Record<string, string>>({
    from: defaults.from,
    to: defaults.to,
  });

  const rangeInvalid = isInverted(filters.from, filters.to);
  const fromIso = rangeInvalid ? undefined : toFromIso(filters.from);
  const toIso = rangeInvalid ? undefined : toToIso(filters.to);
  const enabled = Boolean(fromIso && toIso && !rangeInvalid);

  const { data, isLoading, error } = trpc.crm.opportunityReport.useQuery(
    { from: fromIso!, to: toIso! },
    { enabled },
  );

  const funnelRows = STAGE_ORDER.map((stage) => {
    const count = data?.funnelSnapshot.stageCounts[stage] ?? 0;
    return [STAGE_LABELS[stage] ?? stage, count] as Array<string | number>;
  });
  const funnelTotal = funnelRows.reduce((s, r) => s + (r[1] as number), 0);

  const lostReasonRows =
    data?.closedOutcomes.lostByReason.map((r) => [
      formatReason(r.reason),
      r.count,
      pct(r.count, data.closedOutcomes.lostCount),
    ]) ?? [];

  const sourceRows =
    data?.closedOutcomes.bySource.map((r) => [
      formatSource(r.source),
      r.enrolled,
      r.lost,
      r.total,
      pct(r.enrolled, r.total),
    ]) ?? [];

  const assigneeRows =
    data?.closedOutcomes.byAssignee.map((r) => [
      r.fullName ?? (r.assignedToId ? `…${r.assignedToId.slice(-6)}` : '(Chưa gán)'),
      r.enrolled,
      r.lost,
      r.total,
      pct(r.enrolled, r.total),
    ]) ?? [];

  return (
    <div data-testid="crm-report-page">
      <DashboardPage
        title="Báo cáo tuyển sinh"
        metrics={
          <Grid columns={{ minWidth: 200, max: 4 }} gap={4}>
            <div data-testid="crm-report-stat-intake">
              <StatCard
                label="Lead vào kỳ (theo ngày tạo)"
                value={data?.intakeCohort.totalCreated ?? 0}
                loading={isLoading}
              />
            </div>
            <div data-testid="crm-report-stat-enrolled">
              <StatCard
                label="Nhập học trong kỳ (theo ngày đóng)"
                value={data?.closedOutcomes.enrolledCount ?? 0}
                loading={isLoading}
              />
            </div>
            <div data-testid="crm-report-stat-lost">
              <StatCard
                label="Mất trong kỳ (theo ngày đóng)"
                value={data?.closedOutcomes.lostCount ?? 0}
                loading={isLoading}
              />
            </div>
            <StatCard
              label="Tỷ lệ nhập học / lead vào kỳ"
              value={
                data
                  ? pct(data.intakeCohort.enrolledCount, data.intakeCohort.totalCreated)
                  : '—'
              }
              loading={isLoading}
            />
          </Grid>
        }
        primary={
          <Stack gap={4}>
            <div data-testid="crm-report-filters">
              <FilterBar
                filters={FILTERS}
                value={filters}
                onChange={(next) => setFilters({ from: '', to: '', ...next })}
              />
            </div>

            {rangeInvalid && (
              <Banner
                status="warning"
                title="Khoảng ngày không hợp lệ"
                description='"Từ ngày" phải trước hoặc bằng "Đến ngày".'
              />
            )}

            {error && (
              <Banner status="error" title="Lỗi tải báo cáo" description={error.message} />
            )}

            {/* Block 1 — current funnel snapshot */}
            <div data-testid="crm-report-funnel">
              <Panel title="Ảnh chụp phễu hiện tại" icon="target">
                <div style={{ padding: '0 22px 20px' }}>
                  <Text type="supporting" size="xsm" style={{ display: 'block', marginBottom: 12 }}>
                    Mốc thời gian: <strong>hiện tại</strong> — không lọc theo khoảng ngày. Đếm cơ
                    hội đang mở + đã nhập học; đã mất không nằm trong cột phễu.
                  </Text>
                  {isLoading ? (
                    <Skeleton height={120} radius={1} />
                  ) : (
                    <Stack gap={3}>
                      <SimpleTable
                        headers={['Bước phễu', 'Số cơ hội']}
                        rows={funnelRows}
                        empty="Chưa có cơ hội."
                        testId="crm-report-funnel-table"
                      />
                      <HStack gap={4}>
                        <Text size="sm">Tổng trong phễu: {funnelTotal}</Text>
                        <Text size="sm" type="supporting">
                          Đã mất (ngoài phễu): {data?.funnelSnapshot.lostCount ?? 0}
                        </Text>
                      </HStack>
                    </Stack>
                  )}
                </div>
              </Panel>
            </div>

            {/* Block 2 — intake cohort by createdAt */}
            <div data-testid="crm-report-cohort">
              <Panel title="Nhóm lead vào theo kỳ" icon="users">
                <div style={{ padding: '0 22px 20px' }}>
                  <Text type="supporting" size="xsm" style={{ display: 'block', marginBottom: 12 }}>
                    Mốc thời gian: <strong>ngày tạo</strong> trong khoảng đã chọn. Đếm lead vào kỳ
                    → bao nhiêu đã nhập học / mất / còn mở (theo trạng thái hiện tại).
                  </Text>
                  {data?.intakeCohort.rightCensoringWarning && (
                    <div style={{ marginBottom: 12 }}>
                      <Banner
                        status="warning"
                        title="Kỳ gần đây chưa đủ thời gian chuyển đổi"
                        description="Lead vào gần đây có thể chưa kịp đi hết phễu — tỷ lệ nhập học của kỳ này thường thấp hơn kỳ cũ (right-censoring)."
                      />
                    </div>
                  )}
                  {isLoading ? (
                    <Skeleton height={80} radius={1} />
                  ) : (
                    <Grid columns={{ minWidth: 140, max: 4 }} gap={3}>
                      <StatCard label="Lead vào" value={data?.intakeCohort.totalCreated ?? 0} />
                      <StatCard label="Đã nhập học" value={data?.intakeCohort.enrolledCount ?? 0} />
                      <StatCard label="Đã mất" value={data?.intakeCohort.lostCount ?? 0} />
                      <StatCard label="Còn mở" value={data?.intakeCohort.openCount ?? 0} />
                    </Grid>
                  )}
                </div>
              </Panel>
            </div>

            {/* Block 3 — closed outcomes by closedAt */}
            <div data-testid="crm-report-closed">
              <Panel title="Kết quả đóng trong kỳ" icon="check-circle">
                <div style={{ padding: '0 22px 20px' }}>
                  <Text type="supporting" size="xsm" style={{ display: 'block', marginBottom: 12 }}>
                    Mốc thời gian: <strong>ngày đóng</strong> (nhập học hoặc đánh mất) trong khoảng
                    đã chọn. Hiệu quả kênh và KPI theo người tính trên các ca đóng này — không trộn
                    với nhóm lead vào.
                  </Text>
                  {isLoading ? (
                    <Skeleton height={160} radius={1} />
                  ) : (
                    <Stack gap={5}>
                      <HStack gap={4} wrap="wrap">
                        <Text size="sm">
                          Nhập học: <strong>{data?.closedOutcomes.enrolledCount ?? 0}</strong>
                        </Text>
                        <Text size="sm">
                          Mất: <strong>{data?.closedOutcomes.lostCount ?? 0}</strong>
                        </Text>
                      </HStack>

                      <Stack gap={2}>
                        <Text weight="medium" size="sm">
                          Lý do mất (baseline cho theo dõi rơi lead)
                        </Text>
                        <SimpleTable
                          headers={['Lý do', 'Số ca', 'Tỷ lệ / tổng mất']}
                          rows={lostReasonRows}
                          empty="Chưa có ca mất trong kỳ."
                          testId="crm-report-lost-reasons"
                        />
                      </Stack>

                      <Stack gap={2}>
                        <Text weight="medium" size="sm">
                          Hiệu quả theo kênh nguồn (theo ngày đóng)
                        </Text>
                        <SimpleTable
                          headers={['Kênh', 'Nhập học', 'Mất', 'Tổng đóng', '% nhập học']}
                          rows={sourceRows}
                          empty="Chưa có ca đóng trong kỳ."
                          testId="crm-report-by-source"
                        />
                      </Stack>

                      <Stack gap={2}>
                        <Text weight="medium" size="sm">
                          KPI theo tư vấn viên (theo ngày đóng)
                        </Text>
                        <Text type="supporting" size="xsm">
                          Tư vấn viên chỉ thấy số của chính mình; GĐKD thấy toàn đội.
                        </Text>
                        <SimpleTable
                          headers={['Tư vấn viên', 'Nhập học', 'Mất', 'Tổng đóng', '% nhập học']}
                          rows={assigneeRows}
                          empty={
                            isManager
                              ? 'Chưa có ca đóng có người phụ trách trong kỳ.'
                              : 'Bạn chưa có ca đóng trong kỳ.'
                          }
                          testId="crm-report-by-assignee"
                        />
                      </Stack>
                    </Stack>
                  )}
                </div>
              </Panel>
            </div>
          </Stack>
        }
      />
    </div>
  );
}

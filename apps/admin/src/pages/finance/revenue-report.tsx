// Doanh thu — P05 (US-025 revenue surface).
//
// Fetches approved receipts via finance.receiptList and aggregates client-side
// by classBatchId for the CSS bar chart.
//
// Design constraints:
// - CSS bar chart only — no external chart library (YAGNI).
// - Bar width proportional to group revenue vs. max group revenue.
// - DateRange filter synced to URL query param ?range= (deep-linkable).

import { Banner, DashboardPage, Grid, HStack, Panel, Skeleton, Stack, StatCard, Text, tokens } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RevenueGroup {
  classBatchId: string;
  label: string;
  count: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Aggregation — pure fn, unit-tested independent of render
// (revenue-report-aggregate.test.ts), mirroring cockpit-counter.test.ts.
// ---------------------------------------------------------------------------
export function aggregateByBatch(
  items: { classBatchId: string | null; netAmount: number; status: string }[],
): RevenueGroup[] {
  const map = new Map<string, RevenueGroup>();
  for (const r of items) {
    if (r.status !== 'approved') continue;
    const key = r.classBatchId ?? '__unknown__';
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += r.netAmount;
    } else {
      map.set(key, {
        classBatchId: key,
        label:
          key === '__unknown__'
            ? '(Không rõ lớp)'
            : `Lớp …${key.slice(-8)}`,
        count: 1,
        total: r.netAmount,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// CSS bar chart
// ---------------------------------------------------------------------------
function RevenueBarChart({
  rows,
  loading,
}: {
  rows: RevenueGroup[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Stack gap={3}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={28} radius={1} index={i} />
        ))}
      </Stack>
    );
  }

  if (rows.length === 0) {
    return (
      <Text type="supporting" size="sm">
        Chưa có phiếu thu đã duyệt nào.
      </Text>
    );
  }

  const maxTotal = rows[0]?.total ?? 0;

  return (
    <Stack gap={3}>
      {rows.map((row) => {
        const pct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
        return (
          <HStack key={row.classBatchId} gap={2} align="center" wrap="nowrap">
            {/* Label */}
            <span
              title={row.classBatchId}
              style={{
                width: 160,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              <Text size="xsm">{row.label}</Text>
            </span>

            {/* Bar track */}
            <div
              style={{
                flex: 1,
                height: 22,
                background: 'var(--cmc-surface-2)',
                borderRadius: 'var(--cmc-radius-control)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Filled portion */}
              <div
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${pct}%`,
                  background: tokens.color.brand,
                  borderRadius: 'var(--cmc-radius-control)',
                  minWidth: pct > 0 ? 4 : 0,
                  transition: 'width 0.25s ease',
                }}
              />
            </div>

            {/* Value */}
            <Text
              size="xsm"
              weight="medium"
              style={{
                width: 130,
                textAlign: 'right',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {row.total.toLocaleString('vi-VN')} đ
            </Text>

            {/* Receipt count */}
            <Text
              type="supporting"
              size="xsm"
              style={{ width: 40, textAlign: 'right', flexShrink: 0 }}
            >
              ({row.count})
            </Text>
          </HStack>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RevenueReportPage() {

  const PAGE_SIZE = 100;

  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({
    status: 'approved',
    pageSize: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const rows = aggregateByBatch(items);
  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
  // Server already filters by status: 'approved', so `items.length` is the
  // approved count for the current page.
  const totalApproved = items.length;
  const totalReceiptsAll = data?.total ?? 0;
  const isTruncated = data !== undefined && data.total > items.length;

  // Metrics-primary surface → DashboardPage (KPI strip + primary chart panel).
  // StatCard/chart keep their own loading skeletons; no full-page loading swap.
  return (
    <DashboardPage
      title="Doanh thu"
      subtitle="Tổng hợp phiếu thu đã duyệt theo lớp"
      metrics={
        <Grid columns={{ minWidth: 220, max: 3 }} gap={4}>
          <StatCard
            label="Tổng doanh thu (đã duyệt)"
            value={`${totalRevenue.toLocaleString('vi-VN')} đ`}
            loading={isLoading}
          />
          <StatCard
            label="Phiếu đã duyệt"
            value={totalApproved}
            loading={isLoading}
          />
          <StatCard
            label="Tổng phiếu đã duyệt"
            value={totalReceiptsAll}
            loading={isLoading}
          />
        </Grid>
      }
      primary={
        <Stack gap={4}>
          {error && (
            <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
          )}

          {isTruncated && (
            <Banner
              status="warning"
              title="Dữ liệu bị cắt bớt"
              description={`Chỉ hiển thị ${items.length} / ${data.total} phiếu thu. Biểu đồ chưa phản ánh toàn bộ doanh thu — phân trang server-side chưa được triển khai.`}
            />
          )}

          <Panel title="Doanh thu theo lớp học" icon="dollar">
            <div style={{ padding: '0 22px 20px' }}>
              <RevenueBarChart rows={rows} loading={isLoading} />
            </div>
          </Panel>
        </Stack>
      }
    />
  );
}

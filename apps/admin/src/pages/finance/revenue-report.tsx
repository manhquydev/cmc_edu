// Doanh thu — P05 (US-025 revenue surface).
//
// Fetches approved receipts via finance.receiptList and aggregates client-side
// by classBatchId for the CSS bar chart.
//
// Design constraints:
// - CSS bar chart only — no external chart library (YAGNI).
// - Bar width proportional to group revenue vs. max group revenue.
// - DateRange filter synced to URL query param ?range= (deep-linkable).

import { Alert, Box, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { PageHeader, StatCard, tokens } from '@cmc/ui';
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
// Aggregation
// ---------------------------------------------------------------------------
function aggregateByBatch(
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
      <Stack gap={8}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={28} radius="xs" />
        ))}
      </Stack>
    );
  }

  if (rows.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        Chưa có phiếu thu đã duyệt nào.
      </Text>
    );
  }

  const maxTotal = rows[0]?.total ?? 0;

  return (
    <Stack gap={6}>
      {rows.map((row) => {
        const pct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
        return (
          <Group key={row.classBatchId} gap="sm" align="center" wrap="nowrap">
            {/* Label */}
            <Text
              fz="xs"
              style={{
                width: 160,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={row.classBatchId}
            >
              {row.label}
            </Text>

            {/* Bar track */}
            <Box
              style={{
                flex: 1,
                height: 22,
                background: 'var(--cmc-surface-2)',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Filled portion */}
              <Box
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${pct}%`,
                  background: tokens.color.brand,
                  borderRadius: 3,
                  minWidth: pct > 0 ? 4 : 0,
                  transition: 'width 0.25s ease',
                }}
              />
            </Box>

            {/* Value */}
            <Text
              fz="xs"
              fw={500}
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
              fz="xs"
              c="dimmed"
              style={{ width: 40, textAlign: 'right', flexShrink: 0 }}
            >
              ({row.count})
            </Text>
          </Group>
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
  const totalApproved = items.filter((r) => r.status === 'approved').length;
  const totalReceiptsAll = data?.total ?? 0;
  const isTruncated = data !== undefined && data.total > items.length;

  return (
    <>
      <PageHeader
        title="Doanh thu"
        subtitle="Tổng hợp phiếu thu đã duyệt theo lớp"
        breadcrumbs={[{ label: 'Ops' }, { label: 'Doanh thu' }]}
      />

      <Stack gap="lg" p="md">
        {error && (
          <Alert color="red" title="Lỗi tải dữ liệu" radius="xs">
            {error.message}
          </Alert>
        )}

        {isTruncated && (
          <Alert color="yellow" title="Dữ liệu bị cắt bớt" radius="xs">
            Chỉ hiển thị {items.length} / {data.total} phiếu thu. Biểu đồ chưa
            phản ánh toàn bộ doanh thu — phân trang server-side chưa được triển khai.
          </Alert>
        )}

        {/* Stat cards */}
        <SimpleGrid cols={{ base: 1, xs: 3 }}>
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
        </SimpleGrid>

        {/* Bar chart section */}
        <Box>
          <Text
            fz={11}
            tt="uppercase"
            fw={600}
            c="dimmed"
            mb="sm"
            style={{ letterSpacing: '0.04em' }}
          >
            Doanh thu theo lớp học
          </Text>
          <RevenueBarChart rows={rows} loading={isLoading} />
        </Box>
      </Stack>
    </>
  );
}

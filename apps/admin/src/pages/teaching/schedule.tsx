import { useSearchParams } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { Badge, Button, Card, DataTable, FilterBar, Grid, HStack, PageHeader, Skeleton, Stack, Text } from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassBatchRow {
  id: string;
  code: string;
  program: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  teacherId: string | null;
  [key: string]: unknown;
}

type View = 'list' | 'calendar' | 'kanban';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWS: View[] = ['list', 'calendar', 'kanban'];

const VIEW_LABELS: Record<View, string> = {
  list: 'Danh sách',
  calendar: 'Lịch',
  kanban: 'Kanban',
};

const FILTERS: FilterDef[] = [
  { key: 'courseId', label: 'ID khóa học', type: 'text', placeholder: 'Lọc theo khóa học' },
];

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  active: 'success',
  completed: 'blue',
  cancelled: 'error',
  planned: 'neutral',
};

const LIST_COLUMNS: TableColumn<ClassBatchRow>[] = [
  { key: 'code', label: 'Mã lớp', width: 130 },
  { key: 'program', label: 'Chương trình', width: 160 },
  {
    key: 'startDate',
    label: 'Bắt đầu',
    width: 110,
    render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
  },
  {
    key: 'endDate',
    label: 'Kết thúc',
    width: 110,
    render: (v) => new Date(v as string).toLocaleDateString('vi-VN'),
  },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 120,
    render: (v) => <Badge label={String(v)} variant={STATUS_VARIANTS[v as string] ?? 'neutral'} />,
  },
];

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function CalendarView({ rows, loading }: { rows: ClassBatchRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Grid columns={7} gap={1}>
          {Array.from({ length: 28 }, (_, i) => (
            <Skeleton key={i} height={40} radius={1} />
          ))}
        </Grid>
      </div>
    );
  }

  // Group batches by month of startDate
  const byMonth = new Map<string, ClassBatchRow[]>();
  for (const row of rows) {
    const key = new Date(row.startDate as string).toLocaleDateString('vi-VN', {
      month: 'long',
      year: 'numeric',
    });
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }

  if (byMonth.size === 0) {
    return (
      <div style={{ padding: 32 }}>
        <Text type="supporting" size="sm" justify="center" display="block">
          Chưa có lớp học nào
        </Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {Array.from(byMonth.entries()).map(([month, items]) => (
        <div key={month} style={{ marginBottom: 20 }}>
          <Text
            type="supporting"
            size="sm"
            weight="semibold"
            style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            {month}
          </Text>
          <Grid columns={{ minWidth: 220, max: 3 }} gap={1}>
            {items.map((item) => (
              <Card key={item.id} padding={2} style={{ borderColor: 'var(--cmc-border)' }}>
                <HStack justify="between" style={{ marginBottom: 4 }}>
                  <Text size="sm" weight="semibold">
                    {item.code}
                  </Text>
                  <Badge label={item.status} variant={STATUS_VARIANTS[item.status] ?? 'neutral'} />
                </HStack>
                <Text type="supporting" size="xsm">
                  {item.program}
                </Text>
                <Text type="supporting" size="xsm" style={{ marginTop: 2 }}>
                  {new Date(item.startDate as string).toLocaleDateString('vi-VN')} —{' '}
                  {new Date(item.endDate as string).toLocaleDateString('vi-VN')}
                </Text>
              </Card>
            ))}
          </Grid>
        </div>
      ))}
    </div>
  );
}

function KanbanView({ rows, loading }: { rows: ClassBatchRow[]; loading: boolean }) {
  const KANBAN_COLS: { key: string; label: string }[] = [
    { key: 'planned', label: 'Đã lên lịch' },
    { key: 'active', label: 'Đang dạy' },
    { key: 'completed', label: 'Đã kết thúc' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  if (loading) {
    return (
      <HStack gap={4} align="start" style={{ padding: 16 }}>
        {KANBAN_COLS.map((col) => (
          <div key={col.key} style={{ minWidth: 220 }}>
            <Skeleton height={24} radius={1} style={{ marginBottom: 8 }} />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={64} radius={1} style={{ marginBottom: 4 }} />
            ))}
          </div>
        ))}
      </HStack>
    );
  }

  const byStatus = new Map<string, ClassBatchRow[]>();
  for (const row of rows) {
    const list = byStatus.get(row.status) ?? [];
    list.push(row);
    byStatus.set(row.status, list);
  }

  return (
    <div style={{ padding: 16, overflowX: 'auto' }}>
      <HStack gap={4} align="start" wrap="nowrap">
        {KANBAN_COLS.map((col) => {
          const items = byStatus.get(col.key) ?? [];
          return (
            <div key={col.key} style={{ minWidth: 220, flexShrink: 0 }}>
              <HStack gap={1} style={{ marginBottom: 8 }}>
                <Text type="supporting" size="xsm" weight="bold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {col.label}
                </Text>
                <Badge label={String(items.length)} variant={STATUS_VARIANTS[col.key] ?? 'neutral'} />
              </HStack>
              <Stack gap={1}>
                {items.length === 0 ? (
                  <Text type="supporting" size="xsm" justify="center" display="block" style={{ paddingBlock: 16 }}>
                    Không có lớp
                  </Text>
                ) : (
                  items.map((item) => (
                    <Card key={item.id} padding={2} style={{ borderColor: 'var(--cmc-border)' }}>
                      <Text size="sm" weight="semibold">
                        {item.code}
                      </Text>
                      <Text type="supporting" size="xsm">
                        {item.program}
                      </Text>
                      <Text type="supporting" size="xsm" style={{ marginTop: 2 }}>
                        {new Date(item.startDate as string).toLocaleDateString('vi-VN')}
                      </Text>
                    </Card>
                  ))
                )}
              </Stack>
            </div>
          );
        })}
      </HStack>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as View | null) ?? 'list';
  const courseIdFilter = searchParams.get('courseId') ?? undefined;

  const { data, isLoading, error } = trpc.classBatch.list.useQuery({
    page: 1,
    pageSize: 50,
    ...(courseIdFilter ? { courseId: courseIdFilter } : {}),
  });

  const rows = (data?.items ?? []) as ClassBatchRow[];

  function setView(v: View) {
    const params = new URLSearchParams(searchParams);
    params.set('view', v);
    setSearchParams(params, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Lịch dạy"
        subtitle="Quản lý lịch giảng dạy"
        breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Lịch dạy' }]}
        actions={
          <HStack gap={1}>
            {VIEWS.map((v) => (
              <Button
                key={v}
                label={VIEW_LABELS[v]}
                size="sm"
                variant={view === v ? 'primary' : 'secondary'}
                onClick={() => setView(v)}
              />
            ))}
          </HStack>
        }
      />
      <FilterBar filters={FILTERS} />
      {view === 'list' && (
        <DataTable<ClassBatchRow>
          columns={LIST_COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có lớp học nào"
        />
      )}
      {view === 'calendar' && <CalendarView rows={rows} loading={isLoading} />}
      {view === 'kanban' && <KanbanView rows={rows} loading={isLoading} />}
    </>
  );
}

import { useSearchParams } from 'react-router-dom';
import { FilterBar, PageHeader, DataTable } from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';

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

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  completed: 'blue',
  cancelled: 'red',
  planned: 'gray',
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
    render: (v) => (
      <Badge color={STATUS_COLORS[v as string] ?? 'gray'} size="sm" radius="xs">
        {String(v)}
      </Badge>
    ),
  },
];

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function CalendarView({ rows, loading }: { rows: ClassBatchRow[]; loading: boolean }) {
  if (loading) {
    return (
      <Box p="md">
        <SimpleGrid cols={7} spacing="xs">
          {Array.from({ length: 28 }, (_, i) => (
            <Skeleton key={i} height={40} radius="xs" />
          ))}
        </SimpleGrid>
      </Box>
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
      <Box p="xl">
        <Text c="dimmed" ta="center">
          Chưa có lớp học nào
        </Text>
      </Box>
    );
  }

  return (
    <Box p="md">
      {Array.from(byMonth.entries()).map(([month, items]) => (
        <Box key={month} mb="lg">
          <Text fz="sm" fw={600} mb="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            {month}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
            {items.map((item) => (
              <Card
                key={item.id}
                padding="sm"
                radius="xs"
                withBorder
                style={{ borderColor: 'var(--cmc-border)' }}
              >
                <Group justify="space-between" mb={4}>
                  <Text fz="sm" fw={600}>
                    {item.code}
                  </Text>
                  <Badge color={STATUS_COLORS[item.status] ?? 'gray'} size="xs" radius="xs">
                    {item.status}
                  </Badge>
                </Group>
                <Text fz="xs" c="dimmed">
                  {item.program}
                </Text>
                <Text fz="xs" c="dimmed" mt={2}>
                  {new Date(item.startDate as string).toLocaleDateString('vi-VN')} —{' '}
                  {new Date(item.endDate as string).toLocaleDateString('vi-VN')}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
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
      <Group gap="md" p="md" align="flex-start">
        {KANBAN_COLS.map((col) => (
          <Box key={col.key} style={{ minWidth: 220 }}>
            <Skeleton height={24} mb="sm" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={64} mb="xs" radius="xs" />
            ))}
          </Box>
        ))}
      </Group>
    );
  }

  const byStatus = new Map<string, ClassBatchRow[]>();
  for (const row of rows) {
    const list = byStatus.get(row.status) ?? [];
    list.push(row);
    byStatus.set(row.status, list);
  }

  return (
    <Box p="md" style={{ overflowX: 'auto' }}>
      <Group gap="md" align="flex-start" style={{ flexWrap: 'nowrap' }}>
        {KANBAN_COLS.map((col) => {
          const items = byStatus.get(col.key) ?? [];
          return (
            <Box key={col.key} style={{ minWidth: 220, flexShrink: 0 }}>
              <Group mb="sm" gap="xs">
                <Text fz="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
                  {col.label}
                </Text>
                <Badge color={STATUS_COLORS[col.key] ?? 'gray'} size="xs" radius="xs">
                  {items.length}
                </Badge>
              </Group>
              <Stack gap="xs">
                {items.length === 0 ? (
                  <Text fz="xs" c="dimmed" ta="center" py="md">
                    Không có lớp
                  </Text>
                ) : (
                  items.map((item) => (
                    <Card
                      key={item.id}
                      padding="sm"
                      radius="xs"
                      withBorder
                      style={{ borderColor: 'var(--cmc-border)' }}
                    >
                      <Text fz="sm" fw={600}>
                        {item.code}
                      </Text>
                      <Text fz="xs" c="dimmed">
                        {item.program}
                      </Text>
                      <Text fz="xs" c="dimmed" mt={2}>
                        {new Date(item.startDate as string).toLocaleDateString('vi-VN')}
                      </Text>
                    </Card>
                  ))
                )}
              </Stack>
            </Box>
          );
        })}
      </Group>
    </Box>
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
          <Group gap="xs">
            {VIEWS.map((v) => (
              <Button
                key={v}
                size="xs"
                radius="xs"
                variant={view === v ? 'filled' : 'default'}
                onClick={() => setView(v)}
              >
                {VIEW_LABELS[v]}
              </Button>
            ))}
          </Group>
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

import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Banner,
  Callout,
  DataTable,
  FilterBar,
  KanbanBoard,
  KanbanColumn,
  LineIcon,
  ListPage,
  PageHeader,
  SessionCard,
  StatusBadge,
  WeekSchedule,
  batchStatusToSession,
  type FilterDef,
  type IconName,
  type SessionCardProps,
  type TableColumn,
} from '@cmc/ui';
import { SoftOpsFullCalendar, type SoftOpsFcView } from '../../components/soft-ops-fullcalendar.js';
import { trpc } from '../../lib/trpc.js';
import { classSessionToEvents, toDateOnly } from './schedule-fc-events.js';

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

type View = 'list' | 'calendar' | 'kanban' | 'week';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWS: View[] = ['list', 'week', 'calendar', 'kanban'];

const VIEW_LABELS: Record<View, string> = {
  list: 'Danh sách',
  week: 'Tuần',
  calendar: 'Theo tháng',
  kanban: 'Kanban',
};

/** Compact icon toggle — label stays on aria-label + title (tooltip). */
const VIEW_ICONS: Record<View, IconName> = {
  list: 'list',
  week: 'calendar',
  calendar: 'calendar-days',
  kanban: 'kanban',
};

/**
 * Soft Ops page toggle → FC initial view.
 * Inside FC, user can further switch month/week/time/list via FC toolbar (y hệt FC).
 */
const VIEW_TO_FC: Record<'week' | 'calendar', SoftOpsFcView> = {
  week: 'timeGridWeek',
  calendar: 'dayGridMonth',
};

const FILTERS: FilterDef[] = [
  { key: 'courseId', label: 'ID khóa học', type: 'text', placeholder: 'Lọc theo khóa học' },
];

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
    render: (v) => <StatusBadge status={String(v)} label={String(v)} />,
  },
];

const KANBAN_COLS: { key: string; label: string }[] = [
  { key: 'planned', label: 'Sắp mở' },
  { key: 'active', label: 'Trong kỳ' },
  { key: 'completed', label: 'Kết thúc' },
  { key: 'cancelled', label: 'Huỷ' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtRange(start: Date | string, end: Date | string): string {
  const a = new Date(start).toLocaleDateString('vi-VN');
  const b = new Date(end).toLocaleDateString('vi-VN');
  return `${a} – ${b}`;
}

function toSessionCard(
  row: ClassBatchRow,
  density: 'default' | 'compact' = 'default',
): SessionCardProps {
  const fullRange = fmtRange(row.startDate, row.endDate);
  const teacher = row.teacherId ? `GV · ${row.teacherId.slice(0, 8)}` : 'Chưa gán GV';
  return {
    title: row.code,
    subtitle: row.program,
    meta: teacher,
    status: batchStatusToSession(row.status),
    href: `/teaching/attendance?classBatch=${row.id}`,
    actionLabel: 'Điểm danh',
    density,
    footPriority: 'identity',
    detail: `${fullRange} · ${teacher}`,
    timeLabel: fullRange,
  };
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

/** Default ICT-ish local window before FC fires datesSet (~prev month → +2 months). */
function defaultSessionRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return { from: toDateOnly(from), to: toDateOnly(to) };
}

/**
 * FullCalendar body fed by ClassSession.listInRange (timed events).
 * Range follows FC datesSet; string-compare avoids refetch thrash.
 * placeholderData keeps prior events during range change so FC is not unmounted.
 */
function FullCalendarSessionView({
  courseId,
  fcView,
  viewKey,
}: {
  courseId?: string;
  fcView: SoftOpsFcView;
  viewKey: string;
}) {
  const navigate = useNavigate();
  const [range, setRange] = useState(defaultSessionRange);

  const { data, isLoading, isFetching, isPlaceholderData, error } =
    trpc.classSession.listInRange.useQuery(
      {
        from: range.from,
        to: range.to,
        ...(courseId ? { courseId } : {}),
      },
      {
        // RQ v5: keep previous window while the new range loads (no empty flash / no unmount).
        placeholderData: (prev) => prev,
      },
    );

  const events = useMemo(() => classSessionToEvents(data ?? []), [data]);
  // First paint with no data: blocking skeleton. Range change: soft fetching overlay.
  const blockingLoad = isLoading && events.length === 0;
  const softFetching = (isFetching || isPlaceholderData) && events.length > 0;

  const onDatesSet = useCallback((info: { start: Date; end: Date }) => {
    // FC end is exclusive; last visible day = end - 1ms.
    const nextFrom = toDateOnly(info.start);
    const nextTo = toDateOnly(new Date(info.end.getTime() - 1));
    if (!nextFrom || !nextTo) return;
    setRange((prev) => {
      if (prev.from === nextFrom && prev.to === nextTo) return prev;
      return { from: nextFrom, to: nextTo };
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error?.message ? (
        <Banner status="error" title="Không tải được buổi học" description={error.message} />
      ) : null}
      <SoftOpsFullCalendar
        events={events}
        initialView={fcView}
        viewKey={viewKey}
        loading={blockingLoad}
        fetching={softFetching}
        height="auto"
        aspectRatio={1.55}
        showFcViewButtons
        onDatesSet={onDatesSet}
        onEventNavigate={(href) => {
          void navigate(href);
        }}
      />
      <Callout tone="info" title="Ghi chú lịch dạy">
        Sự kiện = <strong>buổi học có giờ</strong> (ClassSession start/end), không phải kỳ lớp
        all-day. Bấm sự kiện → <strong>chi tiết buổi</strong> (điểm danh / nhận xét / nhật ký).
        Toolbar FC: tháng / tuần giờ / ngày / danh sách. Không kéo thả (editable=false). Lịch trống
        nếu chưa generate buổi trong cửa sổ đang xem.
      </Callout>
    </div>
  );
}

function KanbanView({ rows, loading }: { rows: ClassBatchRow[]; loading: boolean }) {
  if (loading) {
    return <WeekSchedule days={[]} loading />;
  }

  const byStatus = new Map<string, ClassBatchRow[]>();
  for (const row of rows) {
    const list = byStatus.get(row.status) ?? [];
    list.push(row);
    byStatus.set(row.status, list);
  }

  return (
    <KanbanBoard>
      {KANBAN_COLS.map((col) => {
        const items = byStatus.get(col.key) ?? [];
        return (
          <KanbanColumn key={col.key} title={col.label} count={items.length}>
            {items.length === 0 ? (
              <div className="console-kanban-empty">Không có lớp</div>
            ) : (
              items.map((item) => <SessionCard key={item.id} {...toSessionCard(item, 'default')} />)
            )}
          </KanbanColumn>
        );
      })}
    </KanbanBoard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view') as View | null;
  // Default week — education ops land on calendar board, not raw batch list.
  const view: View = rawView && VIEWS.includes(rawView) ? rawView : 'week';
  const courseIdFilter = searchParams.get('courseId') ?? undefined;
  const needsBatchList = view === 'list' || view === 'kanban';

  // Batch list only for Soft Ops list/kanban — calendar uses listInRange (sessions).
  const { data, isLoading, error } = trpc.classBatch.list.useQuery(
    {
      page: 1,
      pageSize: 50,
      ...(courseIdFilter ? { courseId: courseIdFilter } : {}),
    },
    { enabled: needsBatchList },
  );

  const rows = (data?.items ?? []) as ClassBatchRow[];

  function setView(v: View) {
    const params = new URLSearchParams(searchParams);
    params.set('view', v);
    setSearchParams(params, { replace: true });
  }

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Lịch dạy"
          breadcrumbs={[{ label: 'Giảng dạy', href: '/teaching' }, { label: 'Lịch dạy' }]}
          actions={
            <div className="console-view-switcher" role="toolbar" aria-label="Chế độ xem lịch">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={view === v ? 'is-active' : ''}
                  aria-label={VIEW_LABELS[v]}
                  aria-pressed={view === v}
                  title={VIEW_LABELS[v]}
                  data-view={v}
                  onClick={() => setView(v)}
                >
                  <LineIcon name={VIEW_ICONS[v]} size={17} strokeWidth={1.85} />
                </button>
              ))}
            </div>
          }
        />
      }
      filters={<FilterBar filters={FILTERS} />}
    >
      {needsBatchList && error?.message ? (
        <Banner status="error" title="Không tải được lịch dạy" description={error.message} />
      ) : null}
      {view === 'list' && !error?.message && (
        <DataTable<ClassBatchRow>
          columns={LIST_COLUMNS}
          data={rows}
          loading={isLoading}
          empty="Chưa có lớp học nào"
        />
      )}
      {view === 'week' && (
        <FullCalendarSessionView
          courseId={courseIdFilter}
          fcView={VIEW_TO_FC.week}
          viewKey="week"
        />
      )}
      {view === 'calendar' && (
        <FullCalendarSessionView
          courseId={courseIdFilter}
          fcView={VIEW_TO_FC.calendar}
          viewKey="calendar"
        />
      )}
      {view === 'kanban' && !error?.message && (
        <KanbanView rows={rows} loading={isLoading} />
      )}
    </ListPage>
  );
}

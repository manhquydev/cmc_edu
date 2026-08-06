// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Soft Ops FullCalendar is mocked — jsdom + FC layout is heavy; we lock the
// mount contract (data-testid), listInRange / classBatch.list, datesSet, events.
import { createElement, useEffect } from 'react';

type MockFcProps = {
  loading?: boolean;
  fetching?: boolean;
  events?: Array<{
    allDay?: boolean;
    start?: string;
    end?: string;
    extendedProps?: { href?: string };
  }>;
  initialView?: string;
  onDatesSet?: (info: { start: Date; end: Date }) => void;
};

let lastFcProps: MockFcProps | null = null;

vi.mock('../../components/soft-ops-fullcalendar.js', () => ({
  SoftOpsFullCalendar: (props: MockFcProps) => {
    lastFcProps = props;
    // Fire datesSet once after mount so schedule range wiring is exercised.
    useEffect(() => {
      queueMicrotask(() => {
        props.onDatesSet?.({
          start: new Date(2026, 7, 3), // Mon Aug 3 2026 local
          end: new Date(2026, 7, 10), // exclusive Sun Aug 10 → inclusive to = Aug 9
        });
      });
    }, [props.onDatesSet]);
    return createElement(
      'div',
      {
        'data-testid': 'soft-ops-fullcalendar',
        'data-fc-view': props.initialView,
        'data-event-count': Array.isArray(props.events) ? props.events.length : 0,
        'data-loading': props.loading ? '1' : '0',
        'data-fetching': props.fetching ? '1' : '0',
      },
      'SoftOpsFullCalendar mock',
    );
  },
}));

interface ClassBatchRow {
  id: string;
  code: string;
  program: string;
  startDate: string;
  endDate: string;
  status: string;
  teacherId: string | null;
}

interface SessionInRangeRow {
  id: string;
  classBatchId: string;
  startTime: string;
  endTime: string;
  status: string;
  isMakeup: boolean;
  batchCode: string;
  program: string;
  teacherId: string | null;
  courseId: string;
  batchStatus: string;
}

const BATCH_A: ClassBatchRow = {
  id: 'batch-1',
  code: 'ENG-A1',
  program: 'English',
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  status: 'active',
  teacherId: 't1',
};

const SESSION_A: SessionInRangeRow = {
  id: 'sess-1',
  classBatchId: 'batch-1',
  startTime: '2026-08-03T11:00:00.000Z',
  endTime: '2026-08-03T12:30:00.000Z',
  status: 'planned',
  isMakeup: false,
  batchCode: 'ENG-A1',
  program: 'English',
  teacherId: 't1',
  courseId: 'c1',
  batchStatus: 'active',
};

const batchState: { items: ClassBatchRow[]; error: { message: string } | null } = {
  items: [BATCH_A],
  error: null,
};
const sessionState: {
  items: SessionInRangeRow[];
  error: { message: string } | null;
  isLoading: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
} = {
  items: [SESSION_A],
  error: null,
  isLoading: false,
  isFetching: false,
  isPlaceholderData: false,
};
const listQuerySpy = vi.fn();
const listInRangeSpy = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_dao_tao'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'classBatch.list.useQuery': (input: unknown, opts?: { enabled?: boolean }) => {
        listQuerySpy(input, opts);
        return queryResult(
          { items: batchState.items },
          { error: batchState.error, isError: batchState.error !== null },
        );
      },
      'classSession.listInRange.useQuery': (input: unknown, opts?: unknown) => {
        listInRangeSpy(input, opts);
        return queryResult(sessionState.items, {
          error: sessionState.error,
          isError: sessionState.error !== null,
          isFetching: sessionState.isFetching,
          isPlaceholderData: sessionState.isPlaceholderData,
          isLoading: sessionState.isLoading,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import SchedulePage from './schedule.js';

describe('SchedulePage', () => {
  beforeEach(() => {
    batchState.items = [BATCH_A];
    batchState.error = null;
    sessionState.items = [SESSION_A];
    sessionState.error = null;
    sessionState.isLoading = false;
    sessionState.isFetching = false;
    sessionState.isPlaceholderData = false;
    listQuerySpy.mockClear();
    listInRangeSpy.mockClear();
    lastFcProps = null;
  });

  it('does not enable classBatch.list on default week calendar view', () => {
    renderWithProviders(<SchedulePage />);
    expect(listQuerySpy).toHaveBeenCalledWith(
      { page: 1, pageSize: 50 },
      expect.objectContaining({ enabled: false }),
    );
  });

  it('enables classBatch.list on list view and passes courseId filter', () => {
    renderWithProviders(<SchedulePage />, {
      route: '/teaching/schedule?view=list&courseId=c1',
    });
    expect(listQuerySpy).toHaveBeenCalledWith(
      { page: 1, pageSize: 50, courseId: 'c1' },
      expect.objectContaining({ enabled: true }),
    );
  });

  it('defaults to week FullCalendar and maps timed ClassSession events with dual deep-link', async () => {
    renderWithProviders(<SchedulePage />);
    const weekBtn = screen.getByRole('button', { name: 'Tuần' });
    expect(weekBtn.getAttribute('aria-pressed')).toBe('true');
    const fc = screen.getByTestId('soft-ops-fullcalendar');
    expect(fc.getAttribute('data-fc-view')).toBe('timeGridWeek');
    expect(fc.getAttribute('data-event-count')).toBe('1');
    expect(listInRangeSpy).toHaveBeenCalled();

    // Adapter-shaped events (not raw listInRange rows)
    expect(lastFcProps?.events?.[0]?.allDay).toBe(false);
    expect(lastFcProps?.events?.[0]?.start).toBe('2026-08-03T11:00:00.000Z');
    expect(lastFcProps?.events?.[0]?.extendedProps?.href).toBe(
      '/teaching/sessions/sess-1?tab=attendance',
    );
  });

  it('datesSet maps exclusive FC end to inclusive to and stabilizes thrash', async () => {
    renderWithProviders(<SchedulePage />);
    await vi.waitFor(() => {
      const calls = listInRangeSpy.mock.calls.map((c) => c[0] as { from: string; to: string });
      expect(calls.some((c) => c.from === '2026-08-03' && c.to === '2026-08-09')).toBe(true);
    });

    // Fire same range again under act — thrash guard keeps query input stable.
    await act(async () => {
      lastFcProps?.onDatesSet?.({
        start: new Date(2026, 7, 3),
        end: new Date(2026, 7, 10),
      });
    });
    const last = listInRangeSpy.mock.calls.at(-1)![0] as { from: string; to: string };
    expect(last).toEqual({ from: '2026-08-03', to: '2026-08-09' });
  });

  it('passes courseId to listInRange on week view', () => {
    renderWithProviders(<SchedulePage />, { route: '/teaching/schedule?view=week&courseId=c1' });
    expect(listInRangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'c1' }),
      expect.anything(),
    );
  });

  it('calendar view mounts FullCalendar dayGridMonth without batch list enabled', () => {
    renderWithProviders(<SchedulePage />, { route: '/teaching/schedule?view=calendar' });
    const fc = screen.getByTestId('soft-ops-fullcalendar');
    expect(fc.getAttribute('data-fc-view')).toBe('dayGridMonth');
    expect(listInRangeSpy).toHaveBeenCalled();
    expect(listQuerySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
  });

  it('list view still binds classBatch.list rows', () => {
    renderWithProviders(<SchedulePage />, { route: '/teaching/schedule?view=list' });
    expect(screen.getByText('ENG-A1')).toBeInTheDocument();
  });

  // Kanban groups batches by their real backend status — one column per
  // KANBAN_COLS entry, always rendered so an empty stage stays visible.
  it('kanban view renders one odoo kanban column per status with its count', () => {
    batchState.items = [
      BATCH_A,
      { ...BATCH_A, id: 'batch-2', code: 'ENG-A2' },
      { ...BATCH_A, id: 'batch-3', code: 'ENG-B1', status: 'planned' },
    ];
    const { container } = renderWithProviders(<SchedulePage />, {
      route: '/teaching/schedule?view=kanban',
    });
    const cols = container.querySelectorAll('.o-kanban-col');
    expect(cols).toHaveLength(4);
    const counts = [...cols].map((c) => c.querySelector('.o-kanban-col-count')?.textContent);
    // planned 1, active 2, completed 0, cancelled 0 — KANBAN_COLS order.
    expect(counts).toEqual(['1', '2', '0', '0']);
  });

  it('kanban view keeps a batch card per row and drops the premium ck-kanban shell', () => {
    renderWithProviders(<SchedulePage />, { route: '/teaching/schedule?view=kanban' });
    expect(screen.getByText('ENG-A1')).toBeInTheDocument();
    expect(document.querySelector('.ck-kanban')).toBeNull();
  });

  it('renders the FilterBar course filter input', () => {
    renderWithProviders(<SchedulePage />);
    expect(screen.getByPlaceholderText('Lọc theo khóa học')).toBeInTheDocument();
  });

  it('batch list error does not hide week calendar', () => {
    batchState.error = { message: 'Lỗi mạng batch' };
    renderWithProviders(<SchedulePage />);
    // Week is default — calendar still mounts; batch error banner not shown on week
    expect(screen.getByTestId('soft-ops-fullcalendar')).toBeInTheDocument();
    expect(screen.queryByText('Lỗi mạng batch')).not.toBeInTheDocument();
  });

  it('shows batch error on list view when classBatch.list fails', () => {
    batchState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<SchedulePage />, { route: '/teaching/schedule?view=list' });
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });

  it('shows session load error banner without unmounting week view shell', () => {
    sessionState.error = { message: 'Lỗi buổi học' };
    renderWithProviders(<SchedulePage />);
    expect(screen.getByText('Lỗi buổi học')).toBeInTheDocument();
    expect(screen.getByTestId('soft-ops-fullcalendar')).toBeInTheDocument();
  });

  it('wires listInRange with placeholderData (C1: keep prior window on range change)', () => {
    renderWithProviders(<SchedulePage />);
    expect(listInRangeSpy).toHaveBeenCalled();
    const opts = listInRangeSpy.mock.calls[0]![1] as {
      placeholderData?: (prev: unknown) => unknown;
    };
    expect(typeof opts?.placeholderData).toBe('function');
    const prev = [{ id: 'kept' }];
    expect(opts.placeholderData!(prev)).toBe(prev);
  });

  it('soft-fetching with events keeps FC mounted (loading=0, fetching=1)', () => {
    sessionState.isFetching = true;
    sessionState.isPlaceholderData = true;
    sessionState.isLoading = false;
    renderWithProviders(<SchedulePage />);
    const fc = screen.getByTestId('soft-ops-fullcalendar');
    expect(fc.getAttribute('data-loading')).toBe('0');
    expect(fc.getAttribute('data-fetching')).toBe('1');
    expect(fc.getAttribute('data-event-count')).toBe('1');
  });

  it('blocking load only when no events yet', () => {
    sessionState.items = [];
    sessionState.isLoading = true;
    renderWithProviders(<SchedulePage />);
    expect(lastFcProps?.loading).toBe(true);
    expect(lastFcProps?.fetching).toBe(false);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the `classBatch.list.useQuery` binding (+ FilterBar courseId URL
// param) BEFORE the ListPage refactor (TDD per phase-07). The refactor only
// changes presentation (wrap in `ListPage`) — the query contract and the
// three-view (list/calendar/kanban) switch must stay unchanged.
interface ClassBatchRow {
  id: string;
  code: string;
  program: string;
  startDate: string;
  endDate: string;
  status: string;
  teacherId: string | null;
}

const BATCH_A: ClassBatchRow = {
  id: 'batch-1',
  code: 'ENG-A1',
  program: 'English',
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: '2026-06-30T00:00:00.000Z',
  status: 'active',
  teacherId: 't1',
};

const batchState: { items: ClassBatchRow[]; error: { message: string } | null } = {
  items: [BATCH_A],
  error: null,
};
const listQuerySpy = vi.fn();

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
      'classBatch.list.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(
          { items: batchState.items },
          { error: batchState.error, isError: batchState.error !== null },
        );
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
    listQuerySpy.mockClear();
  });

  it('queries classBatch.list with page/pageSize and no courseId by default', () => {
    renderWithProviders(<SchedulePage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
  });

  it('passes the courseId filter from the URL to classBatch.list.useQuery', () => {
    renderWithProviders(<SchedulePage />, { route: '/teaching/schedule?courseId=c1' });
    expect(listQuerySpy).toHaveBeenCalledWith({ page: 1, pageSize: 50, courseId: 'c1' });
  });

  it('renders class rows bound to classBatch.list.useQuery', () => {
    renderWithProviders(<SchedulePage />);
    expect(screen.getByText('ENG-A1')).toBeInTheDocument();
  });

  it('renders the FilterBar course filter input', () => {
    renderWithProviders(<SchedulePage />);
    expect(screen.getByPlaceholderText('Lọc theo khóa học')).toBeInTheDocument();
  });

  it('renders an error message when classBatch.list fails', () => {
    batchState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<SchedulePage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});

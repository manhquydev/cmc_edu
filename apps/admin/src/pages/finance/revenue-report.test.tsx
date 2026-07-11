// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the revenue dashboard's `finance.receiptList` binding + aggregation
// output BEFORE the premium reshape (phase-04, StatCard/Panel). The pure
// aggregation logic itself is covered by revenue-report-aggregate.test.ts —
// this file only locks the tRPC query input + rendered totals.
interface ReceiptRow {
  classBatchId: string | null;
  netAmount: number;
  status: string;
}

const ROWS: ReceiptRow[] = [
  { classBatchId: 'b1', netAmount: 3_000_000, status: 'approved' },
  { classBatchId: 'b2', netAmount: 1_000_000, status: 'approved' },
];

const revenueState: {
  data: { items: ReceiptRow[]; total: number } | undefined;
  isLoading: boolean;
  error: { message: string } | null;
} = {
  data: { items: ROWS, total: 2 },
  isLoading: false,
  error: null,
};
const listQuerySpy = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_kinh_doanh'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'finance.receiptList.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(revenueState.data, {
          isLoading: revenueState.isLoading,
          error: revenueState.error,
          isError: revenueState.error !== null,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import RevenueReportPage from './revenue-report.js';

describe('RevenueReportPage', () => {
  beforeEach(() => {
    revenueState.data = { items: ROWS, total: 2 };
    revenueState.isLoading = false;
    revenueState.error = null;
    listQuerySpy.mockClear();
  });

  it('queries finance.receiptList with the unchanged {status: "approved", pageSize: 100} input', () => {
    renderWithProviders(<RevenueReportPage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ status: 'approved', pageSize: 100 });
  });

  it('renders the total revenue stat card computed from aggregateByBatch', () => {
    renderWithProviders(<RevenueReportPage />);
    expect(screen.getByText('4.000.000 đ')).toBeInTheDocument();
  });

  it('renders the approved-count stat cards', () => {
    renderWithProviders(<RevenueReportPage />);
    expect(screen.getAllByText('2')).not.toHaveLength(0);
  });

  it('renders a bar chart row per class batch group', () => {
    const { container } = renderWithProviders(<RevenueReportPage />);
    expect(container.textContent).toContain('3.000.000 đ');
    expect(container.textContent).toContain('1.000.000 đ');
  });

  it('renders a truncation warning when items are fewer than total', () => {
    revenueState.data = { items: ROWS, total: 50 };
    renderWithProviders(<RevenueReportPage />);
    expect(screen.getByText('Dữ liệu bị cắt bớt')).toBeInTheDocument();
  });

  it('renders an error message when finance.receiptList fails', () => {
    revenueState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<RevenueReportPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });

  it('renders empty state text when there are no approved receipts', () => {
    revenueState.data = { items: [], total: 0 };
    renderWithProviders(<RevenueReportPage />);
    expect(screen.getByText('Chưa có phiếu thu đã duyệt nào.')).toBeInTheDocument();
  });
});

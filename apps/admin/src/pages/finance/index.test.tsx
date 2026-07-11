// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the finance index (`FinancePage`) list binding BEFORE the ListPage
// refactor (TDD per phase-04). This screen mirrors `receipt-list.tsx` but has
// no filters/actions — the refactor only changes presentation (wrap in
// `ListPage`), never the `finance.receiptList.useQuery({})` contract.
interface ReceiptRow {
  id: string;
  code: string;
  studentName: string;
  netAmount: number;
  status: string;
  createdAt: string;
}

const ROW_A: ReceiptRow = {
  id: 'r1',
  code: 'PT-0001',
  studentName: 'Nguyễn Văn A',
  netAmount: 5_000_000,
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
};

const receiptListState: { data: { items: ReceiptRow[] }; error: { message: string } | null } = {
  data: { items: [ROW_A] },
  error: null,
};
const listQuerySpy = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'finance.receiptList.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(receiptListState.data, {
          error: receiptListState.error,
          isError: receiptListState.error !== null,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import FinancePage from './index.js';

describe('FinancePage', () => {
  beforeEach(() => {
    receiptListState.data = { items: [ROW_A] };
    receiptListState.error = null;
    listQuerySpy.mockClear();
  });

  it('queries finance.receiptList with the unchanged {} input', () => {
    renderWithProviders(<FinancePage />);
    expect(listQuerySpy).toHaveBeenCalledWith({});
  });

  it('renders receipt rows bound to finance.receiptList.useQuery', () => {
    renderWithProviders(<FinancePage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('PT-0001')).toBeInTheDocument();
  });

  it('renders empty state when finance.receiptList returns no rows', () => {
    receiptListState.data = { items: [] };
    renderWithProviders(<FinancePage />);
    expect(screen.getByText('Chưa có phiếu thu nào')).toBeInTheDocument();
  });

  it('renders error message when finance.receiptList fails', () => {
    receiptListState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<FinancePage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});

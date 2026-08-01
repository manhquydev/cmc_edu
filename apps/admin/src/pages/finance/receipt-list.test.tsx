// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the FilterBar wiring fix (finding #3, audit-260726-2040): the page
// used to pass `onChange` to `FilterBar` without `value`, which made
// `FilterBar` call that callback instead of writing the URL while this page
// kept reading `status`/`q` from the URL — so the status Selector and the
// search TextInput were both dead (typing snapped back, selecting a status
// changed nothing). `FilterBar` is now left fully uncontrolled here.
const ROWS = [
  {
    id: 'r1',
    code: 'SO0001',
    studentName: 'Nguyễn Văn A',
    netAmount: 5_000_000,
    status: 'draft',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'r2',
    code: 'SO0002',
    studentName: 'Trần Thị B',
    netAmount: 3_000_000,
    status: 'approved',
    createdAt: '2026-07-02T00:00:00.000Z',
  },
];

const receiptListSpy = vi.fn();

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
        receiptListSpy(input);
        return queryResult({ items: ROWS });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ReceiptListPage from './receipt-list.js';

describe('ReceiptListPage', () => {
  beforeEach(() => {
    receiptListSpy.mockClear();
  });

  it('queries finance.receiptList with status: undefined and page 1 by default', () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance' });
    expect(receiptListSpy).toHaveBeenCalledWith({ status: undefined, page: 1, pageSize: 50 });
  });

  it('reads an initial ?status= from the URL and passes it to finance.receiptList', () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance?status=draft' });
    expect(receiptListSpy).toHaveBeenCalledWith({ status: 'draft', page: 1, pageSize: 50 });
  });

  it('selecting a status in the FilterBar Selector re-queries finance.receiptList with that status', async () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    const option = await screen.findByRole('option', { name: 'Nháp' });
    fireEvent.click(option);
    expect(receiptListSpy).toHaveBeenLastCalledWith({ status: 'draft', page: 1, pageSize: 50 });
  });

  it('typing in the FilterBar search box actually accepts the typed value (was a no-op before the fix)', () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Trần' } });
    expect(screen.getByDisplayValue('Trần')).toBeInTheDocument();
  });

  it('an initial ?q= filters the rendered rows client-side', () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance?q=Tr%E1%BA%A7n' });
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument();
  });

  it('typing a search term filters the rendered rows client-side', () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance' });
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Trần' } });

    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
  });
});

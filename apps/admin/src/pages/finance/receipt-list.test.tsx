// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Controlled FilterBar (value + onChange): local filter state drives query/UI.
// URL deep-link is best-effort (RR7 setSearchParams can AbortSignal-reject in jsdom).
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
        return queryResult({ items: ROWS, total: ROWS.length, page: 1, pageSize: 50 });
      },
      // EnrollPicker mounts always (closed); avoid missing-mock noise.
      'crm.opportunityList.useQuery': () => queryResult({ items: [] }),
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

  it('renders ListPagination in the list control footer', () => {
    renderWithProviders(<ReceiptListPage />, { route: '/finance' });
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument();
  });

  it('enables row selection and bulk copy of receipt codes', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithProviders(<ReceiptListPage />, { route: '/finance' });

    // Selection column: select-all checkbox in table header
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(checkboxes[0]!);

    const bulkBtn = screen.getByRole('button', { name: 'Sao chép mã phiếu' });
    expect(bulkBtn).not.toBeDisabled();
    fireEvent.click(bulkBtn);
    expect(writeText).toHaveBeenCalled();
    const arg = String(writeText.mock.calls[0]?.[0] ?? '');
    expect(arg).toContain('SO0001');
  });
});

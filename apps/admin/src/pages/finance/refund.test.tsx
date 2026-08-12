// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const listSpy = vi.fn();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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
      'finance.receiptList.useQuery': (input: unknown, opts?: { enabled?: boolean }) => {
        listSpy(input, opts?.enabled);
        if (opts?.enabled === false) return queryResult(undefined);
        return queryResult({
          items: [
            {
              id: 'r-approved-1',
              code: 'SO0099',
              studentName: 'Trần B',
              netAmount: 3_000_000,
              status: 'approved',
              createdAt: '2026-07-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import RefundPage from './refund.js';

describe('RefundPage', () => {
  beforeEach(() => {
    listSpy.mockClear();
    navigateMock.mockClear();
  });

  it('lists approved receipts as refund index and opens form via Mở phiếu', () => {
    renderWithProviders(<RefundPage />);
    expect(listSpy).toHaveBeenCalledWith(
      { status: 'approved', page: 1, pageSize: 20 },
      true,
    );
    expect(screen.getByText('SO0099')).toBeInTheDocument();
    expect(screen.getByText('Trần B')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở phiếu' }));
    expect(navigateMock).toHaveBeenCalledWith('/finance/r-approved-1');
  });

  it('does not show the old EmptyState coming-soon copy', () => {
    renderWithProviders(<RefundPage />);
    expect(screen.queryByText('Tính năng chưa áp dụng')).toBeNull();
  });
});

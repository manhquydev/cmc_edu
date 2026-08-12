// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const { CASE_ID, CASE_OPEN, CASE_RESOLVED } = vi.hoisted(() => {
  const CASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    CASE_ID,
    CASE_OPEN: {
      id: CASE_ID,
      studentId: 'st-1',
      studentName: 'Nguyễn Văn A',
      priority: 'normal',
      status: 'open',
      description: 'Phàn nàn lịch học',
      resolution: null,
      resolvedAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
    CASE_RESOLVED: {
      id: CASE_ID,
      studentId: 'st-1',
      studentName: 'Nguyễn Văn A',
      priority: 'normal',
      status: 'resolved',
      description: 'Phàn nàn lịch học',
      resolution: 'Đã xử lý',
      resolvedAt: '2026-08-02T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  };
});

const advanceMutate = vi.fn();
const closeMutate = vi.fn();
const resolveMutate = vi.fn();
let getData: typeof CASE_OPEN = CASE_OPEN;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ caseId: CASE_ID }),
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: ['giam_doc_kinh_doanh'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'afterSale.get.useQuery': () => queryResult(getData),
      'afterSale.advance.useMutation': () => mutationResult({ mutate: advanceMutate }),
      'afterSale.close.useMutation': () => mutationResult({ mutate: closeMutate }),
      'afterSale.resolve.useMutation': () => mutationResult({ mutate: resolveMutate }),
      'afterSale.list.invalidate': () => undefined,
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import AfterSaleDetailPage from './aftersale-detail.js';

describe('AfterSaleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getData = CASE_OPEN;
  });

  it('renders form from afterSale.get with Console chrome', () => {
    renderWithProviders(<AfterSaleDetailPage />, { route: `/crm/aftersale/${CASE_ID}` });
    expect(screen.getAllByText(/Nguyễn Văn A/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Nội dung case')).toBeInTheDocument();
    expect(screen.getByText('Phàn nàn lịch học')).toBeInTheDocument();
  });

  it('calls afterSale.advance.mutate({caseId}) from form Tiếp nhận', () => {
    renderWithProviders(<AfterSaleDetailPage />, { route: `/crm/aftersale/${CASE_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));
    expect(advanceMutate).toHaveBeenCalledWith(
      { caseId: CASE_ID },
      expect.anything(),
    );
  });

  it('opens resolve dialog and calls afterSale.resolve.mutate from form', () => {
    renderWithProviders(<AfterSaleDetailPage />, { route: `/crm/aftersale/${CASE_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Giải quyết' }));
    fireEvent.change(screen.getByLabelText(/^Kết quả xử lý/), {
      target: { value: 'Đã gặp PH' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(resolveMutate).toHaveBeenCalledWith(
      { caseId: CASE_ID, resolution: 'Đã gặp PH' },
      expect.anything(),
    );
  });

  it('calls afterSale.close.mutate({caseId}) when status is resolved', () => {
    getData = CASE_RESOLVED;
    renderWithProviders(<AfterSaleDetailPage />, { route: `/crm/aftersale/${CASE_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(closeMutate).toHaveBeenCalledWith({ caseId: CASE_ID }, expect.anything());
  });
});

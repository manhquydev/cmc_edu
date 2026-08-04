// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the receiptApprove failure path (finding #2, audit-260726-2040):
// `onError` used to only close the ConfirmDialog with no error rendered
// anywhere — a SoD/threshold/conflict rejection from the API disappeared
// silently. `approveMutation.error` must now render as a Banner.
const RECEIPT = {
  id: 'r1',
  code: 'SO0001',
  status: 'draft',
  kind: 'new',
  opportunityId: null,
  parentPhone: '0912345678',
  studentName: 'Nguyễn Văn A',
  classBatchId: 'batch-1',
  classBatchCode: 'CB001',
  netAmount: 5_000_000,
  createdAt: '2026-07-01T00:00:00.000Z',
  canApprove: true,
};

const receiptState: { data: typeof RECEIPT | undefined; error: { message: string } | null } = {
  data: RECEIPT,
  error: null,
};
const refetchSpy = vi.fn();
const approveMutate = vi.fn();
let approveOnSuccess: ((res: unknown) => void) | undefined;
let approveOnError: ((err: unknown) => void) | undefined;
const approveState: { error: { message: string } | null; isPending: boolean } = {
  error: null,
  isPending: false,
};

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u2',
          roles: ['giam_doc_kinh_doanh'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'finance.receiptGet.useQuery': () =>
        queryResult(receiptState.data, { error: receiptState.error, refetch: refetchSpy }),
      'finance.receiptApprove.useMutation': (options: {
        onSuccess?: (res: unknown) => void;
        onError?: (err: unknown) => void;
      }) => {
        approveOnSuccess = options?.onSuccess;
        approveOnError = options?.onError;
        return mutationResult({
          mutate: approveMutate,
          error: approveState.error,
          isPending: approveState.isPending,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ReceiptDetailPage from './receipt-detail.js';

function renderDetail(id = 'r1') {
  return renderWithProviders(
    <Routes>
      <Route path="/finance/:id" element={<ReceiptDetailPage />} />
    </Routes>,
    { route: `/finance/${id}` },
  );
}

describe('ReceiptDetailPage', () => {
  beforeEach(() => {
    receiptState.data = { ...RECEIPT };
    receiptState.error = null;
    refetchSpy.mockClear();
    approveMutate.mockClear();
    approveState.error = null;
    approveState.isPending = false;
  });

  it('renders the loaded receipt fields', () => {
    renderDetail();
    // Single identity: EntityHeader h1 owns the code (no dual PageHeader title).
    expect(screen.getByRole('heading', { name: 'SO0001' })).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SO0001').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Không tìm thấy phiếu thu" when receiptGet errors (e.g. missing permission)', () => {
    receiptState.data = undefined;
    receiptState.error = { message: 'Missing permission finance.receiptGet.' };
    renderDetail();
    expect(screen.getByText('Không tìm thấy phiếu thu')).toBeInTheDocument();
    expect(screen.getByText('Missing permission finance.receiptGet.')).toBeInTheDocument();
  });

  it('does not call finance.receiptApprove.mutate on the trigger click alone (confirm gating)', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt & Kích hoạt' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it('calls finance.receiptApprove.mutate({receiptId}) only after the ConfirmDialog confirm click', () => {
    renderDetail('r1');
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt & Kích hoạt' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt & Kích hoạt' }));
    expect(approveMutate).toHaveBeenCalledWith({ receiptId: 'r1' });
  });

  it('renders a "Duyệt phiếu thất bại" banner with the mutation error message', () => {
    approveState.error = { message: 'Người duyệt không được trùng người tạo phiếu.' };
    renderDetail();
    expect(screen.getByText('Duyệt phiếu thất bại')).toBeInTheDocument();
    expect(screen.getByText('Người duyệt không được trùng người tạo phiếu.')).toBeInTheDocument();
  });

  it('does not render the approve-failure banner when there is no error', () => {
    renderDetail();
    expect(screen.queryByText('Duyệt phiếu thất bại')).not.toBeInTheDocument();
  });

  it('closes the ConfirmDialog when receiptApprove.onError fires', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt & Kích hoạt' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(approveOnError).toBeDefined();
    act(() => approveOnError?.({ message: 'Vượt ngưỡng — cần GĐĐT duyệt' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders the provisioning-ok result banner and refetches after receiptApprove.onSuccess fires', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt & Kích hoạt' }));
    expect(approveOnSuccess).toBeDefined();
    act(() => approveOnSuccess?.({ provisioning: 'ok' }));
    expect(
      screen.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeInTheDocument();
    expect(refetchSpy).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

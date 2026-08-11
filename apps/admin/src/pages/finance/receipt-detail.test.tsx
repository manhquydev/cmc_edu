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
  refunds: [] as { id: string; receiptId: string; amount: number; createdAt: string }[],
  refundedTotal: 0,
  remainingBalance: 5_000_000,
  viewerCanRefund: false,
};

const receiptState: { data: typeof RECEIPT | undefined; error: { message: string } | null } = {
  data: RECEIPT,
  error: null,
};
const refetchSpy = vi.fn();
const approveMutate = vi.fn();
const refundMutate = vi.fn();
let approveOnSuccess: ((res: unknown) => void) | undefined;
let approveOnError: ((err: unknown) => void) | undefined;
let refundOnSuccess: ((res: unknown) => void) | undefined;
const approveState: { error: { message: string } | null; isPending: boolean } = {
  error: null,
  isPending: false,
};
const refundState: { error: { message: string } | null; isPending: boolean } = {
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
      'finance.refundCreate.useMutation': (options: {
        onSuccess?: (res: unknown) => void;
        onError?: (err: unknown) => void;
      }) => {
        refundOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: refundMutate,
          error: refundState.error,
          isPending: refundState.isPending,
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
    receiptState.data = { ...RECEIPT, refunds: [] };
    receiptState.error = null;
    refetchSpy.mockClear();
    approveMutate.mockClear();
    refundMutate.mockClear();
    approveState.error = null;
    approveState.isPending = false;
    refundState.error = null;
    refundState.isPending = false;
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

  // The workflow statusbar replaced a bespoke side-rail panel that rendered
  // "Đã hủy" as its own terminal row. A cancelled receipt is not sitting at
  // stage 0 — clamping its unknown stage index to 0 would show "Nháp (Draft)"
  // as the current step and drop the cancellation from the workflow entirely.
  it('marks "Đã hủy" as the current workflow step for a cancelled receipt', () => {
    receiptState.data = { ...RECEIPT, status: 'cancelled' };
    renderDetail();
    const steps = screen.getByRole('list', { name: 'Các bước' });
    expect(within(steps).getByRole('button', { current: 'step' })).toHaveTextContent('Đã hủy');
  });

  it('does not mark the draft stage as current for a cancelled receipt', () => {
    receiptState.data = { ...RECEIPT, status: 'cancelled' };
    renderDetail();
    const steps = screen.getByRole('list', { name: 'Các bước' });
    expect(within(steps).getByRole('button', { name: /Nháp \(Draft\)/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('marks the matching stage as current for a live receipt', () => {
    receiptState.data = { ...RECEIPT, status: 'approved' };
    renderDetail();
    const steps = screen.getByRole('list', { name: 'Các bước' });
    expect(within(steps).getByRole('button', { current: 'step' })).toHaveTextContent('Đã duyệt');
    // The cancelled terminal step only exists on a cancelled receipt.
    expect(within(steps).queryByRole('button', { name: /Đã hủy/ })).not.toBeInTheDocument();
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

  it('shows refund ledger and Ghi hoàn tiền when viewerCanRefund on approved receipt', () => {
    receiptState.data = {
      ...RECEIPT,
      status: 'approved',
      canApprove: false,
      viewerCanRefund: true,
      refundedTotal: 0,
      remainingBalance: 5_000_000,
      refunds: [],
    };
    renderDetail();
    expect(screen.getAllByText('Hoàn tiền').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Chưa có lần hoàn nào trên phiếu này.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghi hoàn tiền' })).toBeDisabled();
  });

  it('lists prior refunds and confirms refundCreate with amount', () => {
    receiptState.data = {
      ...RECEIPT,
      status: 'approved',
      canApprove: false,
      viewerCanRefund: true,
      refundedTotal: 1_000_000,
      remainingBalance: 4_000_000,
      refunds: [
        {
          id: 'rf1',
          receiptId: 'r1',
          amount: 1_000_000,
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
    };
    renderDetail();
    expect(screen.getByText(/−1\.000\.000 đ/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Số tiền hoàn/), { target: { value: '500000' } });
    const btn = screen.getByRole('button', { name: 'Ghi hoàn tiền' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(refundMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi hoàn tiền' }));
    expect(refundMutate).toHaveBeenCalledWith({ receiptId: 'r1', amount: 500_000 });
  });

  it('hides refund form when viewerCanRefund is false', () => {
    receiptState.data = {
      ...RECEIPT,
      status: 'approved',
      canApprove: false,
      viewerCanRefund: false,
      remainingBalance: 5_000_000,
      refunds: [],
    };
    renderDetail();
    expect(screen.getAllByText('Hoàn tiền').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Ghi hoàn tiền' })).toBeNull();
  });

  it('refetches after refundCreate.onSuccess', () => {
    receiptState.data = {
      ...RECEIPT,
      status: 'approved',
      canApprove: false,
      viewerCanRefund: true,
      remainingBalance: 5_000_000,
      refunds: [],
    };
    renderDetail();
    expect(refundOnSuccess).toBeDefined();
    act(() =>
      refundOnSuccess?.({
        refund: { id: 'rf2', receiptId: 'r1', amount: 100_000, createdAt: new Date() },
        remainingBalance: 4_900_000,
      }),
    );
    expect(refetchSpy).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks shift submit/approve/cancel BEFORE the FormPage refactor (TDD per
// phase-05): `shift.submit.mutate({shiftGroupId,fromDate,toDate,entries})`,
// `shift.approve.mutate({registrationId})`, `shift.cancel.mutate({registrationId})`
// MUST stay byte-identical — shift approval is audit-sensitive. Approve/cancel
// MUST only fire after the ConfirmDialog confirm click (never on the trigger
// click alone) — asserted explicitly below (confirm gating). Approve stays
// gated by `canDo('shift','approve')`. Result/error feedback renders via
// plain `Banner` with `description` (always visible) — NOT `ResultPanel`
// (same rationale as receipt-create.tsx / check-in-out.tsx).
const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const REG_ID = '33333333-3333-4333-8333-333333333333';

let sessionRoles: string[] = ['giam_doc_dao_tao'];

let submitOnSuccess: (() => void) | undefined;
let submitOnError: ((err: { message: string }) => void) | undefined;
const submitMutate = vi.fn();

let approveOnSuccess: (() => void) | undefined;
let approveOnError: ((err: { message: string }) => void) | undefined;
const approveMutate = vi.fn();

let cancelOnSuccess: (() => void) | undefined;
let cancelOnError: ((err: { message: string }) => void) | undefined;
const cancelMutate = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'shift.submit.useMutation': (options: {
        onSuccess?: () => void;
        onError?: (err: { message: string }) => void;
      }) => {
        submitOnSuccess = options?.onSuccess;
        submitOnError = options?.onError;
        return mutationResult({ mutate: submitMutate });
      },
      'shift.approve.useMutation': (options: {
        onSuccess?: () => void;
        onError?: (err: { message: string }) => void;
      }) => {
        approveOnSuccess = options?.onSuccess;
        approveOnError = options?.onError;
        return mutationResult({ mutate: approveMutate });
      },
      'shift.cancel.useMutation': (options: {
        onSuccess?: () => void;
        onError?: (err: { message: string }) => void;
      }) => {
        cancelOnSuccess = options?.onSuccess;
        cancelOnError = options?.onError;
        return mutationResult({ mutate: cancelMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ShiftsPage from './shifts.js';

function submitForm() {
  fireEvent.submit(document.querySelector('form')!);
}

function goToApproveTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt / Hủy' }));
}

describe('ShiftsPage', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_dao_tao'];
    submitMutate.mockClear();
    approveMutate.mockClear();
    cancelMutate.mockClear();
  });

  it('renders the submit tab by default with the shiftGroupId field', () => {
    renderWithProviders(<ShiftsPage />);
    expect(screen.getByLabelText(/^Nhóm ca/)).toBeInTheDocument();
  });

  it('does not call shift.submit.mutate when required fields are missing', () => {
    renderWithProviders(<ShiftsPage />);
    submitForm();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it('submits shift.submit.mutate with a byte-identical payload', () => {
    renderWithProviders(<ShiftsPage />);

    fireEvent.change(screen.getByLabelText(/^Nhóm ca/), { target: { value: GROUP_ID } });
    fireEvent.change(screen.getByLabelText('Từ ngày (YYYY-MM-DD)'), { target: { value: '2099-01-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày (YYYY-MM-DD)'), { target: { value: '2099-01-31' } });
    fireEvent.change(screen.getByLabelText('Ngày (YYYY-MM-DD)'), { target: { value: '2099-01-05' } });
    fireEvent.change(screen.getByLabelText(/^Mẫu ca/), { target: { value: TEMPLATE_ID } });

    submitForm();

    expect(submitMutate).toHaveBeenCalledWith({
      shiftGroupId: GROUP_ID,
      fromDate: '2099-01-01',
      toDate: '2099-01-31',
      entries: [{ date: '2099-01-05', shiftTemplateId: TEMPLATE_ID }],
    });
  });

  it('renders an always-visible success banner after shift.submit succeeds', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.change(screen.getByLabelText(/^Nhóm ca/), { target: { value: GROUP_ID } });
    fireEvent.change(screen.getByLabelText('Từ ngày (YYYY-MM-DD)'), { target: { value: '2099-01-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày (YYYY-MM-DD)'), { target: { value: '2099-01-31' } });
    fireEvent.change(screen.getByLabelText('Ngày (YYYY-MM-DD)'), { target: { value: '2099-01-05' } });
    fireEvent.change(screen.getByLabelText(/^Mẫu ca/), { target: { value: TEMPLATE_ID } });
    submitForm();
    expect(submitOnSuccess).toBeDefined();
    act(() => submitOnSuccess?.());
    expect(screen.getByText('Đăng ký ca đã gửi, chờ GĐ duyệt.')).toBeInTheDocument();
  });

  it('renders an always-visible error banner when shift.submit fails', () => {
    renderWithProviders(<ShiftsPage />);
    fireEvent.change(screen.getByLabelText(/^Nhóm ca/), { target: { value: GROUP_ID } });
    fireEvent.change(screen.getByLabelText('Từ ngày (YYYY-MM-DD)'), { target: { value: '2099-01-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày (YYYY-MM-DD)'), { target: { value: '2099-01-31' } });
    fireEvent.change(screen.getByLabelText('Ngày (YYYY-MM-DD)'), { target: { value: '2099-01-05' } });
    fireEvent.change(screen.getByLabelText(/^Mẫu ca/), { target: { value: TEMPLATE_ID } });
    submitForm();
    expect(submitOnError).toBeDefined();
    act(() => submitOnError?.({ message: 'Đã có đăng ký chờ duyệt' }));
    expect(screen.getByText('Đã có đăng ký chờ duyệt')).toBeInTheDocument();
  });

  it('shows the Approve button on the approve tab for a role with shift.approve permission', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    expect(screen.getByRole('button', { name: 'Duyệt ca' })).toBeInTheDocument();
  });

  it('hides the Approve button for a role without shift.approve permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    expect(screen.queryByRole('button', { name: 'Duyệt ca' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hủy đăng ký' })).toBeInTheDocument();
  });

  it('does NOT call shift.approve.mutate on the trigger click alone (confirm gating)', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    fireEvent.change(screen.getByLabelText(/^ID đăng ký ca/), { target: { value: REG_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt ca' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it('calls shift.approve.mutate({registrationId}) only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    fireEvent.change(screen.getByLabelText(/^ID đăng ký ca/), { target: { value: REG_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt ca' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).toHaveBeenCalledWith({ registrationId: REG_ID });
  });

  it('does NOT call shift.cancel.mutate on the trigger click alone (confirm gating)', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    fireEvent.change(screen.getByLabelText(/^ID đăng ký ca/), { target: { value: REG_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(cancelMutate).not.toHaveBeenCalled();
  });

  it('calls shift.cancel.mutate({registrationId}) only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    fireEvent.change(screen.getByLabelText(/^ID đăng ký ca/), { target: { value: REG_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy ca' }));
    expect(cancelMutate).toHaveBeenCalledWith({ registrationId: REG_ID });
  });

  it('renders an always-visible result banner on the approve tab after a successful action', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    fireEvent.change(screen.getByLabelText(/^ID đăng ký ca/), { target: { value: REG_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt ca' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveOnSuccess).toBeDefined();
    act(() => approveOnSuccess?.());
    expect(screen.getByText('Đã duyệt ca thành công.')).toBeInTheDocument();
  });

  it('renders an always-visible error banner on the approve tab after a failed action', () => {
    renderWithProviders(<ShiftsPage />);
    goToApproveTab();
    fireEvent.change(screen.getByLabelText(/^ID đăng ký ca/), { target: { value: REG_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy ca' }));
    expect(cancelOnError).toBeDefined();
    act(() => cancelOnError?.({ message: 'Không thể hủy' }));
    expect(screen.getByText('Không thể hủy')).toBeInTheDocument();
  });
});

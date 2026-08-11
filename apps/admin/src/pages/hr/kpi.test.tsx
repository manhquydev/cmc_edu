// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks "KPI" (HR remediation phase 5, red-team #24 — migrated
// inventory: getForUser→list, single-score approve→bulkApprove, confirm
// kept). `kpi.list({period,status})` inbox is already branch-scoped
// server-side — this screen does NOT re-filter by role. `kpi.confirm`,
// `kpi.override`, `kpi.bulkApprove` payloads MUST stay byte-identical.
// Confirm/override/bulkApprove MUST only fire after their modal's confirm
// click (never on the trigger click alone).
const ROW_SUBMITTED = {
  id: 'kpi-1',
  appUserId: 'u-1',
  status: 'submitted',
  value: 1_500_000,
  override: false,
  overrideReason: null,
  tierMissing: false,
  fullName: 'Nguyễn Văn A',
  position: 'Sale',
};

const ROW_CONFIRMED = {
  id: 'kpi-2',
  appUserId: 'u-2',
  status: 'confirmed',
  value: 2_000_000,
  override: false,
  overrideReason: null,
  tierMissing: false,
  fullName: 'Trần Thị B',
  position: 'Giáo viên',
};

let sessionRoles: string[] = ['giam_doc_dao_tao'];

const listSpy = vi.fn();
const listEnabledSpy = vi.fn();
let listData: unknown[] = [ROW_SUBMITTED];

const confirmMutate = vi.fn();
const overrideMutate = vi.fn();
const bulkApproveMutate = vi.fn();
let bulkApproveOnSuccess: ((res: unknown) => void) | undefined;

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
      'kpi.list.useQuery': (input: unknown, options?: { enabled?: boolean }) => {
        listSpy(input);
        listEnabledSpy(options?.enabled);
        return queryResult(listData);
      },
      'kpi.confirm.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { confirmMutate(...a); opts?.onSuccess?.(); } }),
      'kpi.override.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { overrideMutate(...a); opts?.onSuccess?.(); } }),
      'kpi.bulkApprove.useMutation': (opts: { onSuccess?: (res: unknown) => void }) => {
        bulkApproveOnSuccess = opts?.onSuccess;
        return mutationResult({ mutate: (...a: unknown[]) => bulkApproveMutate(...a) });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import KpiPage from './kpi.js';

describe('KpiPage', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_dao_tao'];
    listData = [ROW_SUBMITTED];
    listSpy.mockClear();
    listEnabledSpy.mockClear();
    confirmMutate.mockClear();
    overrideMutate.mockClear();
    bulkApproveMutate.mockClear();
  });

  it('queries kpi.list({period, status}) with the default status filter "submitted"', () => {
    renderWithProviders(<KpiPage />);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ period: expect.stringMatching(/^\d{4}-\d{2}$/) as unknown as string, status: 'submitted' }),
    );
  });

  it('renders inbox rows from kpi.list', () => {
    renderWithProviders(<KpiPage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('1.500.000 đ')).toBeInTheDocument();
  });

  it('does NOT call kpi.confirm.mutate on the trigger click alone (confirm gating)', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(confirmMutate).not.toHaveBeenCalled();
  });

  it('calls kpi.confirm.mutate({kpiScoreId}) only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(confirmMutate).toHaveBeenCalledWith({ kpiScoreId: 'kpi-1' });
  });

  it('hides the Xác nhận button for a role without kpi.confirm permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<KpiPage />);
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
  });

  it('opens the override modal and calls kpi.override.mutate with reason', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ghi đè' }));
    fireEvent.change(screen.getByLabelText('Giá trị mới (VND)'), { target: { value: '1800000' } });
    fireEvent.change(screen.getByLabelText('Lý do ghi đè'), { target: { value: 'Điều chỉnh theo doanh số' } });
    const submitButtons = screen.getAllByRole('button', { name: 'Ghi đè' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    expect(overrideMutate).toHaveBeenCalledWith({
      kpiScoreId: 'kpi-1',
      value: 1_800_000,
      overrideReason: 'Điều chỉnh theo doanh số',
    });
  });

  it('disables the override submit until a reason is entered', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ghi đè' })[0]);
    const submitButtons = screen.getAllByRole('button', { name: 'Ghi đè' });
    const modalSubmit = submitButtons[submitButtons.length - 1];
    expect(modalSubmit).toBeDisabled();
  });

  it('hides Ghi đè for a role without kpi.approve permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<KpiPage />);
    expect(screen.queryByRole('button', { name: 'Ghi đè' })).toBeNull();
  });

  it('shows the "Đã trả lương kỳ X" button for canDo(kpi,bulkApprove)', () => {
    renderWithProviders(<KpiPage />);
    expect(screen.getByRole('button', { name: /Đã trả lương kỳ/ })).toBeInTheDocument();
  });

  it('hides the "Đã trả lương kỳ X" button for a role without kpi.bulkApprove permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<KpiPage />);
    expect(screen.queryByRole('button', { name: /Đã trả lương kỳ/ })).toBeNull();
  });

  it('does NOT call kpi.bulkApprove.mutate on the trigger click alone (confirm gating)', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: /Đã trả lương kỳ/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(bulkApproveMutate).not.toHaveBeenCalled();
  });

  it('shows the confirmed-row count and names + self-exclusion warning in the bulkApprove confirm message', () => {
    listData = [ROW_CONFIRMED];
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: /Đã trả lương kỳ/ }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Trần Thị B/)).toBeInTheDocument();
    expect(within(dialog).getByText(/tự động bị loại/)).toBeInTheDocument();
  });

  it('calls kpi.bulkApprove.mutate({period}) only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: /Đã trả lương kỳ/ }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tất toán' }));
    expect(bulkApproveMutate).toHaveBeenCalledWith({ period: expect.stringMatching(/^\d{4}-\d{2}$/) as unknown as string });
  });

  it('renders an always-visible success summary banner after a successful bulkApprove', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.click(screen.getByRole('button', { name: /Đã trả lương kỳ/ }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tất toán' }));
    expect(bulkApproveOnSuccess).toBeDefined();
    act(() => bulkApproveOnSuccess?.({ approved: 3, skippedSelf: 1, skippedUnfinalized: [] }));
    expect(screen.getByText(/Đã tất toán 3 phiếu KPI/)).toBeInTheDocument();
  });

  it('shows a tierMissing badge on rows lacking a salary tier', () => {
    listData = [{ ...ROW_SUBMITTED, tierMissing: true }];
    renderWithProviders(<KpiPage />);
    expect(screen.getByText('Chưa gán bậc')).toBeInTheDocument();
  });

  it('keeps kpi.list enabled for the default YYYY-MM period', () => {
    renderWithProviders(<KpiPage />);
    expect(listEnabledSpy).toHaveBeenLastCalledWith(true);
  });

  it('disables kpi.list while the period text does not match YYYY-MM', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.change(screen.getByLabelText('Kỳ (YYYY-MM)'), { target: { value: '2026-0' } });
    expect(listEnabledSpy).toHaveBeenLastCalledWith(false);
  });

  it('re-enables kpi.list once the period matches YYYY-MM again', () => {
    renderWithProviders(<KpiPage />);
    fireEvent.change(screen.getByLabelText('Kỳ (YYYY-MM)'), { target: { value: '2026-0' } });
    fireEvent.change(screen.getByLabelText('Kỳ (YYYY-MM)'), { target: { value: '2026-08' } });
    expect(listEnabledSpy).toHaveBeenLastCalledWith(true);
  });
});

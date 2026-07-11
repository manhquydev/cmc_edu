// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the user-pick (`user.list.useQuery`) binding + `kpi.getForUser.useQuery`
// binding + `kpi.confirm/approve.mutate` payloads BEFORE the DetailPage
// refactor (TDD per phase-06). Confirm/approve are audit-sensitive status
// transitions (kpi.confirm/kpi.approve) — payloads MUST stay byte-identical
// and MUST only fire after the ConfirmDialog confirm click (never on the
// trigger click alone), matching the shifts.tsx confirm-gating precedent.
// Result/error feedback renders via a plain `Banner` with `description`
// (always visible) — NOT `ResultPanel`.
const STAFF = {
  id: 'u-1',
  fullName: 'Nguyễn Văn A',
  employeeCode: 'NV001',
  position: 'Giáo viên',
};

let sessionRoles: string[] = ['giam_doc_dao_tao'];

const userListSpy = vi.fn();
const getForUserSpy = vi.fn();
const getForUserRefetch = vi.fn();

let kpiData: Record<string, unknown> | undefined = {
  id: 'kpi-1',
  status: 'submitted',
  value: 85,
  kpiMax: 100,
  override: false,
  overrideReason: null,
};
let kpiError: { message: string } | null = null;

const confirmMutate = vi.fn();
let confirmOnSuccess: (() => void) | undefined;
let confirmOnError: ((err: { message: string }) => void) | undefined;

const approveMutate = vi.fn();
let approveOnSuccess: (() => void) | undefined;
let approveOnError: ((err: { message: string }) => void) | undefined;

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
      'user.list.useQuery': (input: unknown) => {
        userListSpy(input);
        return queryResult({ items: [STAFF] });
      },
      'kpi.getForUser.useQuery': (input: unknown, opts: unknown) => {
        getForUserSpy(input, opts);
        return queryResult(kpiData, {
          error: kpiError,
          isError: kpiError !== null,
          refetch: getForUserRefetch,
        });
      },
      'kpi.confirm.useMutation': (options: {
        onSuccess?: () => void;
        onError?: (err: { message: string }) => void;
      }) => {
        confirmOnSuccess = options?.onSuccess;
        confirmOnError = options?.onError;
        return mutationResult({ mutate: confirmMutate });
      },
      'kpi.approve.useMutation': (options: {
        onSuccess?: () => void;
        onError?: (err: { message: string }) => void;
      }) => {
        approveOnSuccess = options?.onSuccess;
        approveOnError = options?.onError;
        return mutationResult({ mutate: approveMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import KpiPage from './kpi.js';

function selectStaff() {
  fireEvent.click(screen.getByText('NV001'));
}

describe('KpiPage', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_dao_tao'];
    kpiData = {
      id: 'kpi-1',
      status: 'submitted',
      value: 85,
      kpiMax: 100,
      override: false,
      overrideReason: null,
    };
    kpiError = null;
    userListSpy.mockClear();
    getForUserSpy.mockClear();
    getForUserRefetch.mockClear();
    confirmMutate.mockClear();
    approveMutate.mockClear();
  });

  it('renders the staff list from user.list.useQuery', () => {
    renderWithProviders(<KpiPage />);
    expect(userListSpy).toHaveBeenCalled();
    expect(screen.getByText('NV001')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
  });

  it('does not query kpi.getForUser before a staff row is selected', () => {
    renderWithProviders(<KpiPage />);
    expect(getForUserSpy).not.toHaveBeenCalled();
  });

  it('queries kpi.getForUser({appUserId, period}) with the current period after selecting a staff row', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(getForUserSpy).toHaveBeenCalledTimes(1);
    const [input] = getForUserSpy.mock.calls[0] as [{ appUserId: string; period: string }];
    expect(input.appUserId).toBe('u-1');
    expect(input.period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('shows the KPI score and status badge from getForUser data', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
  });

  it('renders an always-visible warning banner when kpi.getForUser errors', () => {
    kpiData = undefined;
    kpiError = { message: 'not found' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.getByText('Chưa có điểm KPI')).toBeInTheDocument();
  });

  it('shows the Confirm button for submitted status when canDo(kpi,confirm)', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.getByRole('button', { name: 'Xác nhận (Quản lý)' })).toBeInTheDocument();
  });

  it('hides the Confirm button for a role without kpi.confirm permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.queryByRole('button', { name: 'Xác nhận (Quản lý)' })).toBeNull();
  });

  it('hides the Confirm button when status is not submitted', () => {
    kpiData = { ...kpiData, status: 'confirmed' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.queryByRole('button', { name: 'Xác nhận (Quản lý)' })).toBeNull();
  });

  it('shows the Approve button for confirmed status when canDo(kpi,approve)', () => {
    kpiData = { ...kpiData, status: 'confirmed' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.getByRole('button', { name: 'Duyệt (GĐ)' })).toBeInTheDocument();
  });

  it('shows the approved completion badge for approved status', () => {
    kpiData = { ...kpiData, status: 'approved' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.getByText('Đã duyệt — hoàn tất')).toBeInTheDocument();
  });

  it('does NOT call kpi.confirm.mutate on the trigger click alone (confirm gating)', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận (Quản lý)' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(confirmMutate).not.toHaveBeenCalled();
  });

  it('calls kpi.confirm.mutate({kpiScoreId}) with a byte-identical payload only after the ConfirmDialog confirm click', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận (Quản lý)' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(confirmMutate).toHaveBeenCalledWith({ kpiScoreId: 'kpi-1' });
  });

  it('refetches kpi.getForUser after a successful confirm', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận (Quản lý)' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(confirmOnSuccess).toBeDefined();
    act(() => confirmOnSuccess?.());
    expect(getForUserRefetch).toHaveBeenCalled();
  });

  it('renders an always-visible error banner when kpi.confirm fails', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận (Quản lý)' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(confirmOnError).toBeDefined();
    act(() => confirmOnError?.({ message: 'Lỗi xác nhận' }));
    expect(screen.getByText('Lỗi xác nhận')).toBeInTheDocument();
  });

  it('does NOT call kpi.approve.mutate on the trigger click alone (confirm gating)', () => {
    kpiData = { ...kpiData, status: 'confirmed' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt (GĐ)' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it('calls kpi.approve.mutate({kpiScoreId}) with a byte-identical payload only after the ConfirmDialog confirm click', () => {
    kpiData = { ...kpiData, status: 'confirmed' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt (GĐ)' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).toHaveBeenCalledWith({ kpiScoreId: 'kpi-1' });
  });

  it('refetches kpi.getForUser after a successful approve', () => {
    kpiData = { ...kpiData, status: 'confirmed' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt (GĐ)' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveOnSuccess).toBeDefined();
    act(() => approveOnSuccess?.());
    expect(getForUserRefetch).toHaveBeenCalled();
  });

  it('renders an always-visible error banner when kpi.approve fails', () => {
    kpiData = { ...kpiData, status: 'confirmed' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt (GĐ)' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveOnError).toBeDefined();
    act(() => approveOnError?.({ message: 'Lỗi duyệt' }));
    expect(screen.getByText('Lỗi duyệt')).toBeInTheDocument();
  });

  it('renders a warning banner for an override with the override reason', () => {
    kpiData = { ...kpiData, override: true, overrideReason: 'Điều chỉnh theo doanh số quý' };
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.getByText('Đã ghi đè (override)')).toBeInTheDocument();
    expect(screen.getByText('Điều chỉnh theo doanh số quý')).toBeInTheDocument();
  });

  it('navigates back to the staff list via the back button', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    expect(screen.queryByText('NV001')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Danh sách nhân viên/ }));
    expect(screen.getByText('NV001')).toBeInTheDocument();
  });

  it('renders the back-button chevron as a monochrome LineIcon (not a text arrow)', () => {
    renderWithProviders(<KpiPage />);
    selectStaff();
    const backButton = screen.getByRole('button', { name: /Danh sách nhân viên/ });
    expect(backButton.querySelector('svg[data-icon="chevron"]')).toBeTruthy();
    expect(backButton.textContent).not.toMatch(/[←→]/);
  });
});

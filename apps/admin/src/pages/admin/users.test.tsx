// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks current user.list/user.create/user.updateRoles behavior + the
// permission gate BEFORE the ListPage refactor (TDD per phase-02). RBAC is
// security-sensitive: `user.updateRoles.mutate` payload MUST stay
// byte-identical (`{ appUserId, roles }` — NOT `userId`) so this refactor
// only changes presentation, never the wire contract.
interface UserRow {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string;
  email: string;
  roles: string[];
  isActive: boolean;
}

const ROW_A: UserRow = {
  id: 'u-a',
  employeeCode: 'CMC001',
  fullName: 'Nguyễn Văn A',
  position: 'Giáo viên',
  email: 'a@cmc.edu.vn',
  roles: ['giao_vien'],
  isActive: true,
};

const usersListState: { data: { items: UserRow[] }; error: { message: string } | null } = {
  data: { items: [ROW_A] },
  error: null,
};
let sessionRoles: string[] = ['super_admin'];
const listQuerySpy = vi.fn();
const createMutate = vi.fn();
const updateRolesMutate = vi.fn();
const resetPasswordMutate = vi.fn();
let createOnSuccess: (() => void) | undefined;
let updateRolesOnSuccess: (() => void) | undefined;
let resetPasswordOnSuccess: (() => void) | undefined;

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
      'user.list.useQuery': (...args: unknown[]) => {
        listQuerySpy(...args);
        return queryResult(usersListState.data, {
          error: usersListState.error,
          isError: usersListState.error !== null,
        });
      },
      'user.create.useMutation': (options: { onSuccess?: () => void }) => {
        createOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: createMutate });
      },
      'user.updateRoles.useMutation': (options: { onSuccess?: () => void }) => {
        updateRolesOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: updateRolesMutate });
      },
      'user.resetPassword.useMutation': (options: { onSuccess?: () => void }) => {
        resetPasswordOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: resetPasswordMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import UsersPage from './users.js';

describe('UsersPage', () => {
  beforeEach(() => {
    sessionRoles = ['super_admin'];
    usersListState.data = { items: [ROW_A] };
    usersListState.error = null;
    listQuerySpy.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders user rows bound to user.list.useQuery', () => {
    renderWithProviders(<UsersPage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('CMC001')).toBeInTheDocument();
  });

  it('hosts FilterBar and debounces search into user.list({ search })', async () => {
    renderWithProviders(<UsersPage />);
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();
    listQuerySpy.mockClear();
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });
    const mid = listQuerySpy.mock.calls.at(-1)?.[0] as { search?: string } | undefined;
    expect(mid?.search).toBeUndefined();
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      expect(listQuerySpy).toHaveBeenCalledWith({ search: 'Nguyễn' });
    });
  });

  it('renders empty state when user.list returns no rows', () => {
    usersListState.data = { items: [] };
    renderWithProviders(<UsersPage />);
    expect(screen.getByText('Chưa có nhân viên nào')).toBeInTheDocument();
  });

  it('renders error banner when user.list fails', () => {
    usersListState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<UsersPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });

  it('creates a user with roles and the first password in one user.create call, and invalidates user.list on success', () => {
    const invalidateSpy = trpc.useUtils().user.list.invalidate;
    renderWithProviders(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/^User ID/), { target: { value: 'newuser@cmc.edu.vn' } });
    fireEvent.change(within(dialog).getByLabelText(/^Họ tên/), { target: { value: 'Trần Thị B' } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'b@cmc.edu.vn' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vai trò' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sale' }));

    // Picking the role fills the still-empty job title with that role's usual one.
    expect(within(dialog).getByLabelText(/^Vị trí/)).toHaveValue('Nhân viên kinh doanh');

    fireEvent.change(within(dialog).getByLabelText(/^Mật khẩu đầu tiên/), {
      target: { value: 'first-pass-123' },
    });

    fireEvent.click(within(dialog).getByText('Tạo'));

    expect(createMutate).toHaveBeenCalledWith({
      userId: 'newuser@cmc.edu.vn',
      email: 'b@cmc.edu.vn',
      fullName: 'Trần Thị B',
      position: 'Nhân viên kinh doanh',
      roles: ['sale'],
      tempPassword: 'first-pass-123',
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    act(() => createOnSuccess?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses to submit a staff profile with no role — an account that can sign in but reach nothing', () => {
    renderWithProviders(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/^User ID/), { target: { value: 'norole@cmc.edu.vn' } });
    fireEvent.change(within(dialog).getByLabelText(/^Họ tên/), { target: { value: 'Không Vai Trò' } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'norole@cmc.edu.vn' } });
    fireEvent.change(within(dialog).getByLabelText(/^Vị trí/), { target: { value: 'Sale' } });

    fireEvent.click(within(dialog).getByText('Tạo'));
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('assigns roles with a byte-identical user.updateRoles.mutate({appUserId, roles}) payload and invalidates on success', () => {
    const invalidateSpy = trpc.useUtils().user.list.invalidate;
    renderWithProviders(<UsersPage />);

    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Phân quyền — Nguyễn Văn A')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText('Lưu'));

    expect(updateRolesMutate).toHaveBeenCalledWith({ appUserId: 'u-a', roles: ['giao_vien'] });

    expect(invalidateSpy).not.toHaveBeenCalled();
    act(() => updateRolesOnSuccess?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('resets a password with user.resetPassword({appUserId, tempPassword}) and shows the handover note', () => {
    renderWithProviders(<UsersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Đặt lại mật khẩu — Nguyễn Văn A')).toBeInTheDocument();
    // The action button must NOT also open the row's roles modal.
    expect(screen.queryByText('Phân quyền — Nguyễn Văn A')).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Mật khẩu tạm/), {
      target: { value: 'temporary-pass-1' },
    });
    fireEvent.click(within(dialog).getByText('Đặt mật khẩu tạm'));

    expect(resetPasswordMutate).toHaveBeenCalledWith({
      appUserId: 'u-a',
      tempPassword: 'temporary-pass-1',
    });

    act(() => resetPasswordOnSuccess?.());
    expect(within(dialog).getByText(/Đã đặt mật khẩu tạm/)).toBeInTheDocument();
  });

  it('renders a gated premium EmptyState (no emoji) when the user lacks user.manage permission', () => {
    sessionRoles = ['sale'];
    const { container } = renderWithProviders(<UsersPage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/🔒/u);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render-with-providers.js';
import StaffAccessSection from './access.js';

// D1/D2: roles/reset live here as EXPLICIT actions — row click never opens a
// permission dialog. Password events stay dialog-local.

const STAFF_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let updateRolesMutateSpy: ReturnType<typeof vi.fn>;
let resetPasswordMutateSpy: ReturnType<typeof vi.fn>;

const STAFF = {
  id: STAFF_UUID,
  fullName: 'Nhân Viên Mẫu',
  userId: 'u-staff',
  roles: ['sale'],
};

vi.mock('../../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.updateRoles.useMutation': (options: unknown) => {
        const base = mutationResult((options as Record<string, unknown>) ?? {});
        const mutate = vi.fn((input: unknown) => {
          updateRolesMutateSpy?.(input);
          base.onSuccess?.(undefined);
        });
        return { ...base, mutate };
      },
      'user.resetPassword.useMutation': (options: unknown) => {
        const base = mutationResult((options as Record<string, unknown>) ?? {});
        const mutate = vi.fn((input: unknown) => {
          resetPasswordMutateSpy?.(input);
          base.onSuccess?.(undefined);
        });
        return { ...base, mutate };
      },
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: ['giam_doc_kinh_doanh'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ staffId: STAFF_UUID }),
    useOutletContext: () => ({ staff: STAFF }),
  };
});

describe('StaffAccessSection', () => {
  beforeEach(() => {
    updateRolesMutateSpy = vi.fn();
    resetPasswordMutateSpy = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('assigns roles through the explicit roles dialog', async () => {
    renderWithProviders(<StaffAccessSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Gán vai trò' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).getByRole('button', { name: 'Roles' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Roles' }));
    fireEvent.click(screen.getByRole('option', { name: 'Giáo viên' }));
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Roles' }), { key: 'Escape' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => {
      expect(updateRolesMutateSpy).toHaveBeenCalledWith({
        appUserId: STAFF_UUID,
        roles: ['sale', 'giao_vien'],
      });
    });
  });

  it('resets the password through the explicit reset dialog', async () => {
    renderWithProviders(<StaffAccessSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Mật khẩu tạm/), {
      target: { value: 'TempPass123!' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đặt mật khẩu tạm' }));

    await waitFor(() => {
      expect(resetPasswordMutateSpy).toHaveBeenCalledWith({
        appUserId: STAFF_UUID,
        tempPassword: 'TempPass123!',
      });
    });
  });
});

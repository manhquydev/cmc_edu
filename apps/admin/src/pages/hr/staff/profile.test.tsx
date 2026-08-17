// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render-with-providers.js';
import StaffProfileSection from './profile.js';

// D1/D2: profile edits fullName/email/position/managerId/isActive via the
// existing user.update; the manager dropdown uses user.managerPickList
// (directors never see super_admin targets — server-enforced).

const STAFF_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let updateMutateSpy: ReturnType<typeof vi.fn>;
let managerRoster: unknown[];

const STAFF = {
  id: STAFF_UUID,
  fullName: 'Nhân Viên Mẫu',
  email: 'staff@test.cmc',
  position: 'sale',
  managerId: null,
  manager: null,
  isActive: true,
};

vi.mock('../../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.managerPickList.useQuery': () => queryResult({ items: managerRoster }),
      'user.update.useMutation': (options: unknown) => {
        const base = mutationResult((options as Record<string, unknown>) ?? {});
        const mutate = vi.fn((input: unknown) => {
          updateMutateSpy?.(input);
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
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({ staff: STAFF, backPath: '/hr/staff' }),
  };
});

describe('StaffProfileSection', () => {
  beforeEach(() => {
    updateMutateSpy = vi.fn();
    managerRoster = [{ id: 'mgr-1', fullName: 'Quản Lý', employeeCode: 'CMC0001' }];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('edits profile fields and saves via user.update', async () => {
    renderWithProviders(<StaffProfileSection />);
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Tên Đã Sửa' } });
    fireEvent.change(screen.getByLabelText(/^Vị trí/), { target: { value: 'giao_vien' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    await waitFor(() => {
      expect(updateMutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          appUserId: STAFF_UUID,
          fullName: 'Tên Đã Sửa',
          position: 'giao_vien',
          email: 'staff@test.cmc',
          isActive: true,
        }),
      );
    });
  });

  it('toggles isActive and clears managerId when NO_MANAGER is picked', async () => {
    renderWithProviders(<StaffProfileSection />);
    // Pick "— Chưa có —" for manager (currently null → already NO_MANAGER).
    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    await waitFor(() => {
      expect(updateMutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ appUserId: STAFF_UUID, isActive: false }),
      );
    });
  });
});

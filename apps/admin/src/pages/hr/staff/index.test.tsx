// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render-with-providers.js';
import StaffListPage from './index.js';

// The staff list is an INDEX (D1): row click navigates to the profile, never
// opens a permission dialog. URL owns q/page; the page hydrates from and
// writes back to those keys so F5/share/back preserve the view.

let listItems: unknown[] = [];
let listSpy: ReturnType<typeof vi.fn>;
let navigateSpy: ReturnType<typeof vi.fn>;
let sessionRoles: string[] = ['giam_doc_kinh_doanh'];

vi.mock('../../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.list.useQuery': (input: unknown) => {
        listSpy?.(input);
        return queryResult({ items: listItems });
      },
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
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
    useNavigate: () => navigateSpy,
  };
});

function makeUser(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    employeeCode: `CMC${id.replace(/\D/g, '')}`,
    fullName: `Nhân viên ${id}`,
    position: 'sale',
    email: `${id}@test.cmc`,
    roles: ['sale'],
    isActive: true,
    ...over,
  };
}

describe('StaffListPage', () => {
  beforeEach(() => {
    listSpy = vi.fn();
    navigateSpy = vi.fn();
    listItems = [makeUser('11111111-1111-4111-8111-111111111111'), makeUser('22222222-2222-4222-8222-222222222222')];
    sessionRoles = ['giam_doc_kinh_doanh'];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders staff rows bound to user.list.useQuery', () => {
    renderWithProviders(<StaffListPage />);
    expect(screen.getByText('Nhân viên 11111111-1111-4111-8111-111111111111')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên 22222222-2222-4222-8222-222222222222')).toBeInTheDocument();
  });

  it('row click navigates to the canonical profile URL, not a dialog', async () => {
    renderWithProviders(<StaffListPage />);
    const row = screen.getByText('Nhân viên 11111111-1111-4111-8111-111111111111');
    fireEvent.click(row);
    expect(navigateSpy).toHaveBeenCalledWith(
      '/hr/staff/11111111-1111-4111-8111-111111111111/profile',
      expect.objectContaining({ state: expect.any(Object) }),
    );
  });

  it('hydrates q from the URL and queries with it', () => {
    renderWithProviders(<StaffListPage />, { route: '/hr/staff?q=alpha' });
    expect(listSpy).toHaveBeenCalledWith({ search: 'alpha' });
  });

  it('debounces the search input into user.list({ search })', async () => {
    renderWithProviders(<StaffListPage />);
    const input = screen.getByPlaceholderText('Tên, email, mã NV…');
    fireEvent.change(input, { target: { value: 'beta' } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(listSpy).toHaveBeenCalledWith({ search: 'beta' });
  });

  it('renders a gated EmptyState when the user lacks user.manage', () => {
    sessionRoles = ['giao_vien'];
    renderWithProviders(<StaffListPage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
  });
});

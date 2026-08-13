// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks H1: after student.get settles with null, list location.state must not
// mask the not-found EmptyState (warm-path bug from deep-link review).

const STUDENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const meState = vi.hoisted(() => ({
  roles: ['giam_doc_kinh_doanh'] as string[],
}));

const getState = vi.hoisted(() => ({
  data: null as null | { id: string; fullName: string; lifecycle: string; parentPhone: string | null },
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  error: null as { message: string } | null,
}));

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () => ({
        data: {
          userId: 'u1',
          roles: meState.roles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        },
        isLoading: false,
        error: null,
      }),
      'student.get.useQuery': () => ({
        data: getState.data,
        isLoading: getState.isLoading,
        isFetching: getState.isFetching,
        isError: getState.isError,
        isSuccess: getState.isSuccess,
        error: getState.error,
      }),
      'student.setLifecycle.useMutation': () => mutationResult({ mutate: vi.fn() }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// MemoryRouter path must include :id — render via a thin wrapper route.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: STUDENT_ID }),
    useLocation: () => ({
      pathname: `/admin/students/${STUDENT_ID}`,
      search: '',
      hash: '',
      state: {
        student: {
          id: STUDENT_ID,
          fullName: 'Stale List Name',
          lifecycle: 'active',
        },
      },
      key: 'test',
    }),
  };
});

const { default: StudentDetailPage } = await import('./student-detail.js');

describe('StudentDetailPage — query vs location.state', () => {
  beforeEach(() => {
    meState.roles = ['giam_doc_kinh_doanh'];
    getState.data = null;
    getState.isLoading = false;
    getState.isFetching = false;
    getState.isError = false;
    getState.isSuccess = true;
    getState.error = null;
  });

  it('shows EmptyState when get settles null even if list location.state has a row', () => {
    renderWithProviders(<StudentDetailPage />);
    expect(screen.getByText('Không tìm thấy học viên')).toBeTruthy();
    expect(screen.queryByText('Stale List Name')).toBeNull();
  });

  it('uses location.state as optimistic seed only while loading', () => {
    getState.isLoading = true;
    getState.isSuccess = false;
    getState.data = null;
    renderWithProviders(<StudentDetailPage />);
    // Name appears in breadcrumb + header + summary — assert title, not unique text.
    expect(screen.getByRole('heading', { name: 'Stale List Name' })).toBeTruthy();
    expect(screen.queryByText('Không tìm thấy học viên')).toBeNull();
  });

  it('prefers query data over location.state when both present', () => {
    getState.data = {
      id: STUDENT_ID,
      fullName: 'From Server',
      lifecycle: 'active',
      parentPhone: null,
    };
    renderWithProviders(<StudentDetailPage />);
    expect(screen.getByRole('heading', { name: 'From Server' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Stale List Name' })).toBeNull();
  });

  it('renders Console form chrome and still uses setLifecycle path when data loads', () => {
    getState.data = {
      id: STUDENT_ID,
      fullName: 'From Server',
      lifecycle: 'active',
      parentPhone: null,
    };
    renderWithProviders(<StudentDetailPage />);
    // Statusbar lifecycle + sheet (shipped page, not re-implementation)
    expect(screen.getAllByText('Đang học').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Thông tin học viên')).toBeTruthy();
    expect(screen.getAllByText('Đổi trạng thái').length).toBeGreaterThanOrEqual(1);
    // Permission gate still shows apply controls for GĐKD
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeTruthy();
  });

  it('hides grant form for sale on the Lớp học tab', async () => {
    meState.roles = ['sale'];
    getState.data = {
      id: STUDENT_ID,
      fullName: 'From Server',
      lifecycle: 'active',
      parentPhone: null,
    };
    renderWithProviders(<StudentDetailPage />);
    const tab = screen.getAllByText('Lớp học')[0]!;
    fireEvent.click(tab.closest('button') ?? tab);
    expect(await screen.findByText('Không có quyền cấp unit')).toBeTruthy();
    expect(screen.queryByText('Cấp / cắt range')).toBeNull();
  });
});

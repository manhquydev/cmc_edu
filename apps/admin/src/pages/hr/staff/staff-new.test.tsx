// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render-with-providers.js';
import StaffNewPage from './staff-new.js';

// D1/D7: the dedicated /new route is a full form; create-success navigates
// with `replace` to the returned profile URL so Back never returns to a
// submitted form.

let createResult: unknown;
let createMutateSpy: ReturnType<typeof vi.fn>;
let navigateSpy: ReturnType<typeof vi.fn>;
let sessionRoles: string[] = ['giam_doc_kinh_doanh'];

vi.mock('../../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.managerPickList.useQuery': () =>
        queryResult({ items: [{ id: 'mgr-1', fullName: 'Quản Lý', employeeCode: 'CMC0001' }] }),
      'user.create.useMutation': (options: unknown) => {
        // options = the component's useMutation({ onSuccess, onError }) — fold
        // it in so mutate() can drive the real onSuccess → navigate flow.
        const base = mutationResult((options as Record<string, unknown>) ?? {});
        const mutate = vi.fn((input: unknown) => {
          createMutateSpy?.(input);
          base.onSuccess?.(createResult);
        });
        return { ...base, mutate };
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

describe('StaffNewPage', () => {
  beforeEach(() => {
    navigateSpy = vi.fn();
    createMutateSpy = vi.fn();
    createResult = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    sessionRoles = ['giam_doc_kinh_doanh'];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function fillValidForm() {
    fireEvent.change(screen.getByLabelText(/^User ID/), { target: { value: 'u-new' } });
    fireEvent.change(screen.getByLabelText(/^Họ tên/), { target: { value: 'Người Mới' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'new@test.cmc' } });
    fireEvent.change(screen.getByLabelText(/^Vị trí/), { target: { value: 'sale' } });
  }

  it('submits the full create payload and navigates (replace) to the profile URL', async () => {
    renderWithProviders(<StaffNewPage />);
    fillValidForm();

    const createBtn = screen.getByRole('button', { name: 'Tạo' });
    expect(createBtn).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Vai trò' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sale' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Vai trò' }), { key: 'Escape' });
    expect(createBtn).not.toBeDisabled();

    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(createMutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-new', fullName: 'Người Mới', email: 'new@test.cmc', roles: ['sale'] }),
      );
    });
    expect(navigateSpy).toHaveBeenCalledWith(
      '/hr/staff/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/profile',
      { replace: true },
    );
  });

  it('renders a gated EmptyState when the user lacks user.manage', () => {
    sessionRoles = ['giao_vien'];
    renderWithProviders(<StaffNewPage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
  });
});

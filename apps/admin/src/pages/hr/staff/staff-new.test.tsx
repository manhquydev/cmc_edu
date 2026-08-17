// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@cmc/ui';
import StaffNewPage from './staff-new.js';
import { SessionProvider } from '../../../lib/session-context.js';

// D1/D7: the dedicated /new route is a full form; create-success navigates
// with `replace` to the returned profile URL so Back never returns to a
// submitted form. The success navigation runs on a REAL data router (not a
// mocked useNavigate) so the unsaved-edits leave blocker is exercised the
// way the e2e journeys hit it — a regression here previously surfaced only
// as ui-e2e failures on every createStaffViaAdminUi caller.

let createResult: unknown;
let createMutateSpy: ReturnType<typeof vi.fn>;
let sessionRoles: string[] = ['giam_doc_kinh_doanh'];

vi.mock('../../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'user.managerPickList.useQuery': () =>
        queryResult({ items: [{ id: 'mgr-1', fullName: 'Quản Lý', employeeCode: 'CMC0001' }] }),
      'user.create.useMutation': (options: unknown) => {
        // options = the component's useMutation({ onSuccess, onError }) — fold
        // it in so mutate() can drive the real onSuccess → redirect effect.
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

function renderNewFormRoute() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/hr/staff/new', element: <StaffNewPage /> },
      { path: '/hr/staff/:staffId/profile', element: <div>PROFILE_LANDED</div> },
    ],
    { initialEntries: ['/hr/staff/new'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('StaffNewPage', () => {
  beforeEach(() => {
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

  it('submits the full create payload and lands on the profile through the real router (blocker does not swallow the success redirect)', async () => {
    renderNewFormRoute();
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
    // The real navigation must reach the profile route — not be intercepted
    // by the leave-blocker's confirm dialog.
    expect(await screen.findByText('PROFILE_LANDED')).toBeInTheDocument();
    expect(screen.queryByText('Rời trang?')).not.toBeInTheDocument();
  });

  it('renders a gated EmptyState when the user lacks user.manage', () => {
    sessionRoles = ['giao_vien'];
    renderNewFormRoute();
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
  });
});

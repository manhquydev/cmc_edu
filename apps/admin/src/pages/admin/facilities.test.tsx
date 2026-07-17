// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks current facility.list behavior + the permission gate BEFORE the
// ListPage refactor (TDD per phase-02). Async factory so the dynamic import
// resolves after the vi.mock hoist (see mock-trpc.ts usage docs).
const facilityListState: {
  data: { items: unknown[] };
  error: { message: string } | null;
} = {
  data: { items: [{ id: 'f1', name: 'Cơ sở Cầu Giấy', code: 'CG', createdAt: '2026-01-01T00:00:00.000Z' }] },
  error: null,
};
let sessionRoles: string[] = ['super_admin'];
const createMutate = vi.fn();
const updateMutate = vi.fn();

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
      'facility.list.useQuery': () =>
        queryResult(facilityListState.data, {
          error: facilityListState.error,
          isError: facilityListState.error !== null,
        }),
      'facility.create.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { createMutate(...a); opts?.onSuccess?.(); } }),
      'facility.update.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { updateMutate(...a); opts?.onSuccess?.(); } }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import FacilitiesPage from './facilities.js';

describe('FacilitiesPage', () => {
  beforeEach(() => {
    sessionRoles = ['super_admin'];
    facilityListState.data = {
      items: [{ id: 'f1', name: 'Cơ sở Cầu Giấy', code: 'CG', createdAt: '2026-01-01T00:00:00.000Z' }],
    };
    facilityListState.error = null;
    createMutate.mockClear();
    updateMutate.mockClear();
  });

  it('creates a facility via facility.create.mutate with name + code', () => {
    renderWithProviders(<FacilitiesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm cơ sở' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Tên cơ sở/), { target: { value: 'Cơ sở Hà Đông' } });
    fireEvent.change(within(dialog).getByLabelText(/^Mã cơ sở/), { target: { value: 'HD' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo' }));
    expect(createMutate).toHaveBeenCalledWith({ name: 'Cơ sở Hà Đông', code: 'HD' });
  });

  it('edits a facility name via facility.update.mutate, without a code input', () => {
    renderWithProviders(<FacilitiesPage />);
    fireEvent.click(screen.getByText('Cơ sở Cầu Giấy'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText(/^Mã cơ sở/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Tên cơ sở/), { target: { value: 'Cơ sở Cầu Giấy 2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'f1', name: 'Cơ sở Cầu Giấy 2' });
  });

  it('renders facility rows bound to facility.list.useQuery', () => {
    renderWithProviders(<FacilitiesPage />);
    expect(screen.getByText('Cơ sở Cầu Giấy')).toBeInTheDocument();
    expect(screen.getByText('CG')).toBeInTheDocument();
  });

  it('renders empty state when facility.list returns no rows', () => {
    facilityListState.data = { items: [] };
    renderWithProviders(<FacilitiesPage />);
    expect(screen.getByText('Chưa có cơ sở nào')).toBeInTheDocument();
  });

  it('renders error banner when facility.list fails', () => {
    facilityListState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<FacilitiesPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });

  it('renders a gated premium EmptyState (no emoji) when the user lacks facility.list permission', () => {
    sessionRoles = ['sale'];
    const { container } = renderWithProviders(<FacilitiesPage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/🔒/u);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

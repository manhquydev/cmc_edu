// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Phase-03 super-admin-completion: real build replacing the premium
// coming-soon EmptyState (FacilityNetwork CRUD now exists — network-router.ts).
// Locks: facilityNetwork.list/create/update/delete.mutate wire contracts,
// the detectMyIp self-detect fill, and the page-level permission gate.
interface NetworkRow {
  id: string;
  cidr: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

const ROW_A: NetworkRow = {
  id: 'net-1',
  cidr: '10.0.0.0/24',
  label: 'Văn phòng chính',
  isActive: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const networkListState: { data: NetworkRow[] } = { data: [ROW_A] };
let sessionRoles: string[] = ['super_admin'];
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const detectRefetch = vi.fn().mockResolvedValue({
  data: { ip: '203.0.113.42', suggestedCidr32: '203.0.113.42/32', suggestedCidr24: '203.0.113.0/24' },
});

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
      'facilityNetwork.list.useQuery': () => queryResult(networkListState.data),
      'facilityNetwork.detectMyIp.useQuery': () => queryResult(undefined, { refetch: detectRefetch }),
      'facilityNetwork.create.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { createMutate(...a); opts?.onSuccess?.(); } }),
      'facilityNetwork.update.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { updateMutate(...a); opts?.onSuccess?.(); } }),
      'facilityNetwork.delete.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { deleteMutate(...a); opts?.onSuccess?.(); } }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import NetworkIpPage from './network-ip.js';

describe('NetworkIpPage', () => {
  beforeEach(() => {
    sessionRoles = ['super_admin'];
    networkListState.data = [ROW_A];
    createMutate.mockClear();
    updateMutate.mockClear();
    deleteMutate.mockClear();
    detectRefetch.mockClear();
  });

  it('renders network rows bound to facilityNetwork.list.useQuery', () => {
    renderWithProviders(<NetworkIpPage />);
    expect(screen.getByText('10.0.0.0/24')).toBeInTheDocument();
    expect(screen.getByText('Văn phòng chính')).toBeInTheDocument();
    expect(screen.getByText('Đang tắt')).toBeInTheDocument();
  });

  it('always shows the offsite-approval consequence banner', () => {
    renderWithProviders(<NetworkIpPage />);
    expect(screen.getByText(/cần nhập lý do/)).toBeInTheDocument();
  });

  it('shows manual-entry CIDR guidance', () => {
    renderWithProviders(<NetworkIpPage />);
    expect(screen.getByText(/nút tự dò không chính xác/)).toBeInTheDocument();
  });

  it('creates a network via facilityNetwork.create.mutate with cidr + label', () => {
    renderWithProviders(<NetworkIpPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dải mạng' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^CIDR/), { target: { value: '192.168.1.0/24' } });
    fireEvent.change(within(dialog).getByLabelText(/^Nhãn/), { target: { value: 'Chi nhánh 2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo' }));
    expect(createMutate).toHaveBeenCalledWith({ cidr: '192.168.1.0/24', label: 'Chi nhánh 2' });
  });

  it('fills the CIDR field from detectMyIp when "Lấy IP hiện tại của tôi" is clicked', async () => {
    renderWithProviders(<NetworkIpPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dải mạng' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lấy IP hiện tại của tôi' }));
    expect(detectRefetch).toHaveBeenCalled();
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/^CIDR/)).toHaveValue('203.0.113.42/32');
    });
  });

  it('toggles isActive via facilityNetwork.update.mutate({ id, isActive })', () => {
    renderWithProviders(<NetworkIpPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Bật' }));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'net-1', isActive: true });
  });

  it('edits cidr/label via facilityNetwork.update.mutate({ id, cidr, label })', () => {
    renderWithProviders(<NetworkIpPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Nhãn/), { target: { value: 'Đổi tên' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'net-1', cidr: '10.0.0.0/24', label: 'Đổi tên' });
  });

  it('deletes a network via facilityNetwork.delete.mutate({ id })', () => {
    renderWithProviders(<NetworkIpPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    expect(deleteMutate).toHaveBeenCalledWith({ id: 'net-1' });
  });

  it('renders a gated EmptyState when the session lacks facilityNetwork.manage', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<NetworkIpPage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(screen.queryByText('10.0.0.0/24')).not.toBeInTheDocument();
  });
});

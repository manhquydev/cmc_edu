// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks "Bậc lương & gán bậc" (HR remediation phase 5, R3-10): SalaryTier CRUD
// (`salaryTier.list/create/update`) + assign tier (`compensation.assignTier`,
// staff filtered to sale/giao_vien only — GĐ have no payslip, validate s4).
// vi.hoisted: these are referenced synchronously inside the vi.mock factory
// below, which vitest hoists above regular top-level statements.
const { TIER, STAFF_SALE, STAFF_GV, STAFF_GD } = vi.hoisted(() => ({
  TIER: {
    id: 'tier-1',
    name: 'Bậc 1',
    type: 'KINH_DOANH',
    baseSalary: 8_000_000,
    unitRate: 200_000,
    requiredShifts: 24,
    requiredMetric: 100_000_000,
  },
  STAFF_SALE: { id: 'u-1', fullName: 'Nguyễn Văn A', employeeCode: 'NV001', roles: ['sale'] },
  STAFF_GV: { id: 'u-2', fullName: 'Trần Thị B', employeeCode: 'NV002', roles: ['giao_vien'] },
  STAFF_GD: { id: 'u-3', fullName: 'Lê Văn C', employeeCode: 'NV003', roles: ['giam_doc_dao_tao'] },
}));

const createMutate = vi.fn();
const updateMutate = vi.fn();
const assignMutate = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_kinh_doanh'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'salaryTier.list.useQuery': queryResult([TIER]),
      'salaryTier.create.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { createMutate(...a); opts?.onSuccess?.(); } }),
      'salaryTier.update.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { updateMutate(...a); opts?.onSuccess?.(); } }),
      'user.pickList.useQuery': queryResult({ items: [STAFF_SALE, STAFF_GV, STAFF_GD] }),
      'compensation.assignTier.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { assignMutate(...a); opts?.onSuccess?.(); } }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import SalaryTiersPage from './salary-tiers.js';

describe('SalaryTiersPage', () => {
  beforeEach(() => {
    createMutate.mockClear();
    updateMutate.mockClear();
    assignMutate.mockClear();
  });

  it('renders the tier list by default', () => {
    renderWithProviders(<SalaryTiersPage />);
    expect(screen.getByText('Bậc 1')).toBeInTheDocument();
  });

  it('opens the create form and submits salaryTier.create.mutate', () => {
    renderWithProviders(<SalaryTiersPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm bậc lương' }));
    fireEvent.change(screen.getByLabelText('Tên bậc'), { target: { value: 'Bậc 2' } });
    fireEvent.change(screen.getByLabelText('Lương cơ bản (VND)'), { target: { value: '9000000' } });
    fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '250000' } });
    fireEvent.change(screen.getByLabelText('Công ca yêu cầu'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Chỉ số yêu cầu (giờ dạy / doanh thu)'), {
      target: { value: '120000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }));
    expect(createMutate).toHaveBeenCalledWith({
      name: 'Bậc 2',
      type: 'KINH_DOANH',
      baseSalary: 9_000_000,
      unitRate: 250_000,
      requiredShifts: 24,
      requiredMetric: 120_000_000,
    });
  });

  it('opens the edit form pre-filled and submits salaryTier.update.mutate', () => {
    renderWithProviders(<SalaryTiersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    expect(screen.getByLabelText('Tên bậc')).toHaveValue('Bậc 1');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tier-1' }));
  });

  it('switches to the Gán bậc tab and filters staff to sale/giao_vien only', () => {
    renderWithProviders(<SalaryTiersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gán bậc' }));
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.queryByText('Lê Văn C')).toBeNull();
  });

  it('assigns a tier via compensation.assignTier.mutate({appUserId, tierId})', async () => {
    renderWithProviders(<SalaryTiersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gán bậc' }));
    const row = screen.getByText('Nguyễn Văn A').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Gán bậc' }));
    fireEvent.click(within(row).getByRole('combobox', { name: 'Bậc lương' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Bậc 1' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Lưu' }));
    expect(assignMutate).toHaveBeenCalledWith({ appUserId: 'u-1', tierId: 'tier-1' });
  });
});

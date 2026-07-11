// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// HR remediation phase 5 (R3-10): real build replacing the premium-plan
// coming-soon EmptyState. Locks `shift.listGroups` (read) + `shift.createGroup`/
// `shift.createTemplate` (write) + `compensationPolicy.get`/`upsert` (write) —
// all procedures already existed pre-phase-5 (shift/router.ts, payroll/router.ts).
const { GROUP } = vi.hoisted(() => ({
  GROUP: {
    id: 'group-1',
    name: 'Sale ca ngày',
    type: 'KINH_DOANH',
    selectionMode: 'SINGLE',
    templates: [{ id: 'tpl-1', name: 'Ca 1', startTime: '08:30', endTime: '18:00' }],
  },
}));

const createGroupMutate = vi.fn();
const createTemplateMutate = vi.fn();
const policyUpsertMutate = vi.fn();
let policyData: Record<string, unknown> | null = {
  penaltyRatePerLateMinute: 500,
  penaltyRatePerEarlyMinute: 1000,
};

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['super_admin'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'shift.listGroups.useQuery': queryResult([GROUP]),
      'shift.createGroup.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { createGroupMutate(...a); opts?.onSuccess?.(); } }),
      'shift.createTemplate.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { createTemplateMutate(...a); opts?.onSuccess?.(); } }),
      'compensationPolicy.get.useQuery': () => queryResult(policyData),
      'compensationPolicy.upsert.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { policyUpsertMutate(...a); opts?.onSuccess?.(); } }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ShiftConfigPage from './shift-config.js';

describe('ShiftConfigPage', () => {
  beforeEach(() => {
    createGroupMutate.mockClear();
    createTemplateMutate.mockClear();
    policyUpsertMutate.mockClear();
    policyData = { penaltyRatePerLateMinute: 500, penaltyRatePerEarlyMinute: 1000 };
  });

  it('renders existing shift groups with their templates', () => {
    renderWithProviders(<ShiftConfigPage />);
    expect(screen.getByText('Sale ca ngày')).toBeInTheDocument();
    expect(screen.getByText('Ca 1')).toBeInTheDocument();
  });

  it('creates a new shift group via shift.createGroup.mutate', () => {
    renderWithProviders(<ShiftConfigPage />);
    fireEvent.change(screen.getByLabelText('Tên nhóm ca'), { target: { value: 'GV ca sáng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhóm ca' }));
    expect(createGroupMutate).toHaveBeenCalledWith({
      name: 'GV ca sáng',
      type: 'KINH_DOANH',
      selectionMode: 'SINGLE',
    });
  });

  it('creates a new shift template under a group via shift.createTemplate.mutate', () => {
    renderWithProviders(<ShiftConfigPage />);
    const groupCard = screen.getByText('Sale ca ngày').closest('div[class*="astryx-stack"]')!.parentElement!;
    fireEvent.change(within(groupCard).getByLabelText('Tên mẫu ca'), { target: { value: 'Ca 2' } });
    fireEvent.change(within(groupCard).getByLabelText('Bắt đầu (HH:mm)'), { target: { value: '10:00' } });
    fireEvent.change(within(groupCard).getByLabelText('Kết thúc (HH:mm)'), { target: { value: '20:00' } });
    fireEvent.click(within(groupCard).getByRole('button', { name: '+ Thêm mẫu ca' }));
    expect(createTemplateMutate).toHaveBeenCalledWith({
      shiftGroupId: 'group-1',
      name: 'Ca 2',
      startTime: '10:00',
      endTime: '20:00',
    });
  });

  it('switches to the Chính sách phạt tab and pre-fills existing policy rates', () => {
    renderWithProviders(<ShiftConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chính sách phạt' }));
    expect(screen.getByLabelText('Phạt mỗi phút đi muộn (VND)')).toHaveValue(500);
    expect(screen.getByLabelText('Phạt mỗi phút về sớm (VND)')).toHaveValue(1000);
  });

  it('saves the policy via compensationPolicy.upsert.mutate', () => {
    renderWithProviders(<ShiftConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chính sách phạt' }));
    fireEvent.change(screen.getByLabelText('Phạt mỗi phút đi muộn (VND)'), { target: { value: '600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chính sách' }));
    expect(policyUpsertMutate).toHaveBeenCalledWith({
      penaltyRatePerLateMinute: 600,
      penaltyRatePerEarlyMinute: 1000,
    });
  });

  it('shows a fallback-rate info banner when no policy is configured yet', () => {
    policyData = null;
    renderWithProviders(<ShiftConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chính sách phạt' }));
    expect(screen.getByText('Chưa cấu hình chính sách phạt')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks "Của tôi" (HR remediation phase 5, red-team #22 — gộp my-kpi +
// my-payslip thành 1 trang 2 tab): `kpi.myScore.useQuery({period})`,
// `kpi.refresh.mutate({period})`, `kpi.submitSlip.mutate({period})`,
// `payslip.my.useQuery({period})`. GĐ/super_admin roles (no sale/giao_vien)
// see an EmptyState on both tabs instead of the real query (validate s4 —
// lương GĐ ngoài hệ thống).
let sessionRoles: string[] = ['sale'];

const myScoreSpy = vi.fn();
let myScoreData: Record<string, unknown> | null = {
  id: 'kpi-1',
  status: 'draft',
  value: 1_500_000,
  shiftActual: 20,
  shiftRequired: 24,
  metricValue: 80_000_000,
  quotaSnapshot: 100_000_000,
  tierMissing: false,
  override: false,
  overrideReason: null,
};

const refreshMutate = vi.fn();
const submitSlipMutate = vi.fn();

const myPayslipSpy = vi.fn();
let myPayslipData: Record<string, unknown> | null = null;

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
      'kpi.myScore.useQuery': (input: unknown) => {
        myScoreSpy(input);
        return queryResult(myScoreData);
      },
      'kpi.refresh.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...args: unknown[]) => { refreshMutate(...args); opts?.onSuccess?.(); } }),
      'kpi.submitSlip.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...args: unknown[]) => { submitSlipMutate(...args); opts?.onSuccess?.(); } }),
      'payslip.my.useQuery': (input: unknown) => {
        myPayslipSpy(input);
        return queryResult(myPayslipData);
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import MyHrPage from './my-hr.js';

describe('MyHrPage', () => {
  beforeEach(() => {
    sessionRoles = ['sale'];
    myScoreData = {
      id: 'kpi-1',
      status: 'draft',
      value: 1_500_000,
      shiftActual: 20,
      shiftRequired: 24,
      metricValue: 80_000_000,
      quotaSnapshot: 100_000_000,
      tierMissing: false,
      override: false,
      overrideReason: null,
    };
    myPayslipData = null;
    myScoreSpy.mockClear();
    myPayslipSpy.mockClear();
    refreshMutate.mockClear();
    submitSlipMutate.mockClear();
  });

  it('renders the KPI tab by default with kpi.myScore data', () => {
    renderWithProviders(<MyHrPage />);
    expect(myScoreSpy).toHaveBeenCalled();
    expect(screen.getByText('Phần KPI (%côngca × %chỉ-số × đơn giá)')).toBeInTheDocument();
    expect(screen.getByText('1.500.000 đ')).toBeInTheDocument();
  });

  it('calls kpi.refresh.mutate({period}) when "Tính lại" is clicked', () => {
    renderWithProviders(<MyHrPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tính lại' }));
    expect(refreshMutate).toHaveBeenCalledWith({ period: expect.stringMatching(/^\d{4}-\d{2}$/) as unknown as string });
  });

  it('disables "Nộp" before the submit window opens (day 3 of next ICT month)', () => {
    renderWithProviders(<MyHrPage />);
    // defaultPeriodICT() is the CURRENT month — its submit window (day 3 of
    // the FOLLOWING month) has not opened yet "now".
    expect(screen.getByRole('button', { name: 'Nộp' })).toBeDisabled();
  });

  it('shows a banner explaining why "Nộp" is disabled before the window opens', () => {
    renderWithProviders(<MyHrPage />);
    expect(screen.getByText(/Chỉ có thể nộp phiếu KPI kỳ/)).toBeInTheDocument();
  });

  it('shows a tierMissing warning banner', () => {
    myScoreData = { ...myScoreData, tierMissing: true };
    renderWithProviders(<MyHrPage />);
    expect(screen.getByText('Chưa gán bậc lương')).toBeInTheDocument();
  });

  it('shows an info banner when no KPI slip exists yet', () => {
    myScoreData = null;
    renderWithProviders(<MyHrPage />);
    expect(screen.getByText('Chưa có phiếu KPI')).toBeInTheDocument();
  });

  it('switches to the Lương tab and reads payslip.my', () => {
    renderWithProviders(<MyHrPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Lương' }));
    expect(myPayslipSpy).toHaveBeenCalled();
    expect(screen.getByText('Chưa có bảng lương')).toBeInTheDocument();
  });

  it('renders the payslip breakdown with the relabeled KPI row', () => {
    myPayslipData = {
      id: 'ps-1',
      status: 'draft',
      baseSalary: 10_000_000,
      kpiBonus: 1_500_000,
      penaltyAmount: 0,
      totalNet: 11_500_000,
    };
    renderWithProviders(<MyHrPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Lương' }));
    expect(screen.getByText('Phần KPI (%côngca × %chỉ-số × đơn giá)')).toBeInTheDocument();
    expect(screen.getByText('11.500.000 đ')).toBeInTheDocument();
  });

  it('shows an EmptyState on the KPI tab for a director role (no sale/giao_vien)', () => {
    sessionRoles = ['giam_doc_dao_tao'];
    renderWithProviders(<MyHrPage />);
    expect(screen.getByText('Không áp dụng cho vai trò Giám đốc')).toBeInTheDocument();
    expect(myScoreSpy).not.toHaveBeenCalled();
  });

  it('shows an EmptyState on the Lương tab for a director role', () => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    renderWithProviders(<MyHrPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Lương' }));
    expect(screen.getByText('Không áp dụng cho vai trò Giám đốc')).toBeInTheDocument();
    expect(myPayslipSpy).not.toHaveBeenCalled();
  });

  it('shows an EmptyState for super_admin (no sale/giao_vien role)', () => {
    sessionRoles = ['super_admin'];
    renderWithProviders(<MyHrPage />);
    expect(screen.getByText('Không áp dụng cho vai trò Giám đốc')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the user-pick (`user.list.useQuery`) binding + `payslip.getForUser.useQuery`
// binding + `payslip.assemble/finalize/reopen.mutate` payloads BEFORE the
// DetailPage refactor (TDD per phase-06). finalize/reopen are money-state
// transitions (QĐ0025) — payloads MUST stay byte-identical and MUST keep
// firing directly on click (the current screen has no ConfirmDialog gating
// on these mutations; the refactor is presentation-only and must not add
// one). The penalty row MUST stay a visually distinct, separate deduction
// line item (QĐ0025) — never merged into base/KPI rows.
//
// HR remediation phase 5 (R3-2, R2 #M1): tier-based salary model REWRITE —
// "Lương biến đổi" row REMOVED (variablePay is a deprecated column, always 0
// under the tier model); "Thưởng KPI" RELABELED to "Phần KPI (%côngca ×
// %chỉ-số × đơn giá)" (kpiBonus column reused, value unchanged).
const STAFF = {
  id: 'u-1',
  fullName: 'Nguyễn Văn A',
  employeeCode: 'NV001',
  position: 'Giáo viên',
};

let sessionRoles: string[] = ['giam_doc_dao_tao'];

const userListSpy = vi.fn();
const getForUserSpy = vi.fn();
const getForUserRefetch = vi.fn();

let payslipData: Record<string, unknown> | undefined = {
  id: 'ps-1',
  status: 'draft',
  baseSalary: 10_000_000,
  variablePay: 0,
  kpiBonus: 500_000,
  penaltyAmount: 100_000,
  lateMinutes: 15,
  earlyMinutes: 0,
  unpunchedDays: 0,
  totalNet: 10_400_000,
  flaggedPunches: 1,
};
let payslipError: { message: string } | null = null;

const assembleMutate = vi.fn();
let assembleOnSuccess: (() => void) | undefined;

const finalizeMutate = vi.fn();
let finalizeOnSuccess: (() => void) | undefined;

const reopenMutate = vi.fn();
let reopenOnSuccess: (() => void) | undefined;

const mutationErr: { assemble: { message: string } | null; finalize: { message: string } | null; reopen: { message: string } | null } = {
  assemble: null,
  finalize: null,
  reopen: null,
};

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
      'user.list.useQuery': (input: unknown) => {
        userListSpy(input);
        return queryResult({ items: [STAFF] });
      },
      'payslip.getForUser.useQuery': (input: unknown, opts: unknown) => {
        getForUserSpy(input, opts);
        return queryResult(payslipData, {
          error: payslipError,
          isError: payslipError !== null,
          refetch: getForUserRefetch,
        });
      },
      'payslip.assemble.useMutation': (options: { onSuccess?: () => void }) => {
        assembleOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: assembleMutate,
          error: mutationErr.assemble,
          isError: mutationErr.assemble !== null,
        });
      },
      'payslip.finalize.useMutation': (options: { onSuccess?: () => void }) => {
        finalizeOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: finalizeMutate,
          error: mutationErr.finalize,
          isError: mutationErr.finalize !== null,
        });
      },
      'payslip.reopen.useMutation': (options: { onSuccess?: () => void }) => {
        reopenOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: reopenMutate,
          error: mutationErr.reopen,
          isError: mutationErr.reopen !== null,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import PayrollPage from './payroll.js';

function selectStaff() {
  fireEvent.click(screen.getByText('NV001'));
}

describe('PayrollPage', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_dao_tao'];
    payslipData = {
      id: 'ps-1',
      status: 'draft',
      baseSalary: 10_000_000,
      variablePay: 0,
      kpiBonus: 500_000,
      penaltyAmount: 100_000,
      lateMinutes: 15,
      earlyMinutes: 0,
      unpunchedDays: 0,
      totalNet: 10_400_000,
      flaggedPunches: 1,
    };
    payslipError = null;
    mutationErr.assemble = null;
    mutationErr.finalize = null;
    mutationErr.reopen = null;
    userListSpy.mockClear();
    getForUserSpy.mockClear();
    getForUserRefetch.mockClear();
    assembleMutate.mockClear();
    finalizeMutate.mockClear();
    reopenMutate.mockClear();
  });

  it('renders the staff list from user.list.useQuery', () => {
    renderWithProviders(<PayrollPage />);
    expect(userListSpy).toHaveBeenCalled();
    expect(screen.getByText('NV001')).toBeInTheDocument();
  });

  it('does not query payslip.getForUser before a staff row is selected', () => {
    renderWithProviders(<PayrollPage />);
    expect(getForUserSpy).not.toHaveBeenCalled();
  });

  it('queries payslip.getForUser({appUserId, period}) with the current period after selecting a staff row', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(getForUserSpy).toHaveBeenCalledTimes(1);
    const [input] = getForUserSpy.mock.calls[0] as [{ appUserId: string; period: string }];
    expect(input.appUserId).toBe('u-1');
    expect(input.period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('renders an always-visible warning banner when payslip.getForUser errors', () => {
    payslipData = undefined;
    payslipError = { message: 'not found' };
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByText('Chưa có bảng lương')).toBeInTheDocument();
  });

  it('shows the assemble button when canDo(payslip,assemble)', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByRole('button', { name: 'Tính lương (assemble)' })).toBeInTheDocument();
  });

  it('hides the action bar for a role without payslip.assemble permission', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.queryByRole('button', { name: 'Tính lương (assemble)' })).toBeNull();
  });

  it('calls payslip.assemble.mutate({appUserId, period}) with a byte-identical payload directly on click', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Tính lương (assemble)' }));
    expect(assembleMutate).toHaveBeenCalledTimes(1);
    const [payload] = assembleMutate.mock.calls[0] as [{ appUserId: string; period: string }];
    expect(payload.appUserId).toBe('u-1');
    expect(payload.period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('refetches payslip.getForUser after a successful assemble', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Tính lương (assemble)' }));
    expect(assembleOnSuccess).toBeDefined();
    assembleOnSuccess?.();
    expect(getForUserRefetch).toHaveBeenCalled();
  });

  it('shows the finalize button for draft status when canDo(payslip,finalize)', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByRole('button', { name: 'Chốt bảng lương' })).toBeInTheDocument();
  });

  it('hides the finalize button when status is not draft', () => {
    payslipData = { ...payslipData, status: 'finalized' };
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.queryByRole('button', { name: 'Chốt bảng lương' })).toBeNull();
  });

  it('calls payslip.finalize.mutate({payslipId}) with a byte-identical payload directly on click', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Chốt bảng lương' }));
    expect(finalizeMutate).toHaveBeenCalledWith({ payslipId: 'ps-1' });
  });

  it('refetches payslip.getForUser after a successful finalize', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Chốt bảng lương' }));
    expect(finalizeOnSuccess).toBeDefined();
    finalizeOnSuccess?.();
    expect(getForUserRefetch).toHaveBeenCalled();
  });

  it('shows the reopen button for finalized status when canDo(payslip,reopen)', () => {
    payslipData = { ...payslipData, status: 'finalized' };
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByRole('button', { name: 'Mở lại (reopen)' })).toBeInTheDocument();
  });

  it('hides the reopen button when status is not finalized', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.queryByRole('button', { name: 'Mở lại (reopen)' })).toBeNull();
  });

  it('calls payslip.reopen.mutate({payslipId}) with a byte-identical payload directly on click', () => {
    payslipData = { ...payslipData, status: 'finalized' };
    renderWithProviders(<PayrollPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại (reopen)' }));
    expect(reopenMutate).toHaveBeenCalledWith({ payslipId: 'ps-1' });
  });

  it('refetches payslip.getForUser after a successful reopen', () => {
    payslipData = { ...payslipData, status: 'finalized' };
    renderWithProviders(<PayrollPage />);
    selectStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại (reopen)' }));
    expect(reopenOnSuccess).toBeDefined();
    reopenOnSuccess?.();
    expect(getForUserRefetch).toHaveBeenCalled();
  });

  it('renders an always-visible error banner when a mutation fails', () => {
    mutationErr.finalize = { message: 'Không thể chốt lương' };
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByText('Không thể chốt lương')).toBeInTheDocument();
  });

  it('renders the penalty row as a distinct deduction line item (QĐ0025)', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByText('Phạt khấu trừ')).toBeInTheDocument();
    expect(screen.getByText('− 100.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Đi muộn 15 phút')).toBeInTheDocument();
  });

  it('renders the income line items (relabeled KPI row, no "Lương biến đổi") and the net total', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.getByText('10.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Phần KPI (%côngca × %chỉ-số × đơn giá)')).toBeInTheDocument();
    expect(screen.getByText('500.000 đ')).toBeInTheDocument();
    expect(screen.getByText('10.400.000 đ')).toBeInTheDocument();
    expect(screen.queryByText('Lương biến đổi')).toBeNull();
  });

  it('navigates back to the staff list via the back button', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    expect(screen.queryByText('NV001')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Danh sách nhân viên/ }));
    expect(screen.getByText('NV001')).toBeInTheDocument();
  });

  it('renders the back-button chevron as a monochrome LineIcon (not a text arrow)', () => {
    renderWithProviders(<PayrollPage />);
    selectStaff();
    const backButton = screen.getByRole('button', { name: /Danh sách nhân viên/ });
    expect(backButton.querySelector('svg[data-icon="chevron"]')).toBeTruthy();
    expect(backButton.textContent).not.toMatch(/[←→]/);
  });
});

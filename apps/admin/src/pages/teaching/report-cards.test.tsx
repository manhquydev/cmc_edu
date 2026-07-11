// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks `student.lookup.useQuery` binding + `assessment.draftComment`/
// `assessment.confirm` mutate payloads BYTE-IDENTICAL BEFORE the FormPage
// refactor (TDD per phase-07 batch B). The refactor only relocates the
// forward-step buttons into the FormPage bottom action bar; the search →
// select → draft → confirm wizard logic, validation and mutate args stay
// unchanged. Result/error feedback renders via plain `Banner` with
// `description` (always visible) — NOT `ResultPanel`.
const STUDENT_A = { id: 'stu-1', fullName: 'Nguyễn Văn A', lifecycle: 'active' };

const lookupSpy = vi.fn();
const draftMutate = vi.fn();
const confirmMutate = vi.fn();
let draftOnSuccess: ((data: { id: string; content: string }) => void) | undefined;
let confirmOnSuccess: (() => void) | undefined;
const draftState: { error: { message: string } | null } = { error: null };
const confirmState: { error: { message: string } | null } = { error: null };

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giao_vien'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'student.lookup.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        lookupSpy(input, opts?.enabled);
        if (!opts?.enabled) return queryResult(undefined);
        return queryResult([STUDENT_A]);
      },
      'assessment.draftComment.useMutation': (options: {
        onSuccess?: (data: { id: string; content: string }) => void;
      }) => {
        draftOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: draftMutate,
          error: draftState.error,
          isError: draftState.error !== null,
        });
      },
      'assessment.confirm.useMutation': (options: { onSuccess?: () => void }) => {
        confirmOnSuccess = options?.onSuccess;
        return mutationResult({
          mutate: confirmMutate,
          error: confirmState.error,
          isError: confirmState.error !== null,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ReportCardsPage from './report-cards.js';

function search(q: string) {
  fireEvent.change(screen.getByPlaceholderText('Nhập tên hoặc SĐT phụ huynh…'), { target: { value: q } });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm' }));
}

function selectStudentAndEnterPeriod(period: string) {
  search('Nguyễn Văn A');
  fireEvent.click(screen.getByText('Nguyễn Văn A'));
  fireEvent.change(screen.getByPlaceholderText('2026-07'), { target: { value: period } });
}

describe('ReportCardsPage', () => {
  beforeEach(() => {
    lookupSpy.mockClear();
    draftMutate.mockClear();
    confirmMutate.mockClear();
    draftState.error = null;
    confirmState.error = null;
  });

  it('does not query student.lookup before a 2+ char search is submitted', () => {
    renderWithProviders(<ReportCardsPage />);
    expect(lookupSpy).toHaveBeenCalledWith({ name: '' }, false);
  });

  it('queries student.lookup with {name} when the search term does not start with a digit', () => {
    renderWithProviders(<ReportCardsPage />);
    search('Nguyễn Văn A');
    expect(lookupSpy).toHaveBeenCalledWith({ name: 'Nguyễn Văn A' }, true);
  });

  it('queries student.lookup with {phone} when the search term starts with a digit', () => {
    renderWithProviders(<ReportCardsPage />);
    search('0912345678');
    expect(lookupSpy).toHaveBeenCalledWith({ phone: '0912345678' }, true);
  });

  it('renders search results and selects a student on row click', () => {
    renderWithProviders(<ReportCardsPage />);
    search('Nguyễn Văn A');
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    expect(screen.getByText('Bước 2 — Chọn kỳ và tạo nháp AI')).toBeInTheDocument();
  });

  it('shows "Tạo nháp AI" as the action-bar button once a student is selected, disabled until period is valid', () => {
    renderWithProviders(<ReportCardsPage />);
    search('Nguyễn Văn A');
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    expect(screen.getByRole('button', { name: 'Tạo nháp AI' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('2026-07'), { target: { value: '2026-07' } });
    expect(screen.getByRole('button', { name: 'Tạo nháp AI' })).not.toBeDisabled();
  });

  it('calls assessment.draftComment.mutate with a byte-identical {studentId, period} payload', () => {
    renderWithProviders(<ReportCardsPage />);
    selectStudentAndEnterPeriod('2026-07');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nháp AI' }));
    expect(draftMutate).toHaveBeenCalledWith({ studentId: 'stu-1', period: '2026-07' });
  });

  it('pre-fills the editable textarea with AI draft content on draftComment success', () => {
    renderWithProviders(<ReportCardsPage />);
    selectStudentAndEnterPeriod('2026-07');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nháp AI' }));
    expect(draftOnSuccess).toBeDefined();
    act(() => draftOnSuccess?.({ id: 'draft-1', content: 'Học viên tiến bộ tốt.' }));
    expect(screen.getByText('Nháp AI — chưa phát hành')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Học viên tiến bộ tốt.')).toHaveLength(2);
  });

  it('calls assessment.confirm.mutate with a byte-identical {assessmentId, content} payload (trimmed)', () => {
    renderWithProviders(<ReportCardsPage />);
    selectStudentAndEnterPeriod('2026-07');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nháp AI' }));
    act(() => draftOnSuccess?.({ id: 'draft-1', content: 'Học viên tiến bộ tốt.' }));

    const editArea = screen.getByLabelText('Nội dung sau chỉnh sửa');
    fireEvent.change(editArea, { target: { value: '  Đã chỉnh sửa nội dung.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận & Phát hành' }));

    expect(confirmMutate).toHaveBeenCalledWith({ assessmentId: 'draft-1', content: 'Đã chỉnh sửa nội dung.' });
  });

  it('renders an always-visible success banner (description shown) after confirm succeeds', () => {
    renderWithProviders(<ReportCardsPage />);
    selectStudentAndEnterPeriod('2026-07');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nháp AI' }));
    act(() => draftOnSuccess?.({ id: 'draft-1', content: 'Nội dung.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận & Phát hành' }));
    expect(confirmOnSuccess).toBeDefined();
    act(() => confirmOnSuccess?.());
    expect(screen.getByText('Đã phát hành')).toBeInTheDocument();
    expect(
      screen.getByText('Nhận xét đã được xác nhận. Phụ huynh có thể xem trong ứng dụng.'),
    ).toBeInTheDocument();
  });

  it('renders an always-visible error banner (description shown) when draftComment fails', () => {
    draftState.error = { message: 'AI service unavailable' };
    renderWithProviders(<ReportCardsPage />);
    expect(lookupSpy).toBeDefined();
    search('Nguyễn Văn A');
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    expect(screen.getByText('Lỗi tạo nháp AI')).toBeInTheDocument();
    expect(screen.getByText('AI service unavailable')).toBeInTheDocument();
  });

  it('cancels the draft via "Hủy nháp" without calling confirm', () => {
    renderWithProviders(<ReportCardsPage />);
    selectStudentAndEnterPeriod('2026-07');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nháp AI' }));
    act(() => draftOnSuccess?.({ id: 'draft-1', content: 'Nội dung.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy nháp' }));
    expect(screen.queryByText('Nháp AI — chưa phát hành')).toBeNull();
    expect(confirmMutate).not.toHaveBeenCalled();
  });
});

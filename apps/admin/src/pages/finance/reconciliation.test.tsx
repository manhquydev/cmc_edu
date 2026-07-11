// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the reconciliation flag list BEFORE the ListPage/Panel refactor
// (TDD per phase-04). Security-sensitive: dismiss/action `mutate` payloads
// (`{flagId}`) and the HOTL-review permission gate must stay byte-identical —
// the refactor only changes presentation.
interface FlagItem {
  id: string;
  kind: string;
  receiptId: string | null;
  createdAt: string;
  status: string;
}

const FLAG_A: FlagItem = {
  id: 'flag-1',
  kind: 'self_approved',
  receiptId: 'receipt-aaaaaaaa',
  createdAt: '2026-07-01T00:00:00.000Z',
  status: 'open',
};

const flagsState: { data: FlagItem[]; error: { message: string } | null } = {
  data: [FLAG_A],
  error: null,
};
let sessionRoles: string[] = ['giam_doc_dao_tao'];
const listQuerySpy = vi.fn();
const dismissMutate = vi.fn();
const actionMutate = vi.fn();

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
      'reconciliation.listFlags.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(flagsState.data, {
          error: flagsState.error,
          isError: flagsState.error !== null,
        });
      },
      'reconciliation.dismiss.useMutation': () => mutationResult({ mutate: dismissMutate }),
      'reconciliation.action.useMutation': () => mutationResult({ mutate: actionMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import ReconciliationPage from './reconciliation.js';

describe('ReconciliationPage', () => {
  beforeEach(() => {
    sessionRoles = ['giam_doc_dao_tao'];
    flagsState.data = [FLAG_A];
    flagsState.error = null;
    listQuerySpy.mockClear();
    dismissMutate.mockClear();
    actionMutate.mockClear();
  });

  it('queries reconciliation.listFlags with an empty input when no kind filter is set', () => {
    renderWithProviders(<ReconciliationPage />);
    expect(listQuerySpy).toHaveBeenCalledWith({});
  });

  it('passes the kind filter from the URL to reconciliation.listFlags.useQuery', () => {
    renderWithProviders(<ReconciliationPage />, { route: '/ops/recon?kind=exceeds_threshold' });
    expect(listQuerySpy).toHaveBeenCalledWith({ kind: 'exceeds_threshold' });
  });

  it('renders flag rows bound to reconciliation.listFlags.useQuery', () => {
    renderWithProviders(<ReconciliationPage />);
    // "Tự duyệt phiếu thu" also appears as a kind-filter Selector option
    // label — assert on the flag description text instead, which is unique
    // to the rendered FlagCard.
    expect(
      screen.getByText('Agent phát hiện phiếu thu được duyệt bởi chính người tạo (vi phạm kiểm soát nội bộ).'),
    ).toBeInTheDocument();
  });

  it('renders the HOTL read-only banner', () => {
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText('Kết quả phân tích tự động từ AI agent — chỉ đọc')).toBeInTheDocument();
  });

  it('dismiss action calls reconciliation.dismiss.mutate({flagId}) after confirm and invalidates listFlags', () => {
    const invalidateSpy = trpc.useUtils().reconciliation.listFlags.invalidate;
    renderWithProviders(<ReconciliationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }));

    expect(dismissMutate).toHaveBeenCalledWith(
      { flagId: 'flag-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );

    expect(invalidateSpy).not.toHaveBeenCalled();
    const call = dismissMutate.mock.calls[0];
    act(() => (call[1] as { onSuccess: () => void }).onSuccess());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('action (mark handled) calls reconciliation.action.mutate({flagId}) after confirm', () => {
    renderWithProviders(<ReconciliationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Đã xử lý' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đã xử lý' }));

    expect(actionMutate).toHaveBeenCalledWith(
      { flagId: 'flag-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('hides dismiss/action buttons for a role without reconciliation.review', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<ReconciliationPage />);
    expect(screen.queryByRole('button', { name: 'Bỏ qua' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đã xử lý' })).toBeNull();
    expect(screen.getByText('Chỉ đọc — liên hệ GĐ để xử lý cảnh báo.')).toBeInTheDocument();
  });

  it('renders an empty-state banner when there are no open flags', () => {
    flagsState.data = [];
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText(/Không có cảnh báo nào đang mở/)).toBeInTheDocument();
  });

  it('renders an error banner when reconciliation.listFlags fails', () => {
    flagsState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});

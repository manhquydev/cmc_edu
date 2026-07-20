// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// `window.matchMedia` is polyfilled centrally in `apps/admin/test-setup.ts`
// (Astryx Spinner needs it under jsdom).

// Locks the CRM pipeline dashboard (phase-03, Kanban→premium dashboard
// upgrade). Backend (`crm.opportunityList` + `crm.opportunityAdvance`)
// already exists (apps/api/src/crm/router.ts) — this test drives the UI
// contract: stage grouping/ordering/counts from `opportunityList`, and the
// stage-advance action calling `opportunityAdvance.mutate` with a
// byte-identical `{opportunityId, toStage}` payload + invalidate on settle.
interface OpportunityRow {
  id: string;
  stage: string;
  closedAt: string | null;
  contact: { id: string; name: string; phone: string };
}

const STAGE_ORDER = ['O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED', 'O5_ENROLLED'];
const STAGE_LABEL_ORDER = ['Tiếp cận', 'Đã liên hệ', 'Đặt lịch kiểm tra', 'Đã kiểm tra', 'Đã ghi danh'];

const OPP_O1: OpportunityRow = {
  id: 'opp-o1',
  stage: 'O1_LEAD',
  closedAt: null,
  contact: { id: 'c1', name: 'Nguyễn Văn A', phone: '0900000001' },
};
const OPP_O2: OpportunityRow = {
  id: 'opp-o2',
  stage: 'O2_CONTACTED',
  closedAt: null,
  contact: { id: 'c2', name: 'Trần Thị B', phone: '0900000002' },
};
const OPP_O2_B: OpportunityRow = {
  id: 'opp-o2-b',
  stage: 'O2_CONTACTED',
  closedAt: null,
  contact: { id: 'c3', name: 'Lê Văn C', phone: '0900000003' },
};

const listState: { data: { items: OpportunityRow[] } | undefined; isLoading: boolean; error: { message: string } | null } = {
  data: { items: [OPP_O1, OPP_O2, OPP_O2_B] },
  isLoading: false,
  error: null,
};
const listQuerySpy = vi.fn();
const advanceMutate = vi.fn();
let advanceOnSettled: (() => void) | undefined;

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'crm.opportunityList.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(listState.data, {
          isLoading: listState.isLoading,
          error: listState.error,
          isError: listState.error !== null,
        });
      },
      'crm.opportunityAdvance.useMutation': (options: {
        onMutate?: (vars: unknown) => unknown;
        onError?: (err: unknown, vars: unknown, ctx: unknown) => void;
        onSettled?: () => void;
      }) => {
        advanceOnSettled = options?.onSettled;
        return mutationResult({ mutate: advanceMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import CrmPipelinePage from './pipeline.js';

describe('CrmPipelinePage', () => {
  beforeEach(() => {
    listState.data = { items: [OPP_O1, OPP_O2, OPP_O2_B] };
    listState.isLoading = false;
    listState.error = null;
    listQuerySpy.mockClear();
    advanceMutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries crm.opportunityList with the unchanged {pageSize: 100} input', () => {
    renderWithProviders(<CrmPipelinePage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ pageSize: 100 });
  });

  it('renders stage funnel bars in O1→O5 order with correct counts', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    const labels = Array.from(container.querySelectorAll('.ck-fn-label')).map((el) => el.textContent);
    const counts = Array.from(container.querySelectorAll('.ck-fn-count')).map((el) => el.textContent);
    expect(labels).toEqual(STAGE_LABEL_ORDER);
    // O1_LEAD=1, O2_CONTACTED=2, O3/O4/O5=0
    expect(counts).toEqual(['1', '2', '0', '0', '0']);
  });

  it('groups opportunities into their stage bucket (contact names appear once per stage)', () => {
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument();
  });

  it('advance action calls crm.opportunityAdvance.mutate({opportunityId, toStage}) with a byte-identical payload', () => {
    renderWithProviders(<CrmPipelinePage />);
    const advanceButtons = screen.getAllByRole('button', { name: 'Chuyển lên' });
    // OPP_O1 (O1_LEAD→O2_CONTACTED) + OPP_O2 + OPP_O2_B (both O2_CONTACTED→O3_TEST_SCHEDULED)
    expect(advanceButtons).toHaveLength(3);
    fireEvent.click(advanceButtons[0]);
    expect(advanceMutate).toHaveBeenCalledWith(
      { opportunityId: 'opp-o1', toStage: 'O2_CONTACTED' },
      expect.anything(),
    );
  });

  it('invalidates crm.opportunityList when the advance mutation settles', () => {
    const invalidateSpy = trpc.useUtils().crm.opportunityList.invalidate;
    renderWithProviders(<CrmPipelinePage />);
    const advanceButtons = screen.getAllByRole('button', { name: 'Chuyển lên' });
    fireEvent.click(advanceButtons[0]);
    expect(invalidateSpy).not.toHaveBeenCalled();
    act(() => advanceOnSettled?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('renders a premium loading state (no ad-hoc Spinner) while opportunityList is loading', () => {
    listState.isLoading = true;
    listState.data = undefined;
    const { container } = renderWithProviders(<CrmPipelinePage />);
    expect(container.querySelector('[data-testid="crm-pipeline-skeleton"]')).toBeInTheDocument();
    expect(container.querySelectorAll('.ck-fn-row')).toHaveLength(0);
  });

  it('renders a premium error state (no Banner) when opportunityList fails', () => {
    listState.error = { message: 'Lỗi mạng' };
    const { container } = renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
    expect(container.querySelectorAll('.ck-fn-row')).toHaveLength(0);
  });

  it('does not render pictographic emoji for the stage-advance affordance', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    // eslint-disable-next-line no-misleading-character-class
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('debounces the header search box (~300ms) and calls opportunityList with {pageSize:100, search}', () => {
    vi.useFakeTimers();
    renderWithProviders(<CrmPipelinePage />);
    listQuerySpy.mockClear();
    const searchInput = screen.getByPlaceholderText('Tìm theo tên hoặc SĐT…');
    fireEvent.change(searchInput, { target: { value: 'Nguyễn' } });
    expect(listQuerySpy).not.toHaveBeenCalledWith({ pageSize: 100, search: 'Nguyễn' });
    act(() => vi.advanceTimersByTime(300));
    expect(listQuerySpy).toHaveBeenCalledWith({ pageSize: 100, search: 'Nguyễn' });
  });

  it('queries the unchanged {pageSize: 100} input (no `search` key) while the search box is empty', () => {
    renderWithProviders(<CrmPipelinePage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ pageSize: 100 });
  });

  it('opens the create-lead dialog when "Thêm cơ hội" is clicked', () => {
    renderWithProviders(<CrmPipelinePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm cơ hội' }));
    expect(screen.getByText('Thêm cơ hội mới')).toBeInTheDocument();
  });

  it('shows an "Đánh dấu mất" action on each open, non-O5 card and opens the shared mark-lost dialog', () => {
    renderWithProviders(<CrmPipelinePage />);
    const markLostButtons = screen.getAllByRole('button', { name: 'Đánh dấu mất' });
    // OPP_O1 + OPP_O2 + OPP_O2_B are all open and not O5.
    expect(markLostButtons).toHaveLength(3);
    fireEvent.click(markLostButtons[0]);
    expect(screen.getByText('Đánh dấu mất cơ hội')).toBeInTheDocument();
  });

  it('does not show "Đánh dấu mất" for an O5_ENROLLED opportunity', () => {
    const OPP_O5: OpportunityRow = {
      id: 'opp-o5',
      stage: 'O5_ENROLLED',
      closedAt: null,
      contact: { id: 'c9', name: 'Đặng Văn E', phone: '0900000009' },
    };
    listState.data = { items: [OPP_O5] };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.queryByRole('button', { name: 'Đánh dấu mất' })).not.toBeInTheDocument();
  });

  it('does not show "Đánh dấu mất" for an already-lost opportunity', () => {
    const OPP_LOST: OpportunityRow = {
      id: 'opp-lost',
      stage: 'O2_CONTACTED',
      closedAt: '2026-07-01T00:00:00.000Z',
      contact: { id: 'c8', name: 'Bùi Thị F', phone: '0900000008' },
    };
    listState.data = { items: [OPP_LOST] };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.queryByRole('button', { name: 'Đánh dấu mất' })).not.toBeInTheDocument();
  });
});

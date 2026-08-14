// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// `window.matchMedia` is polyfilled centrally in `apps/admin/test-setup.ts`
// (Astryx Spinner needs it under jsdom).

// Locks the CRM pipeline dashboard (phase-03 Kanban→premium upgrade, phase-06
// F7 fix, phase-C column-count truth). Backend (`crm.opportunityList` +
// `crm.opportunityAdvance`) already exists (apps/api/src/crm/router.ts) —
// this test drives the UI contract:
// - stage grouping/ordering (from `items`, current page only)
// - funnel COUNTS from the server-aggregated `stageCounts`/`lostCount`
//   (facility-wide, NOT derived by counting `items` — the F7 contract)
// - kanban column badge = cards currently rendered in that column
//   (page-scoped). Mixing funnel totals into the column badge is the
//   count lie this suite now forbids.
// - the lost-visibility filter (`lost: 'exclude'|'include'|'only'`)
// - real page/pageSize pagination
// - the stage-advance action calling `opportunityAdvance.mutate` with a
//   byte-identical `{opportunityId, toStage}` payload + invalidate on settle.
interface OpportunityRow {
  id: string;
  stage: string;
  closedAt: string | null;
  contact: { id: string; name: string; phone: string };
  source?: string | null;
  assignedTo?: { userId: string; fullName: string } | null;
  nextActionAt?: string | null;
  isRotting?: boolean;
  rottingDays?: number | null;
}

interface OpportunityListData {
  items: OpportunityRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  stageCounts?: Record<string, number>;
  lostCount?: number;
}

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

// `stageCounts` deliberately DIVERGES from what counting `items` would give
// (items only carry O1=1, O2=2, O3/O4/O5=0) — proving the funnel reads the
// server aggregate, not a client-side count over the current page's items.
const STAGE_COUNTS_MOCK: Record<string, number> = {
  O1_LEAD: 5,
  O2_CONTACTED: 1,
  O3_TEST_SCHEDULED: 2,
  O4_TESTED: 0,
  O5_ENROLLED: 3,
};

const listState: { data: OpportunityListData | undefined; isLoading: boolean; error: { message: string } | null } = {
  data: { items: [OPP_O1, OPP_O2, OPP_O2_B], total: 3, page: 1, pageSize: 20, stageCounts: STAGE_COUNTS_MOCK, lostCount: 0 },
  isLoading: false,
  error: null,
};
const listQuerySpy = vi.fn();
const advanceMutate = vi.fn();
const scheduleTestMutate = vi.fn();
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
      'testAppointment.schedule.useMutation': () => mutationResult({ mutate: scheduleTestMutate }),
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
    listState.data = {
      items: [OPP_O1, OPP_O2, OPP_O2_B],
      total: 3,
      page: 1,
      pageSize: 20,
      stageCounts: STAGE_COUNTS_MOCK,
      lostCount: 0,
    };
    listState.isLoading = false;
    listState.error = null;
    listQuerySpy.mockClear();
    advanceMutate.mockClear();
    scheduleTestMutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries crm.opportunityList with {lost: "exclude", page: 1, pageSize: 20} by default (no search key)', () => {
    renderWithProviders(<CrmPipelinePage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ lost: 'exclude', page: 1, pageSize: 20 });
  });

  it('passes due from the URL into crm.opportunityList', () => {
    renderWithProviders(<CrmPipelinePage />, { route: '/crm?due=late' });
    expect(listQuerySpy).toHaveBeenCalledWith({
      lost: 'exclude',
      page: 1,
      pageSize: 20,
      due: 'late',
    });
  });

  it('renders rotting days on the kanban badge', () => {
    listState.data = {
      items: [{ ...OPP_O1, isRotting: true, rottingDays: 12 }],
      total: 1,
      page: 1,
      pageSize: 20,
      stageCounts: STAGE_COUNTS_MOCK,
      lostCount: 0,
    };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByTestId('crm-rotting-badge')).toHaveTextContent('Nguội 12 ngày');
  });

  it('colours a next-action chip from the raw due date', () => {
    listState.data = {
      items: [{ ...OPP_O1, nextActionAt: '2020-01-01T00:00:00.000Z' }],
      total: 1,
      page: 1,
      pageSize: 20,
      stageCounts: STAGE_COUNTS_MOCK,
      lostCount: 0,
    };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByTestId('crm-next-action-chip')).toHaveClass('cmc-due-late');
  });

  it('renders stage funnel bars in O1→O5 order using server-aggregated stageCounts (not a count over items)', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    const labels = Array.from(container.querySelectorAll('.console-fn-label')).map((el) => el.textContent);
    const counts = Array.from(container.querySelectorAll('.console-fn-count')).map((el) => el.textContent);
    expect(labels).toEqual(STAGE_LABEL_ORDER);
    // Matches STAGE_COUNTS_MOCK, NOT the items-derived counts (which would be
    // ['1','2','0','0','0']) — proves the funnel is server-sourced.
    expect(counts).toEqual(['5', '1', '2', '0', '3']);
  });

  function kanbanColumn(container: HTMLElement, title: string): HTMLElement {
    const header = Array.from(container.querySelectorAll('.console-kanban-col-header')).find(
      (el) => el.querySelector('span:first-child')?.textContent === title,
    );
    const col = header?.closest('.console-kanban-col');
    if (!(col instanceof HTMLElement)) throw new Error(`missing kanban column: ${title}`);
    return col;
  }

  it('renders the O1 column badge from visible cards, not facility-wide stageCounts (funnel stays 5)', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    // Default mock: stageCounts.O1=5, one O1 card on this page.
    // Scope to columns: funnel bars also render the same stage labels.
    const colTitles = Array.from(
      container.querySelectorAll('.console-kanban-col-header > span:first-child'),
    ).map((el) => el.textContent);
    expect(colTitles).toEqual(STAGE_LABEL_ORDER);
    const colCounts = Array.from(container.querySelectorAll('.console-kanban-col-count')).map(
      (el) => el.textContent,
    );
    expect(colCounts).toEqual(['1', '2', '0', '0', '0']);
    expect(kanbanColumn(container, 'Tiếp cận').querySelector('.console-kanban-col-count')?.textContent).toBe(
      '1',
    );
    const funnelCounts = Array.from(container.querySelectorAll('.console-fn-count')).map(
      (el) => el.textContent,
    );
    expect(funnelCounts).toEqual(['5', '1', '2', '0', '3']);
  });

  it('shows a page-scoped empty copy when the stage has facility cards but none on this page', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    // Default mock: stageCounts.O3=2, zero O3 items on this page.
    const o3 = kanbanColumn(container, 'Đặt lịch kiểm tra');
    expect(o3.querySelector('.console-kanban-empty')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Không có trên trang này · 2 ở giai đoạn',
    );
    expect(o3.textContent).not.toMatch(/Chưa có/);
  });

  it('shows "Chưa có" when the stage has zero facility cards and zero items', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    // Default mock: stageCounts.O4=0, zero O4 items.
    const o4 = kanbanColumn(container, 'Đã kiểm tra');
    expect(o4.querySelector('.console-kanban-empty')?.textContent).toBe('Chưa có');
  });

  describe('filter-aware empty-state (facilityCount is not a filtered total)', () => {
    const emptyCopy = (col: HTMLElement) =>
      col.querySelector('.console-kanban-empty')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    it('lost=only + total>0 + empty O2 (facilityCount O2=0) uses neutral copy, not "Chưa có"', () => {
      const OPP_LOST_O1: OpportunityRow = {
        ...OPP_O1,
        closedAt: '2026-07-01T00:00:00.000Z',
      };
      listState.data = {
        items: [OPP_LOST_O1],
        total: 4,
        page: 1,
        pageSize: 20,
        stageCounts: { ...STAGE_COUNTS_MOCK, O2_CONTACTED: 0 },
        lostCount: 4,
      };
      const { container } = renderWithProviders(<CrmPipelinePage />);
      fireEvent.click(screen.getByRole('combobox', { name: 'Hiển thị' }));
      fireEvent.click(screen.getByRole('option', { name: 'Đã mất' }));
      const o2 = kanbanColumn(container, 'Đã liên hệ');
      expect(emptyCopy(o2)).toBe('Không khớp bộ lọc');
      expect(emptyCopy(o2)).not.toMatch(/Chưa có/);
      expect(emptyCopy(o2)).not.toMatch(/\d/);
    });

    it('search active + unmatched column does not interpolate facility N', () => {
      vi.useFakeTimers();
      const { container } = renderWithProviders(<CrmPipelinePage />);
      fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc SĐT…'), {
        target: { value: 'Nguyễn' },
      });
      act(() => vi.advanceTimersByTime(300));
      // Default mock: O3 has facilityCount=2 and zero items on this page.
      const o3 = kanbanColumn(container, 'Đặt lịch kiểm tra');
      const copy = emptyCopy(o3);
      expect(copy).toBe('Không khớp bộ lọc');
      expect(copy).not.toMatch(/\d/);
      expect(copy).not.toContain(String(STAGE_COUNTS_MOCK.O3_TEST_SCHEDULED));
    });

    it('?stage= URL filter + unmatched column does not interpolate facility N', () => {
      const { container } = renderWithProviders(<CrmPipelinePage />, {
        route: '/crm?stage=O1_LEAD',
      });
      const o3 = kanbanColumn(container, 'Đặt lịch kiểm tra');
      const copy = emptyCopy(o3);
      expect(copy).toBe('Không khớp bộ lọc');
      expect(copy).not.toMatch(/\d/);
      expect(copy).not.toContain(String(STAGE_COUNTS_MOCK.O3_TEST_SCHEDULED));
    });

    it('no filter, facilityCount>0, this page 0 → still "Không có trên trang này · N"', () => {
      const { container } = renderWithProviders(<CrmPipelinePage />);
      const o3 = kanbanColumn(container, 'Đặt lịch kiểm tra');
      expect(emptyCopy(o3)).toBe('Không có trên trang này · 2 ở giai đoạn');
    });

    it('no filter, facilityCount=0 → "Chưa có"', () => {
      const { container } = renderWithProviders(<CrmPipelinePage />);
      const o4 = kanbanColumn(container, 'Đã kiểm tra');
      expect(emptyCopy(o4)).toBe('Chưa có');
    });
  });

  describe('table list empty grammar (Wave 4A bridge)', () => {
    it('never sets ListPage isEmpty — FunnelBar stays when table is empty', () => {
      listState.data = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        stageCounts: { O1_LEAD: 0, O2_CONTACTED: 0, O3_TEST_SCHEDULED: 0, O4_TESTED: 0, O5_ENROLLED: 0 },
        lostCount: 0,
      };
      const { container } = renderWithProviders(<CrmPipelinePage />, { route: '/crm?view=table' });
      expect(container.querySelectorAll('.console-fn-row').length).toBeGreaterThan(0);
      expect(screen.getByText('Chưa có cơ hội nào')).toBeInTheDocument();
      // Distinct from the header button — journey selectors rely on unique names.
      expect(screen.getByRole('button', { name: 'Tạo cơ hội đầu tiên' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Thêm cơ hội' })).toHaveLength(1);
    });

    it('claims filtered empty when facility evidence exists under active search', () => {
      vi.useFakeTimers();
      listState.data = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        stageCounts: STAGE_COUNTS_MOCK,
        lostCount: 2,
      };
      renderWithProviders(<CrmPipelinePage />, { route: '/crm?view=table' });
      const searchInput = screen.getByPlaceholderText('Tìm theo tên hoặc SĐT…');
      fireEvent.change(searchInput, { target: { value: 'xyz-no-match' } });
      act(() => vi.advanceTimersByTime(300));
      expect(screen.getByText('Không cơ hội nào khớp bộ lọc')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bỏ tất cả bộ lọc' })).toBeInTheDocument();
      expect(screen.queryByText('Chưa có cơ hội nào')).not.toBeInTheDocument();
    });

    it('does not treat lostCount alone as filtered evidence under lost=exclude', () => {
      vi.useFakeTimers();
      listState.data = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        stageCounts: { O1_LEAD: 0, O2_CONTACTED: 0, O3_TEST_SCHEDULED: 0, O4_TESTED: 0, O5_ENROLLED: 0 },
        lostCount: 9,
      };
      renderWithProviders(<CrmPipelinePage />, { route: '/crm?view=table' });
      const searchInput = screen.getByPlaceholderText('Tìm theo tên hoặc SĐT…');
      fireEvent.change(searchInput, { target: { value: 'xyz-no-match' } });
      act(() => vi.advanceTimersByTime(300));
      expect(screen.getByText('Không có cơ hội khớp điều kiện hiện tại')).toBeInTheDocument();
      expect(screen.queryByText('Không cơ hội nào khớp bộ lọc')).not.toBeInTheDocument();
    });
  });

  it('renders the lostCount from the server response', () => {
    listState.data = { ...listState.data!, lostCount: 4 };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('4 cơ hội đã mất')).toBeInTheDocument();
  });

  it('groups opportunities into their stage bucket (contact names appear once per stage)', () => {
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument();
  });

  it('renders the owner badge initials from assignedTo.fullName (phase-10)', () => {
    listState.data = {
      items: [{ ...OPP_O1, assignedTo: { userId: 'u9', fullName: 'Phạm Thị Dung' } }],
    };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('PD')).toBeInTheDocument();
    expect(screen.queryByText('Chưa giao')).not.toBeInTheDocument();
  });

  it('shows "Chưa giao" when the opportunity has no assignedTo (phase-10)', () => {
    listState.data = { items: [{ ...OPP_O1, assignedTo: null }] };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('Chưa giao')).toBeInTheDocument();
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
    expect(container.querySelectorAll('.console-fn-row')).toHaveLength(0);
  });

  it('renders a premium error state (no Banner) when opportunityList fails', () => {
    listState.error = { message: 'Lỗi mạng' };
    const { container } = renderWithProviders(<CrmPipelinePage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
    expect(container.querySelectorAll('.console-fn-row')).toHaveLength(0);
  });

  it('does not render pictographic emoji for the stage-advance affordance', () => {
    const { container } = renderWithProviders(<CrmPipelinePage />);
    // eslint-disable-next-line no-misleading-character-class
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('debounces the header search box (~300ms) and calls opportunityList with {search, lost: "exclude", page: 1, pageSize: 20}', () => {
    vi.useFakeTimers();
    renderWithProviders(<CrmPipelinePage />);
    listQuerySpy.mockClear();
    const searchInput = screen.getByPlaceholderText('Tìm theo tên hoặc SĐT…');
    fireEvent.change(searchInput, { target: { value: 'Nguyễn' } });
    expect(listQuerySpy).not.toHaveBeenCalledWith({
      search: 'Nguyễn',
      lost: 'exclude',
      page: 1,
      pageSize: 20,
    });
    act(() => vi.advanceTimersByTime(300));
    expect(listQuerySpy).toHaveBeenCalledWith({ search: 'Nguyễn', lost: 'exclude', page: 1, pageSize: 20 });
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

  it('does not show "Đánh dấu mất" for an already-lost opportunity, and shows the Lost badge instead', () => {
    const OPP_LOST: OpportunityRow = {
      id: 'opp-lost',
      stage: 'O2_CONTACTED',
      closedAt: '2026-07-01T00:00:00.000Z',
      contact: { id: 'c8', name: 'Bùi Thị F', phone: '0900000008' },
    };
    listState.data = { items: [OPP_LOST] };
    renderWithProviders(<CrmPipelinePage />);
    expect(screen.queryByRole('button', { name: 'Đánh dấu mất' })).not.toBeInTheDocument();
    expect(screen.getByText('Lost')).toBeInTheDocument();
  });

  describe('lost-visibility filter', () => {
    it('defaults to "Đang chăm sóc" (lost: exclude)', () => {
      renderWithProviders(<CrmPipelinePage />);
      expect(screen.getByRole('combobox', { name: 'Hiển thị' })).toHaveTextContent('Đang chăm sóc');
    });

    it('switches to lost: "include" when "Tất cả" is selected', () => {
      renderWithProviders(<CrmPipelinePage />);
      listQuerySpy.mockClear();
      fireEvent.click(screen.getByRole('combobox', { name: 'Hiển thị' }));
      fireEvent.click(screen.getByRole('option', { name: 'Tất cả' }));
      expect(listQuerySpy).toHaveBeenCalledWith({ lost: 'include', page: 1, pageSize: 20 });
    });

    it('switches to lost: "only" when "Đã mất" is selected', () => {
      renderWithProviders(<CrmPipelinePage />);
      listQuerySpy.mockClear();
      fireEvent.click(screen.getByRole('combobox', { name: 'Hiển thị' }));
      fireEvent.click(screen.getByRole('option', { name: 'Đã mất' }));
      expect(listQuerySpy).toHaveBeenCalledWith({ lost: 'only', page: 1, pageSize: 20 });
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      listState.data = {
        items: [OPP_O1, OPP_O2, OPP_O2_B],
        total: 45,
        page: 1,
        pageSize: 20,
        stageCounts: STAGE_COUNTS_MOCK,
        lostCount: 0,
      };
    });

    it('renders the page/total summary and disables "Trang trước" on page 1', () => {
      renderWithProviders(<CrmPipelinePage />);
      expect(screen.getByText('Trang 1/3 — 45 cơ hội')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Trang sau' })).not.toBeDisabled();
    });

    it('advances the `page` param when "Trang sau" is clicked', () => {
      renderWithProviders(<CrmPipelinePage />);
      listQuerySpy.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
      expect(listQuerySpy).toHaveBeenCalledWith({ lost: 'exclude', page: 2, pageSize: 20 });
    });
  });

  describe('list ↔ kanban view switcher (Phase 4 design3)', () => {
    it('defaults to kanban board (KanbanBoard) when view query is absent', () => {
      const { container } = renderWithProviders(<CrmPipelinePage />);
      expect(container.querySelector('.console-kanban-board')).toBeInTheDocument();
      expect(screen.getByLabelText('Xem dạng kanban')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Xem dạng danh sách')).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches to table list view via the view switcher and shares opportunityList input', () => {
      renderWithProviders(<CrmPipelinePage />);
      listQuerySpy.mockClear();
      fireEvent.click(screen.getByLabelText('Xem dạng danh sách'));
      // Re-renders may re-subscribe, but listInput stays the same (no view key).
      for (const call of listQuerySpy.mock.calls) {
        expect(call[0]).toEqual({ lost: 'exclude', page: 1, pageSize: 20 });
        expect(call[0]).not.toHaveProperty('view');
      }
      // DataTable headers (list columns mirror card data).
      expect(screen.getByText('Học viên')).toBeInTheDocument();
      expect(screen.getByText('SĐT')).toBeInTheDocument();
      expect(screen.getByText('Giai đoạn')).toBeInTheDocument();
      expect(screen.getByText('Phụ trách')).toBeInTheDocument();
      // Contact names still present from shared items.
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    it('deep-links table view from ?view=table', () => {
      const { container } = renderWithProviders(<CrmPipelinePage />, {
        route: '/crm?view=table',
      });
      expect(container.querySelector('.console-kanban-board')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Xem dạng danh sách')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Học viên')).toBeInTheDocument();
    });

    it('keeps advance action available in kanban after switching back from table', () => {
      renderWithProviders(<CrmPipelinePage />);
      fireEvent.click(screen.getByLabelText('Xem dạng danh sách'));
      fireEvent.click(screen.getByLabelText('Xem dạng kanban'));
      expect(screen.getAllByRole('button', { name: 'Chuyển lên' }).length).toBeGreaterThan(0);
    });
  });

  describe('"Đặt lịch test" action (testAppointment.schedule)', () => {
    it('shows the action only on O2_CONTACTED/O3_TEST_SCHEDULED cards, not on O1_LEAD', () => {
      renderWithProviders(<CrmPipelinePage />);
      // OPP_O2 + OPP_O2_B are O2_CONTACTED; OPP_O1 is O1_LEAD (no action).
      expect(screen.getAllByRole('button', { name: 'Đặt lịch test' })).toHaveLength(2);
    });

    it('does not show the action for an O5_ENROLLED opportunity', () => {
      const OPP_O5: OpportunityRow = {
        id: 'opp-o5',
        stage: 'O5_ENROLLED',
        closedAt: null,
        contact: { id: 'c9', name: 'Đặng Văn E', phone: '0900000009' },
      };
      listState.data = { items: [OPP_O5] };
      renderWithProviders(<CrmPipelinePage />);
      expect(screen.queryByRole('button', { name: 'Đặt lịch test' })).not.toBeInTheDocument();
    });

    it('does not show the action for an already-lost O2_CONTACTED opportunity', () => {
      const OPP_LOST: OpportunityRow = {
        id: 'opp-lost',
        stage: 'O2_CONTACTED',
        closedAt: '2026-07-01T00:00:00.000Z',
        contact: { id: 'c8', name: 'Bùi Thị F', phone: '0900000008' },
      };
      listState.data = { items: [OPP_LOST] };
      renderWithProviders(<CrmPipelinePage />);
      expect(screen.queryByRole('button', { name: 'Đặt lịch test' })).not.toBeInTheDocument();
    });

    it('opens the schedule dialog and calls testAppointment.schedule.mutate with {type: "entrance", opportunityId, scheduledAt}', () => {
      renderWithProviders(<CrmPipelinePage />);
      const scheduleButtons = screen.getAllByRole('button', { name: 'Đặt lịch test' });
      fireEvent.click(scheduleButtons[0]);
      expect(screen.getByText('Đặt lịch test đầu vào')).toBeInTheDocument();

      const datetimeInput = screen.getByLabelText('Thời gian test');
      fireEvent.change(datetimeInput, { target: { value: '2026-08-01T10:00' } });
      fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));

      expect(scheduleTestMutate).toHaveBeenCalledWith(
        {
          type: 'entrance',
          opportunityId: 'opp-o2',
          scheduledAt: new Date('2026-08-01T10:00').toISOString(),
        },
        expect.anything(),
      );
    });
  });
});

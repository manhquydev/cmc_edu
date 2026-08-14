// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks current gift.list/gift.upsert behavior BEFORE the ListPage refactor
// (TDD per phase-01). Async factory so the dynamic import resolves after the
// vi.mock hoist (see mock-trpc.ts usage docs). Query state is mutable so each
// test can control `gift.list`'s data/error without re-declaring the mock.
const giftListState: { data: unknown; error: { message: string } | null } = {
  data: [{ id: 'g1', name: 'Bút bi', starsRequired: 10, stock: 5, isActive: true }],
  error: null,
};
const giftListQuerySpy = vi.fn();
const upsertMutate = vi.fn();
let upsertOnSuccess: (() => void) | undefined;

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
      'gift.list.useQuery': (...args: unknown[]) => {
        giftListQuerySpy(...args);
        return queryResult(giftListState.data, {
          error: giftListState.error,
          isError: giftListState.error !== null,
        });
      },
      'gift.upsert.useMutation': (options: { onSuccess?: () => void }) => {
        upsertOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: upsertMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import GiftsPage from './gifts.js';

describe('GiftsPage', () => {
  beforeEach(() => {
    giftListState.data = [{ id: 'g1', name: 'Bút bi', starsRequired: 10, stock: 5, isActive: true }];
    giftListState.error = null;
    giftListQuerySpy.mockClear();
  });

  it('renders gift rows bound to gift.list.useQuery', () => {
    renderWithProviders(<GiftsPage />);
    expect(screen.getByText('Bút bi')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('10'))).toBeInTheDocument();
  });

  it('defaults FilterBar to all gifts (includeInactive: true) without a fake "all" option value', () => {
    renderWithProviders(<GiftsPage />);
    expect(giftListQuerySpy).toHaveBeenCalledWith({ includeInactive: true });
    // G1: empty + placeholder = all; real option is only "Đang hiện"
    const search = screen.getByRole('search', { name: 'Bộ lọc' });
    fireEvent.click(within(search).getByRole('button', { name: 'Bộ lọc nâng cao' }));
    expect(within(search).getByRole('combobox', { name: 'Trạng thái' })).toBeInTheDocument();
    fireEvent.click(within(search).getByRole('combobox', { name: 'Trạng thái' }));
    expect(screen.getByRole('option', { name: 'Đang hiện' })).toBeInTheDocument();
    // No explicit option labeled as a second "Tất cả" path (placeholder handles all)
    expect(screen.queryByRole('option', { name: 'Tất cả' })).not.toBeInTheDocument();
  });

  it('queries includeInactive: false when "Đang hiện" is selected', () => {
    renderWithProviders(<GiftsPage />);
    giftListQuerySpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(screen.getByRole('option', { name: 'Đang hiện' }));
    expect(giftListQuerySpy).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('creates a gift with byte-identical gift.upsert input and invalidates gift.list on success', () => {
    const invalidateSpy = trpc.useUtils().gift.list.invalidate;
    renderWithProviders(<GiftsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Thêm phần thưởng' }));

    const dialog = screen.getByRole('dialog');
    // Astryx `TextInput`/`NumberInput` labels include a trailing " ∙ Required"
    // indicator span, so the accessible name is not an exact match — use a
    // starts-with regex.
    fireEvent.change(within(dialog).getByLabelText(/^Tên phần thưởng/), {
      target: { value: 'Sách tô màu' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Số sao cần/), {
      target: { value: '25' },
    });

    fireEvent.click(within(dialog).getByText('Tạo'));

    expect(upsertMutate).toHaveBeenCalledWith({
      name: 'Sách tô màu',
      starsRequired: 25,
      stock: -1,
      isActive: true,
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    act(() => upsertOnSuccess?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when gift.list returns no rows', () => {
    giftListState.data = [];
    renderWithProviders(<GiftsPage />);
    expect(screen.getByText('Chưa có phần thưởng nào')).toBeInTheDocument();
  });

  it('renders error banner when gift.list fails', () => {
    giftListState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<GiftsPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Gap-closure: parents provisioned automatically by receipt approval never
// appear in guardian.listPendingLinks (self-service link-request queue only),
// so this "Tất cả phụ huynh" tab (parentAccount.list) is the only way staff
// can ever find one to backfill their email. Locks: default missingEmailOnly
// filter, the shared email modal reused across both tabs (prefilled when
// correcting an existing email, blank when setting one for the first time),
// and the tab being hidden entirely for a role without parentAccount.updateEmail.
interface LinkRequestRow {
  id: string;
  studentName: string;
  parentPhone: string;
  parentAccountId: string;
  status: string;
  createdAt: string;
}

interface ParentRow {
  id: string;
  phone: string;
  email: string | null;
  linkedChildrenCount: number;
  createdAt: string;
}

const PENDING_ROW: LinkRequestRow = {
  id: 'req-1',
  studentName: 'Nguyễn Văn C',
  parentPhone: '84900000001',
  parentAccountId: 'pa-req-1',
  status: 'pending',
  createdAt: '2026-07-20T00:00:00.000Z',
};

const PARENT_NO_EMAIL: ParentRow = {
  id: 'pa-1',
  phone: '84901111111',
  email: null,
  linkedChildrenCount: 1,
  createdAt: '2026-07-20T00:00:00.000Z',
};

const PARENT_WITH_EMAIL: ParentRow = {
  id: 'pa-2',
  phone: '84902222222',
  email: 'existing@test.com',
  linkedChildrenCount: 2,
  createdAt: '2026-07-21T00:00:00.000Z',
};

const pendingLinksState: { data: { items: LinkRequestRow[]; total: number } } = {
  data: { items: [PENDING_ROW], total: 1 },
};
const parentListState: {
  data: { items: ParentRow[]; total: number; page: number; pageSize: number };
} = {
  data: { items: [PARENT_NO_EMAIL], total: 1, page: 1, pageSize: 20 },
};
let sessionRoles: string[] = ['sale'];
const parentListQuerySpy = vi.fn();
const updateEmailMutateSpy = vi.fn();
let updateEmailOnSuccess: (() => void) | undefined;

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({ userId: 'u1', roles: sessionRoles, facilityId: 'f1', config: {} }),
      'guardian.listPendingLinks.useQuery': () => queryResult(pendingLinksState.data),
      'guardian.approveLink.useMutation': () => mutationResult(),
      'guardian.rejectLink.useMutation': () => mutationResult(),
      'parentAccount.list.useQuery': (...args: unknown[]) => {
        parentListQuerySpy(...args);
        return queryResult(parentListState.data);
      },
      'parentAccount.updateEmail.useMutation': (options: { onSuccess?: () => void }) => {
        updateEmailOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: updateEmailMutateSpy });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ParentListPage from './index.js';

describe('ParentListPage', () => {
  beforeEach(() => {
    sessionRoles = ['sale'];
    pendingLinksState.data = { items: [PENDING_ROW], total: 1 };
    parentListState.data = { items: [PARENT_NO_EMAIL], total: 1, page: 1, pageSize: 20 };
    parentListQuerySpy.mockClear();
    updateEmailMutateSpy.mockClear();
    updateEmailOnSuccess = undefined;
  });

  it('renders the link-request queue by default', () => {
    renderWithProviders(<ParentListPage />);
    expect(screen.getByText('Nguyễn Văn C')).toBeInTheDocument();
  });

  it('hides the "Tất cả phụ huynh" tab for a role without parentAccount.updateEmail', () => {
    sessionRoles = ['giao_vien'];
    renderWithProviders(<ParentListPage />);
    expect(screen.queryByRole('button', { name: 'Tất cả phụ huynh' })).not.toBeInTheDocument();
  });

  it('switches to "Tất cả phụ huynh" and defaults to missingEmailOnly=true', () => {
    renderWithProviders(<ParentListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả phụ huynh' }));

    expect(screen.getByText('84901111111')).toBeInTheDocument();
    expect(screen.getByText('Chưa có email — bị khoá LMS')).toBeInTheDocument();

    const lastCallArgs = parentListQuerySpy.mock.calls.at(-1)?.[0];
    expect(lastCallArgs).toMatchObject({ missingEmailOnly: true, page: 1, pageSize: 20 });
  });

  it('opens the shared email modal from a "Tất cả phụ huynh" row and submits the update', () => {
    renderWithProviders(<ParentListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả phụ huynh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật email' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('84901111111')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Email đăng nhập LMS/), {
      target: { value: 'new-email@test.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu email' }));

    expect(updateEmailMutateSpy).toHaveBeenCalledWith({
      parentAccountId: 'pa-1',
      email: 'new-email@test.com',
    });

    // The Dialog shell itself stays mounted (Astryx native-<dialog> quirk,
    // same as the pre-existing approve/roles modals in this app) — assert the
    // modal's own content (gated on `emailTarget !== null`) is gone instead.
    act(() => updateEmailOnSuccess?.());
    expect(screen.queryByLabelText(/Email đăng nhập LMS/)).not.toBeInTheDocument();
  });

  it('prefills the email modal with the existing email when correcting one', () => {
    parentListState.data = { items: [PARENT_WITH_EMAIL], total: 1, page: 1, pageSize: 20 };
    renderWithProviders(<ParentListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả phụ huynh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật email' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/Email đăng nhập LMS/)).toHaveValue('existing@test.com');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Phase-04 super-admin-completion: audit-log viewer — bảng ai-làm-gì-khi-nào
// + bộ lọc (actor/action/entity/date range) + phân trang, gated by audit.list.
interface AuditRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
}

const ROW_A: AuditRow = {
  id: 'audit-1',
  actor: 'staff-1',
  action: 'facility.update',
  entity: 'Facility',
  entityId: 'f1',
  createdAt: '2026-07-16T00:00:00.000Z',
};

const auditListState: { data: { items: AuditRow[]; total: number; page: number; pageSize: number } } = {
  data: { items: [ROW_A], total: 1, page: 1, pageSize: 20 },
};
let sessionRoles: string[] = ['super_admin'];
const listQuerySpy = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'audit.list.useQuery': (...args: unknown[]) => {
        listQuerySpy(...args);
        return queryResult(auditListState.data);
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import AuditLogPage from './audit-log.js';

describe('AuditLogPage', () => {
  beforeEach(() => {
    sessionRoles = ['super_admin'];
    auditListState.data = { items: [ROW_A], total: 1, page: 1, pageSize: 20 };
    listQuerySpy.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders audit rows bound to audit.list.useQuery', () => {
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByText('staff-1')).toBeInTheDocument();
    expect(screen.getByText('facility.update')).toBeInTheDocument();
    expect(screen.getByText('Facility')).toBeInTheDocument();
  });

  it('applies actor/action/entity filters to audit.list after text debounce', async () => {
    renderWithProviders(<AuditLogPage />);
    fireEvent.change(screen.getByLabelText('Người thực hiện'), { target: { value: 'staff-2' } });
    fireEvent.change(screen.getByLabelText('Loại việc'), { target: { value: 'user.updateRoles' } });
    fireEvent.change(screen.getByLabelText('Đối tượng'), { target: { value: 'AppUser' } });

    // Immediate keystrokes must not hit the server with partial free-text.
    const midCall = listQuerySpy.mock.calls.at(-1)?.[0] as { actor?: string } | undefined;
    expect(midCall?.actor).toBeUndefined();

    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      const lastCallArgs = listQuerySpy.mock.calls.at(-1)?.[0];
      expect(lastCallArgs).toMatchObject({
        actor: 'staff-2',
        action: 'user.updateRoles',
        entity: 'AppUser',
        page: 1,
      });
    });
  });

  it('maps date fields to inclusive ICT day bounds for audit.list', () => {
    renderWithProviders(<AuditLogPage />);
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-08-06' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-08-06' } });

    const lastCallArgs = listQuerySpy.mock.calls.at(-1)?.[0] as {
      createdFrom?: string;
      createdTo?: string;
    };
    // ICT midnight 2026-08-06 → 2026-08-05T17:00:00.000Z
    expect(lastCallArgs.createdFrom).toBe('2026-08-05T17:00:00.000Z');
    // Last ms before next ICT midnight
    expect(lastCallArgs.createdTo).toBe('2026-08-06T16:59:59.999Z');
  });

  it('paginates via Trang sau', () => {
    auditListState.data = { items: [ROW_A], total: 50, page: 1, pageSize: 20 };
    renderWithProviders(<AuditLogPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    const lastCallArgs = listQuerySpy.mock.calls.at(-1)?.[0];
    expect(lastCallArgs).toMatchObject({ page: 2 });
  });

  it('renders a gated EmptyState when the session lacks audit.list', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(screen.queryByText('facility.update')).not.toBeInTheDocument();
  });
});

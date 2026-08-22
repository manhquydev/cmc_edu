// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Hiding the menu entry is not access control — the URL still works. The list
// remains page-gated; detail authorization is owned by the route's
// section-specific PermissionGate so overview/roster can use different API
// contracts.

const { CLASS, currentRoles } = vi.hoisted(() => ({
  CLASS: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    code: 'CB001',
    program: 'IELTS',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    roomId: null,
    teacherId: null,
    teacherAppUserId: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  currentRoles: { value: ['sale'] as string[] },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }) };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () => ({
        data: { userId: 'u1', roles: currentRoles.value, facilityId: 'f1', config: { approvalSecondEyeThreshold: 20_000_000 } },
        isLoading: false,
        error: null,
      }),
      'classBatch.list.useQuery': queryResult({ items: [], total: 0, page: 1, pageSize: 50 }),
      'classBatch.get.useQuery': queryResult(CLASS),
      'classBatch.listStudents.useQuery': queryResult([]),
      'classSession.list.useQuery': queryResult([]),
      'user.pickList.useQuery': queryResult({ items: [] }),
      'classBatch.assignTeacher.useMutation': () => mutationResult(),
      'classSession.confirm.useMutation': () => mutationResult(),
      'classSession.cancel.useMutation': () => mutationResult(),
    }),
    makeQueryClient: () => ({}),
  };
});

const { default: ClassListPage } = await import('./index.js');

describe('class administration screens are guarded at the page, not just the menu', () => {
  for (const role of ['sale', 'giao_vien']) {
    it(`blocks ${role} from the class list even when the URL is typed directly`, () => {
      currentRoles.value = [role];
      renderWithProviders(<ClassListPage />);
      expect(screen.getByText('Không có quyền truy cập')).toBeTruthy();
    });

  }

  it('still lets giam_doc_dao_tao administer classes', () => {
    currentRoles.value = ['giam_doc_dao_tao'];
    renderWithProviders(<ClassListPage />);
    expect(screen.queryByText('Không có quyền truy cập')).toBeNull();
    expect(screen.getByText('Danh sách lớp học tại cơ sở')).toBeTruthy();
  });
});

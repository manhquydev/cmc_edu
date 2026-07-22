// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Hiding the menu entry is not access control — the URL still works. These
// cover the page-level guard on the class-administration screens for the roles
// that gained `class.read` (so they can pick a class elsewhere) but must not
// administer classes, and must not reach the roster tab this way.

const { CLASS, currentRoles } = vi.hoisted(() => ({
  CLASS: {
    id: 'cb-1',
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
  return { ...actual, useParams: () => ({ id: 'cb-1' }) };
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
const { default: ClassDetailPage } = await import('./class-detail.js');

describe('class administration screens are guarded at the page, not just the menu', () => {
  for (const role of ['sale', 'giao_vien']) {
    it(`blocks ${role} from the class list even when the URL is typed directly`, () => {
      currentRoles.value = [role];
      renderWithProviders(<ClassListPage />);
      expect(screen.getByText('Không có quyền truy cập')).toBeTruthy();
    });

    it(`blocks ${role} from the class detail screen (the roster tab lives here)`, () => {
      currentRoles.value = [role];
      renderWithProviders(<ClassDetailPage />);
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

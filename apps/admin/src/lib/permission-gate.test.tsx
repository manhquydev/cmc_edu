// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render-with-providers.js';

// The runtime capture opened every admin screen as every role and found three
// that answered 403 on their own primary query: /admin/courses for anyone
// without course.manage, and the two engagement screens for giao_vien. None had
// a nav entry, so the URL was the only way in and nothing stopped it.
//
// The permission rosters are correct and stay untouched — what was missing is
// the page saying so instead of rendering a shell that cannot load.

const currentRoles = vi.hoisted(() => ({ value: ['sale'] as string[] }));

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () => ({
        data: { userId: 'u1', roles: currentRoles.value, facilityId: 'f1', config: { approvalSecondEyeThreshold: 20_000_000 } },
        isLoading: false,
        error: null,
      }),
    }),
    makeQueryClient: () => ({}),
  };
});

const { PermissionGate } = await import('./permission-gate.js');

function renderGate(module: string, action: string) {
  return renderWithProviders(
    <PermissionGate module={module} action={action} title="Khoá học" requirementLabel="quản lý khoá học (course.manage)">
      <div>NỘI DUNG TRANG</div>
    </PermissionGate>,
  );
}

describe('PermissionGate', () => {
  it('blocks a role without the permission and names what is required', () => {
    currentRoles.value = ['sale'];
    renderGate('course', 'manage');
    expect(screen.getByText('Không có quyền truy cập')).toBeTruthy();
    expect(screen.getByText(/course\.manage/)).toBeTruthy();
    expect(screen.queryByText('NỘI DUNG TRANG')).toBeNull();
    expect(document.querySelector('.console-empty-ops')).toBeNull();
  });

  it('lets the owning role through', () => {
    currentRoles.value = ['giam_doc_dao_tao'];
    renderGate('course', 'manage');
    expect(screen.getByText('NỘI DUNG TRANG')).toBeTruthy();
  });

  it('keeps giao_vien out of the engagement screens (ADR-D rosters)', () => {
    currentRoles.value = ['giao_vien'];
    renderGate('gift', 'list');
    expect(screen.queryByText('NỘI DUNG TRANG')).toBeNull();
  });

  it('still admits sale to the gift catalogue', () => {
    currentRoles.value = ['sale'];
    renderGate('gift', 'list');
    expect(screen.getByText('NỘI DUNG TRANG')).toBeTruthy();
  });
});

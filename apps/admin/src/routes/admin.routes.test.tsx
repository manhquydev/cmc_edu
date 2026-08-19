// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation, useRoutes } from 'react-router-dom';
import { renderWithProviders } from '../test/render-with-providers.js';

// Locks the D1 compatibility contract: /admin/users and /admin/users/:staffId
// are replace-redirects to the canonical /hr/staff surface — no second
// editable screen exists, old bookmarks land on one surface. The harness
// registers the redirect target (a marker) so the redirect is observable.

let sessionRoles: string[] = ['super_admin'];

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

vi.mock('../pages/admin/facilities.js', () => ({ default: () => <div>FACILITIES_PAGE</div> }));
vi.mock('../pages/admin/network-ip.js', () => ({ default: () => <div>NETWORK_IP_PAGE</div> }));
vi.mock('../pages/admin/shift-config.js', () => ({ default: () => <div>SHIFT_CONFIG_PAGE</div> }));
vi.mock('../pages/admin/audit-log.js', () => ({ default: () => <div>AUDIT_LOG_PAGE</div> }));
vi.mock('../pages/teaching/report-cards.js', () => ({ default: () => <div>REPORT_CARDS_PAGE</div> }));
vi.mock('../pages/hr/staff/index.js', () => ({ default: () => <div>STAFF_LIST_PAGE</div> }));
vi.mock('../pages/hr/staff/staff-detail.js', () => ({ default: () => <div>STAFF_DETAIL_SHELL</div> }));
vi.mock('../pages/classes/class-detail.js', () => ({ default: () => <div>CLASS_DETAIL_PAGE</div> }));
vi.mock('../pages/students/student-detail.js', () => ({ default: () => <div>STUDENT_DETAIL_PAGE</div> }));
vi.mock('../pages/classes/index.js', () => ({ default: () => <div>CLASS_LIST_PAGE</div> }));
vi.mock('../pages/students/index.js', () => ({ default: () => <div>STUDENT_LIST_PAGE</div> }));

const { adminRoutes } = await import('./admin.routes.js');

function AdminRoutesHarness() {
  const location = useLocation();
  const routed = useRoutes([
    { path: '/admin', children: adminRoutes },
    { path: '/hr/staff', element: <div>STAFF_LIST_PAGE</div> },
    { path: '/hr/staff/:staffId/profile', element: <div>STAFF_PROFILE_PAGE</div> },
    // Phase 5: unknown detail sections must fall through to route-level
    // not-found — no generic :section catch-all may silently render a page.
    { path: '*', element: <div>NOT_FOUND_MARKER</div> },
  ]);
  return (
    <>
      <div data-testid="location-marker">{location.pathname}{location.search}</div>
      {routed}
    </>
  );
}

function renderAdmin(route: string) {
  return renderWithProviders(<AdminRoutesHarness />, { route });
}

describe('adminRoutes — staff compatibility redirects (D1)', () => {
  it('redirects /admin/users to the canonical /hr/staff list', async () => {
    renderAdmin('/admin/users');
    expect(await screen.findByText('STAFF_LIST_PAGE')).toBeInTheDocument();
    expect(screen.queryByText(/Thêm nhân viên/i)).not.toBeInTheDocument();
  });

  it('redirects /admin/users/:staffId to the canonical profile section', async () => {
    renderAdmin('/admin/users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(await screen.findByText('STAFF_PROFILE_PAGE')).toBeInTheDocument();
  });
});

describe('adminRoutes — durable class/student sections (Phase 5)', () => {
  it('base class detail redirects (replace) to the overview section', async () => {
    renderAdmin('/admin/classes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?tab=students&view=active');
    expect(await screen.findByText('CLASS_DETAIL_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location-marker')).toHaveTextContent(
      '/admin/classes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/overview?tab=students&view=active',
    );
  });

  it('base class redirect replaces the history entry', async () => {
    const { router } = renderAdmin('/before');
    await router.navigate('/admin/classes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?tab=students');
    expect(await screen.findByText('CLASS_DETAIL_PAGE')).toBeInTheDocument();
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/before');
  });

  it('resolves each class section subpath to the detail page', async () => {
    renderAdmin('/admin/classes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/students');
    expect(await screen.findByText('CLASS_DETAIL_PAGE')).toBeInTheDocument();
  });

  it('base student detail redirects (replace) to the profile section', async () => {
    renderAdmin('/admin/students/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?returnTo=%2Fadmin%2Fclasses%2Fclass-1%2Fstudents');
    expect(await screen.findByText('STUDENT_DETAIL_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location-marker')).toHaveTextContent(
      '/admin/students/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/profile?returnTo=%2Fadmin%2Fclasses%2Fclass-1%2Fstudents',
    );
  });

  it('base student redirect replaces the history entry', async () => {
    const { router } = renderAdmin('/before');
    await router.navigate('/admin/students/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?view=compact');
    expect(await screen.findByText('STUDENT_DETAIL_PAGE')).toBeInTheDocument();
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/before');
  });

  it('resolves the student enrollments section subpath', async () => {
    renderAdmin('/admin/students/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/enrollments');
    expect(await screen.findByText('STUDENT_DETAIL_PAGE')).toBeInTheDocument();
  });

  it('unknown class sections fall through to route-level not-found (no silent render)', async () => {
    renderAdmin('/admin/classes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/nonexistent');
    expect(await screen.findByText('NOT_FOUND_MARKER')).toBeInTheDocument();
    expect(screen.queryByText('CLASS_DETAIL_PAGE')).not.toBeInTheDocument();
  });

  it('unknown student sections fall through to route-level not-found (no generic :section)', async () => {
    renderAdmin('/admin/students/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/attendance');
    expect(await screen.findByText('NOT_FOUND_MARKER')).toBeInTheDocument();
    expect(screen.queryByText('STUDENT_DETAIL_PAGE')).not.toBeInTheDocument();
  });
});

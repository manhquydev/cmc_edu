// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { useRoutes } from 'react-router-dom';
import { renderWithProviders } from '../test/render-with-providers.js';

// Locks two audit findings (audit-260726-2040-hr-payroll-kpi.md #2, #5):
// - `/hr` (the nav row itself) must forward to the first child screen the
//   current role can open — never render the ComingSoon dead end.
// - Every HR route's Suspense fallback must be a Skeleton, not ComingSoon,
//   so a slow chunk load does not read as "not built yet".
// `checkin`/`shifts`/`my` carry no permission gate in nav-registry (visible
// to every active role), so they stay first in the redirect regardless of
// role — this is the real, current permission shape, not a stand-in.
//
// `useRoutes` (declarative, non-data router) is used instead of
// `createMemoryRouter`/`RouterProvider`: react-router@7's data router issues
// a client-side `Request` on every navigation, which this vitest+jsdom
// environment cannot construct (undici `AbortSignal` mismatch) — an
// environment gap, not something the app code under test controls.

let sessionRoles: string[] = ['giao_vien'];

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

// Real page components are heavy (their own tRPC calls, forms, etc.) and
// irrelevant to a routing test — stand in with a plain marker per screen.
vi.mock('../pages/attendance/check-in-out.js', () => ({ default: () => <div>CHECKIN_PAGE</div> }));
vi.mock('../pages/attendance/shifts.js', () => ({ default: () => <div>SHIFTS_PAGE</div> }));
vi.mock('../pages/hr/payroll.js', () => ({ default: () => <div>PAYROLL_PAGE</div> }));
vi.mock('../pages/hr/kpi.js', () => ({ default: () => <div>KPI_PAGE</div> }));
vi.mock('../pages/hr/my-hr.js', () => ({ default: () => <div>MY_PAGE</div> }));
vi.mock('../pages/hr/salary-tiers.js', () => ({ default: () => <div>SALARY_TIERS_PAGE</div> }));

const { hrRoutes } = await import('./hr.routes.js');

function HrRoutesHarness() {
  return useRoutes([{ path: '/hr', children: hrRoutes }]);
}

function renderHr(route = '/hr') {
  return renderWithProviders(<HrRoutesHarness />, { route });
}

describe('hrRoutes', () => {
  beforeEach(() => {
    sessionRoles = ['giao_vien'];
  });

  it('redirects the /hr index to /hr/checkin instead of ComingSoon', async () => {
    renderHr();
    expect(await screen.findByText('CHECKIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText(/Đang phát triển/)).not.toBeInTheDocument();
  });

  it('resolves the same /hr/checkin redirect for a sale role', async () => {
    sessionRoles = ['sale'];
    renderHr();
    expect(await screen.findByText('CHECKIN_PAGE')).toBeInTheDocument();
  });

  it('resolves the same /hr/checkin redirect for a director role with kpi/payroll permission keys', async () => {
    sessionRoles = ['giam_doc_dao_tao'];
    renderHr();
    expect(await screen.findByText('CHECKIN_PAGE')).toBeInTheDocument();
  });

  it('never shows the ComingSoon fallback while a direct child route (e.g. /hr/kpi) lazily loads', async () => {
    sessionRoles = ['giam_doc_dao_tao'];
    renderHr('/hr/kpi');
    expect(screen.queryByText(/Đang phát triển/)).not.toBeInTheDocument();
    // Settle the lazy chunk before the test ends so React does not warn about
    // a Suspense resolution finishing outside act().
    await screen.findByText('KPI_PAGE');
  });

  it('still renders the requested child screen once its chunk resolves', async () => {
    sessionRoles = ['giam_doc_dao_tao'];
    renderHr('/hr/kpi');
    expect(await screen.findByText('KPI_PAGE')).toBeInTheDocument();
  });
});

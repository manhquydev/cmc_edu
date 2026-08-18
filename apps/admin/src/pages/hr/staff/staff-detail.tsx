// Staff detail shell — one layout owns user.get + identity + tabs (D1).
//
// /hr/staff/:staffId redirects here to /profile; each durable section is a
// route-owned child (profile, access) rendering through <Outlet/>. The shell
// hydrates the record once via user.get (cold start, no list cache), renders
// loading / not-found / forbidden states, and provides a validated same-origin
// return context for Back/breadcrumb (direct/F5//go falls back to /hr/staff).

import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, DetailPage, EmptyState, EntityHeader, LineIcon, PageHeader, ResultPanel, Text } from '@cmc/ui';
import { formatRole } from '@cmc/auth';
import { UUID_RE, staffListPath } from '@cmc/links';
import { trpc } from '../../../lib/trpc.js';
import { useSession } from '../../../lib/session-context.js';

/** Validate a same-origin return context carried in router state: only
 *  `{ pathname, search }` from our own list navigation is accepted; anything
 *  else (direct entry, F5, /go) falls back to the canonical list. */
function returnContext(state: unknown): string {
  if (
    state &&
    typeof state === 'object' &&
    'from' in state &&
    (state as { from: unknown }).from !== null &&
    typeof (state as { from: unknown }).from === 'object'
  ) {
    const from = (state as { from: { pathname?: unknown; search?: unknown } }).from;
    const pathname = typeof from.pathname === 'string' ? from.pathname : '';
    const search = typeof from.search === 'string' ? from.search : '';
    // Only accept a same-origin path with a single leading slash (no scheme,
    // no protocol-relative host) — same rule as safeReturnTo for returnTo.
    if (/^\/(?![/\\])/.test(pathname) && !/[\u0000-\u0020\u007f]/.test(pathname)) {
      return `${pathname}${search}`;
    }
  }
  return staffListPath();
}

function StaffDetailLayout() {
  const { staffId = '' } = useParams<{ staffId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const backPath = returnContext(location.state);
  const idOk = UUID_RE.test(staffId);

  const { data, isLoading, error } = trpc.user.get.useQuery(
    { appUserId: staffId },
    { enabled: idOk },
  );

  if (!canDo('user', 'manage')) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên', href: backPath }, { label: 'Hồ sơ' }]}
          />
        }
      >
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý tài khoản (user.manage)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </DetailPage>
    );
  }

  if (!idOk) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên', href: backPath }, { label: 'Không hợp lệ' }]}
          />
        }
      >
        <EmptyState title="ID không hợp lệ" description="URL cần UUID hồ sơ nhân viên." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên', href: backPath }, { label: '…' }]}
          />
        }
      >
        <ResultPanel status="loading" title="Đang tải hồ sơ nhân viên…" />
      </DetailPage>
    );
  }

  if (error || !data) {
    const code = (error?.data as { code?: string } | null | undefined)?.code;
    const isNotFound = code === 'NOT_FOUND';
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên', href: backPath }, { label: 'Lỗi' }]}
          />
        }
      >
        <EmptyState
          title={isNotFound ? 'Không tìm thấy hồ sơ' : 'Không mở được hồ sơ'}
          description={
            isNotFound
              ? 'Nhân viên không tồn tại hoặc thuộc cơ sở khác.'
              : error?.message ?? 'Không tìm thấy hoặc không có quyền xem.'
          }
          action={
            <Link to={backPath}>
              <Button label="Về danh sách" size="sm" variant="secondary" />
            </Link>
          }
        />
      </DetailPage>
    );
  }

  const profileUrl = `/hr/staff/${staffId}/profile`;
  const accessUrl = `/hr/staff/${staffId}/access`;
  const activityUrl = `/hr/staff/${staffId}/activity`;

  const tabs = (
    <nav className="console-section-tabs" aria-label="Phân đoạn hồ sơ">
      <NavLink to={profileUrl} end>
        Hồ sơ
      </NavLink>
      <NavLink to={accessUrl} end>
        Quyền truy cập
      </NavLink>
      <NavLink to={activityUrl} end>
        Lịch sử hoạt động
      </NavLink>
    </nav>
  );

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Nhân sự' },
            { label: 'Nhân viên', href: backPath },
            { label: data.fullName || data.employeeCode },
          ]}
        />
      }
      entity={
        <EntityHeader
          title={data.fullName}
          subtitle={`${data.employeeCode} · ${data.position || '—'}`}
          badges={
            <>
              <Badge
                label={data.isActive ? 'Hoạt động' : 'Vô hiệu'}
                variant={data.isActive ? 'success' : 'neutral'}
              />
              {data.roles.map((r) => (
                <Badge key={r} label={formatRole(r)} variant="info" />
              ))}
            </>
          }
          actions={
            <Button
              label="Về danh sách"
              size="sm"
              variant="secondary"
              onClick={() => navigate(backPath)}
            />
          }
          backHref={backPath}
          backLabel="Danh sách nhân viên"
          meta={
            <Text type="supporting" size="xsm">
              Email: {data.email || '—'}
            </Text>
          }
        />
      }
      tabs={tabs}
    >
      <Suspense fallback={<ResultPanel status="loading" title="Đang tải…" />}>
        <Outlet context={{ staff: data, backPath }} />
      </Suspense>
    </DetailPage>
  );
}

export default StaffDetailLayout;

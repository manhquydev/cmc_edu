import { describe, expect, it } from 'vitest';
import { resolveAdminBreadcrumbHref } from './breadcrumb-routes.js';

describe('resolveAdminBreadcrumbHref', () => {
  it('resolves parent labels registered in the navigation hierarchy', () => {
    expect(resolveAdminBreadcrumbHref({ label: 'Phiếu thu' })).toBe('/finance');
    expect(resolveAdminBreadcrumbHref({ label: 'Bảng lương' })).toBe('/hr/payroll');
    expect(resolveAdminBreadcrumbHref({ label: 'Lịch dạy' })).toBe('/teaching/schedule');
  });

  it('uses an explicit alias only when the route label differs from the page label', () => {
    expect(resolveAdminBreadcrumbHref({ label: 'Engagement' })).toBe('/admin/engagement/rewards');
    expect(resolveAdminBreadcrumbHref({ label: 'Pipeline CRM' })).toBe('/crm');
  });

  it('leaves workflow-dependent labels unresolved for the page to declare explicitly', () => {
    expect(resolveAdminBreadcrumbHref({ label: 'Kinh doanh' })).toBeUndefined();
    expect(resolveAdminBreadcrumbHref({ label: 'Quản trị' })).toBeUndefined();
    expect(resolveAdminBreadcrumbHref({ label: 'toString' })).toBeUndefined();
    expect(resolveAdminBreadcrumbHref({ label: 'constructor' })).toBeUndefined();
    expect(resolveAdminBreadcrumbHref({ label: '__proto__' })).toBeUndefined();
  });
});

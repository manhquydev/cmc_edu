import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';

// No management backend (FacilityNetwork model is read-only during checkin
// punch — checkin/router.ts:48 — no admin CRUD endpoint). Stays a premium
// coming-soon EmptyState; real build deferred to phase-08.
export default function NetworkIpPage() {
  return (
    <>
      <PageHeader
        title="Quản lý IP mạng"
        subtitle="Dải IP được phép chấm công tại cơ sở"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'IP mạng' }]}
      />
      <EmptyState
        title="Tính năng chưa áp dụng"
        description="Quản lý dải IP cho phép chấm công chưa được triển khai tại cơ sở này."
        icon={<LineIcon name="globe" size={28} />}
      />
    </>
  );
}

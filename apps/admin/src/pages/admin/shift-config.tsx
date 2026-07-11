import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';

// Write mutations exist (shift.createGroup/createTemplate —
// shift/router.ts:77,96) but no list/read query, so the screen cannot bind to
// real data. Stays a premium coming-soon EmptyState; real build deferred to
// phase-08.
export default function ShiftConfigPage() {
  return (
    <>
      <PageHeader
        title="Cấu hình ca làm việc"
        subtitle="Thiết lập ca làm việc mặc định cho cơ sở"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Ca làm việc' }]}
      />
      <EmptyState
        title="Tính năng chưa áp dụng"
        description="Cấu hình ca làm việc mặc định chưa được triển khai."
        icon={<LineIcon name="clock" size={28} />}
      />
    </>
  );
}

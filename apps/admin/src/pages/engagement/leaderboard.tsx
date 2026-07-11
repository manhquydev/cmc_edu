import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';

// No backend (no ranked-aggregate endpoint over StarTransaction — scouted in
// plan.md). Stays a premium coming-soon EmptyState; real build deferred to
// phase-08 (needs a new backend aggregate + product spec).
export default function LeaderboardPage() {
  return (
    <>
      <PageHeader
        title="Bảng xếp hạng"
        subtitle="Thứ hạng học viên theo điểm sao tích luỹ"
        breadcrumbs={[
          { label: 'Quản trị' },
          { label: 'Engagement' },
          { label: 'Xếp hạng' },
        ]}
      />
      <EmptyState
        title="Tính năng chưa áp dụng"
        description="Bảng xếp hạng học viên chưa được triển khai tại cơ sở này."
        icon={<LineIcon name="trophy" size={28} />}
      />
    </>
  );
}

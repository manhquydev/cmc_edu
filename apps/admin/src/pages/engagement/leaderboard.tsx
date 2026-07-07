import { EmptyState, PageHeader } from '@cmc/ui';

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
        icon="🏆"
      />
    </>
  );
}

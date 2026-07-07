import { EmptyState, PageHeader } from '@cmc/ui';

export default function RewardsQueuePage() {
  return (
    <>
      <PageHeader
        title="Yêu cầu đổi quà"
        subtitle="Danh sách học viên đang chờ nhận phần thưởng"
        breadcrumbs={[
          { label: 'Quản trị' },
          { label: 'Engagement' },
          { label: 'Đổi quà' },
        ]}
      />
      <EmptyState
        title="Tính năng chưa khả dụng"
        description="API danh sách yêu cầu đổi quà phía nhân viên (rewards.list) chưa được triển khai. Vui lòng kiểm tra lại sau."
        icon="📋"
      />
    </>
  );
}

import { EmptyState, PageHeader } from '@cmc/ui';

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
        icon="⏰"
      />
    </>
  );
}

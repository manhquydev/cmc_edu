import { EmptyState, PageHeader } from '@cmc/ui';

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
        icon="🌐"
      />
    </>
  );
}

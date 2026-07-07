import { DataTable, EmptyState, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface FacilityRow {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<FacilityRow>[] = [
  { key: 'name', label: 'Tên cơ sở' },
  { key: 'code', label: 'Mã cơ sở', width: 160 },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 140,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

// Separate query component so the hook is only called when permission is granted.
function FacilitiesContent() {
  const { data, isLoading, error } = trpc.facility.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  return (
    <>
      <PageHeader
        title="Cơ sở"
        subtitle="Danh sách cơ sở trong hệ thống (Super Admin)"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Cơ sở' }]}
      />
      <DataTable<FacilityRow>
        columns={COLUMNS}
        data={(data?.items as FacilityRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có cơ sở nào"
      />
    </>
  );
}

export default function FacilitiesPage() {
  const { canDo } = useSession();

  if (!canDo('facility', 'list')) {
    return (
      <>
        <PageHeader
          title="Cơ sở"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Cơ sở' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này chỉ dành cho Super Admin."
          icon="🔒"
        />
      </>
    );
  }

  return <FacilitiesContent />;
}

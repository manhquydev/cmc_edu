import { useNavigate } from 'react-router-dom';
import { DataTable, PageHeader, StatusBadge } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface ClassRow {
  id: string;
  code: string;
  program: string;
  status: string;
  startDate: Date;
  endDate: Date;
  teacherId: string | null;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<ClassRow>[] = [
  { key: 'code', label: 'Mã lớp', width: 140 },
  { key: 'program', label: 'Chương trình', width: 120 },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 120,
    render: (v) => <StatusBadge status={String(v)} />,
  },
  {
    key: 'startDate',
    label: 'Bắt đầu',
    width: 130,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
  {
    key: 'endDate',
    label: 'Kết thúc',
    width: 130,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

export default function ClassListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.classBatch.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  return (
    <>
      <PageHeader
        title="Lớp học"
        subtitle="Danh sách lớp học tại cơ sở"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Lớp học' }]}
      />
      <DataTable<ClassRow>
        columns={COLUMNS}
        data={(data?.items as ClassRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có lớp học nào"
        onRowClick={(row) => void navigate(`/admin/classes/${row.id}`)}
      />
    </>
  );
}

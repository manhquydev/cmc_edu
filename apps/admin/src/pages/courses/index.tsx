import { DataTable, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface CourseRow {
  id: string;
  name: string;
  program: string;
  createdAt: Date;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<CourseRow>[] = [
  { key: 'name', label: 'Tên khoá học' },
  { key: 'program', label: 'Chương trình', width: 160 },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 140,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

export default function CourseListPage() {
  const { data, isLoading, error } = trpc.course.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  return (
    <>
      <PageHeader
        title="Khoá học"
        subtitle="Danh mục khoá học tại cơ sở"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Khoá học' }]}
      />
      <DataTable<CourseRow>
        columns={COLUMNS}
        data={(data?.items as CourseRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có khoá học nào"
      />
    </>
  );
}

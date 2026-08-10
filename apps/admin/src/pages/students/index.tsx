import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { links } from '@cmc/links';
import {
  BulkActionBar,
  Button,
  DataTable,
  FilterBar,
  HStack,
  ListPage,
  ListPagination,
  PageHeader,
  StatusBadge,
  Text,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface StudentRow {
  id: string;
  fullName: string;
  lifecycle: string;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<StudentRow>[] = [
  { key: 'fullName', label: 'Họ tên' },
  {
    key: 'lifecycle',
    label: 'Trạng thái',
    width: 140,
    render: (v) => <StatusBadge status={String(v)} />,
  },
];

const STUDENT_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên hoặc SĐT phụ huynh (≥2 ký tự)',
  },
];

export default function StudentListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string>>({ q: '' });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageSize = 10;
  const { success: toastSuccess } = useToast();

  const submitted = (filters.q ?? '').trim();
  // Detect phone (starts with digit) vs name search.
  const lookupInput = /^\d/.test(submitted)
    ? { phone: submitted }
    : { name: submitted };

  const { data, isLoading, error } = trpc.student.lookup.useQuery(lookupInput, {
    enabled: submitted.length >= 2,
  });

  const allRows = (data as StudentRow[] | undefined) ?? [];
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);

  function handleFilterChange(next: Record<string, string>) {
    setFilters({ q: next.q ?? '' });
    setPage(1);
    setSelectedIds([]);
  }

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Học viên"
          subtitle="Tối đa 20 kết quả mỗi lần tra cứu"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Học viên' }]}
        />
      }
      filters={
        <FilterBar filters={STUDENT_FILTERS} value={filters} onChange={handleFilterChange} />
      }
      controlFooter={
        submitted.length >= 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cmc-space-2)', width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Sao chép tên"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0}
                onClick={() => {
                  const names = allRows
                    .filter((r) => selectedIds.includes(r.id))
                    .map((r) => r.fullName);
                  void navigator.clipboard?.writeText(names.join(', '));
                  toastSuccess(`Đã sao chép ${names.length} tên học viên`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={allRows.length}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds([]);
              }}
            />
          </div>
        ) : undefined
      }
    >
      {submitted.length < 2 ? (
        <HStack padding={4}>
          <Text type="supporting" size="sm">
            Nhập ít nhất 2 ký tự để tìm kiếm.
          </Text>
        </HStack>
      ) : (
        <DataTable<StudentRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Không tìm thấy học viên"
          onRowClick={(row) =>
            void navigate(links.student(row.id), { state: { student: row } })
          }
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}
    </ListPage>
  );
}

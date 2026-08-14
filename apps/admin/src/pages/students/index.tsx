import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { links } from '@cmc/links';
import {
  BulkActionBar,
  Button,
  DataTable,
  FilterBar,
  HStack,
  KanbanRecordCard,
  KanbanRecordGrid,
  ListPage,
  ListPagination,
  PageHeader,
  StatusBadge,
  Text,
  ViewSwitcher,
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

const LIFECYCLE_LABELS: Record<string, string> = {
  active: 'Đang học',
  blocked_lms: 'Khóa LMS',
  withdrawn: 'Rút học',
};

const COLUMNS: TableColumn<StudentRow>[] = [
  { key: 'fullName', label: 'Họ tên' },
  {
    key: 'lifecycle',
    label: 'Trạng thái',
    width: 140,
    render: (v) => (
      <StatusBadge status={String(v)} label={LIFECYCLE_LABELS[String(v)] ?? String(v)} />
    ),
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

type StudentView = 'table' | 'kanban';

export default function StudentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Record<string, string>>({ q: '' });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageSize = 10;
  const { success: toastSuccess } = useToast();
  const rawView = searchParams.get('view');
  const view: StudentView = rawView === 'kanban' ? 'kanban' : 'table';

  function setView(next: StudentView) {
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    setSearchParams(params, { replace: true });
  }

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
      views={
        <ViewSwitcher
          value={view}
          onChange={setView}
          aria-label="Chế độ xem học viên"
          items={[
            { id: 'table' as const, label: 'Xem dạng danh sách', icon: 'list' },
            { id: 'kanban' as const, label: 'Xem dạng kanban', icon: 'kanban' },
          ]}
        />
      }
      controlFooter={
        submitted.length >= 2 ? (
          <div className="console-cp-footer-cluster">
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
      ) : view === 'kanban' ? (
        <KanbanRecordGrid>
          {rows.map((row) => (
            <KanbanRecordCard
              key={row.id}
              title={row.fullName}
              subtitle={LIFECYCLE_LABELS[row.lifecycle] ?? row.lifecycle}
              onClick={() =>
                void navigate(links.student(row.id), { state: { student: row } })
              }
            />
          ))}
        </KanbanRecordGrid>
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
          columnConfigurator
        />
      )}
    </ListPage>
  );
}

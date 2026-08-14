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

/** Mirrors `LOOKUP_LIMIT` in `apps/api/src/student/router.ts` — a capped lookup. */
const LOOKUP_LIMIT = 20;

/**
 * `student.lookup` answers one question: does anyone match this string. It never
 * says how many students the facility has, so an empty result cannot claim
 * `first-run` (nothing ever created) or `filtered` (rows exist outside the
 * filter). A bare string publishes no `kind` and therefore claims neither.
 */
const NO_MATCH_EMPTY =
  'Không tìm thấy học viên khớp từ khóa này. Thử tên đầy đủ hơn hoặc SĐT phụ huynh.';

/**
 * A full result set is the cap talking, not a match count — the pager's
 * `1–10 / 20` would otherwise read as "20 students match".
 */
const CAP_NOTICE =
  `Đã tới giới hạn ${LOOKUP_LIMIT} kết quả tra cứu — có thể còn học viên khớp ` +
  'chưa hiện ở đây. Thu hẹp từ khóa để chắc chắn.';

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
  // At the cap the result set may be truncated, so the pager total (20) is a
  // ceiling, not a count of matches. Say so instead of letting "/ 20" imply one.
  const cappedResults = allRows.length >= LOOKUP_LIMIT;

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
          subtitle={`Tối đa ${LOOKUP_LIMIT} kết quả mỗi lần tra cứu`}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--cmc-space-1)',
              width: '100%',
            }}
          >
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
            {cappedResults ? (
              <Text type="supporting" size="sm">
                {CAP_NOTICE}
              </Text>
            ) : null}
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
        // A failed lookup is not an absence, so it never borrows the empty copy.
        error ? (
          <HStack padding={4}>
            <Text type="supporting" size="sm">
              {`Không tải được danh sách học viên: ${error.message}`}
            </Text>
          </HStack>
        ) : rows.length === 0 && !isLoading ? (
          <HStack padding={4}>
            <Text type="supporting" size="sm">
              {NO_MATCH_EMPTY}
            </Text>
          </HStack>
        ) : (
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
        )
      ) : (
        <DataTable<StudentRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty={NO_MATCH_EMPTY}
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

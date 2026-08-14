// Course catalogue — GĐĐT manages facility courses (course.manage).
// Create dialog was a documented gap (acceptance DOCUMENTED_GAPS.course.create):
// API course.create existed while this page was list-only.

import { useEffect, useState } from 'react';
import {
  Banner,
  Button,
  CategoryChip,
  DataTable,
  Dialog,
  DialogHeader,
  FilterBar,
  HStack,
  ListPage,
  ListPagination,
  PageHeader,
  Selector,
  Stack,
  TextInput,
} from '@cmc/ui';
import type { CategoryId, FilterDef, TableColumn, TableEmptySpec } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

/** Mirrors apps/api/src/class/program.ts PROGRAM_VALUES — keep labels user-facing. */
const PROGRAM_OPTIONS = [
  { value: 'UCREA', label: 'UCREA' },
  { value: 'BRIGHT_IG', label: 'BRIGHT_IG' },
  { value: 'BLACK_HOLE', label: 'BLACK_HOLE' },
] as const;

/** Documented in design-lab/system/BRIDGE.md — program → CategoryChip map. */
const PROGRAM_CATEGORY: Record<(typeof PROGRAM_OPTIONS)[number]['value'], CategoryId> = {
  UCREA: 'a',
  BRIGHT_IG: 'b',
  BLACK_HOLE: 'c',
};

const COURSE_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên khoá học…',
  },
  {
    key: 'program',
    label: 'Chương trình',
    type: 'select',
    options: PROGRAM_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    placeholder: 'Tất cả',
  },
];

interface CourseRow {
  id: string;
  name: string;
  program: string;
  createdAt: Date;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<CourseRow>[] = [
  { key: 'name', label: 'Tên khoá học' },
  {
    key: 'program',
    label: 'Chương trình',
    width: 160,
    render: (v) => {
      const program = String(v);
      const category = PROGRAM_CATEGORY[program as keyof typeof PROGRAM_CATEGORY];
      if (!category) return program;
      return <CategoryChip category={category} label={program} size="sm" />;
    },
  },
  {
    key: 'createdAt',
    label: 'Ngày tạo',
    width: 140,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

export default function CourseListPage() {
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [program, setProgram] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const pageSize = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, programFilter]);

  const { data, isLoading, error } = trpc.course.list.useQuery({
    page,
    pageSize,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(programFilter
      ? { program: programFilter as 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE' }
      : {}),
  });

  const createMut = trpc.course.create.useMutation({
    onSuccess: () => {
      void utils.course.list.invalidate();
      closeCreate();
    },
  });

  function closeCreate() {
    setCreateOpen(false);
    setProgram(null);
    setName('');
    createMut.reset();
  }

  const isFormValid = Boolean(program && name.trim().length > 0);

  const rows = (data?.items as CourseRow[] | undefined) ?? [];
  const total = data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!data) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  // Use debounced/applied filters only — raw searchInput would lie during debounce.
  const filtersActive = Boolean(debouncedSearch) || Boolean(programFilter);
  const listEmpty: string | TableEmptySpec =
    total > 0
      ? 'Không có dòng trên trang này'
      : !filtersActive
        ? {
            kind: 'first-run',
            title: 'Chưa có khoá học nào',
            description: 'Tạo khoá đầu tiên cho cơ sở trước khi gán vào lớp.',
            action: (
              <Button label="+ Tạo khoá" size="sm" variant="primary" onClick={() => setCreateOpen(true)} />
            ),
          }
        : 'Không có khoá học khớp bộ lọc hiện tại';

  function handleCreate() {
    if (!program || !name.trim()) return;
    createMut.mutate({ program: program as 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE', name: name.trim() });
  }

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Khoá học"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Khoá học' }]}
            actions={
              <Button
                label="+ Tạo khoá"
                size="sm"
                variant="primary"
                onClick={() => setCreateOpen(true)}
              />
            }
          />
        }
        filters={
          <FilterBar
            filters={COURSE_FILTERS}
            value={{ q: searchInput, program: programFilter }}
            onChange={(next) => {
              setSearchInput(next.q ?? '');
              setProgramFilter(next.program ?? '');
            }}
          />
        }
        controlFooter={
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={data?.total ?? data?.items?.length ?? 0}
            onPageChange={setPage}
          />
        }
      >
        <DataTable<CourseRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty={listEmpty}
        />
      </ListPage>

      <Dialog
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next) closeCreate();
        }}
        purpose="form"
        width={480}
      >
        <DialogHeader
          title="Tạo khoá học"
          onOpenChange={(next) => {
            if (!next) closeCreate();
          }}
        />
        <Stack gap={2} padding={4}>
          <Selector
            label="Chương trình"
            placeholder="Chọn chương trình"
            isRequired
            options={[...PROGRAM_OPTIONS]}
            value={program ?? undefined}
            onChange={(v) => setProgram(v ?? null)}
            hasClear={false}
          />
          <TextInput
            label="Tên khoá học"
            placeholder="VD: UCREA Sáng tạo 1"
            isRequired
            value={name}
            onChange={setName}
          />
          {createMut.error && (
            <Banner status="error" title="Không tạo được khoá" description={createMut.error.message} />
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
            <Button label="Hủy" variant="secondary" onClick={closeCreate} isDisabled={createMut.isPending} />
            <Button
              label="Tạo"
              variant="primary"
              onClick={handleCreate}
              isLoading={createMut.isPending}
              isDisabled={!isFormValid}
            />
          </HStack>
        </Stack>
      </Dialog>
    </>
  );
}

// Course catalogue — GĐĐT manages facility courses (course.manage).
// Create dialog was a documented gap (acceptance DOCUMENTED_GAPS.course.create):
// API course.create existed while this page was list-only.

import { useState } from 'react';
import {
  Banner,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  HStack,
  ListPage,
  ListPagination,
  PageHeader,
  Selector,
  Stack,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

/** Mirrors apps/api/src/class/program.ts PROGRAM_VALUES — keep labels user-facing. */
const PROGRAM_OPTIONS = [
  { value: 'UCREA', label: 'UCREA' },
  { value: 'BRIGHT_IG', label: 'BRIGHT_IG' },
  { value: 'BLACK_HOLE', label: 'BLACK_HOLE' },
] as const;

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
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [program, setProgram] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = trpc.course.list.useQuery({
    page,
    pageSize,
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
            subtitle="Danh mục khoá học tại cơ sở"
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
          data={(data?.items as CourseRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có khoá học nào"
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
          <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
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

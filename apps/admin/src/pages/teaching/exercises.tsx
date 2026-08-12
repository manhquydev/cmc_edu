// Exercise library — folders on the left, exercises on the right.
// exercise.manage = giam_doc_dao_tao. Archive hides a folder from new writes
// and does not rewrite ClassExerciseItem rows already frozen on a class.
// Publish / close stay on /teaching/exercises/:exerciseId (resource-centric).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogHeader,
  EmptyState,
  FilterBar,
  HStack,
  ListPage,
  ListPagination,
  MasterDetail,
  PageHeader,
  Selector,
  Skeleton,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { links } from '@cmc/links';
import { trpc } from '../../lib/trpc.js';

const API_URL = ((import.meta.env['VITE_API_URL'] as string | undefined) ?? '').trim();

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'neutral',
  published: 'success',
  closed: 'error',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đã công bố',
  closed: 'Đã đóng',
};

const EXERCISE_TYPE_OPTIONS = [
  { value: 'homework', label: 'Bài tập về nhà' },
  { value: 'test_entrance', label: 'Kiểm tra đầu vào' },
  { value: 'test_periodic', label: 'Kiểm tra định kỳ' },
];

const EXERCISE_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên bài tập…',
  },
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: [
      { value: 'draft', label: 'Nháp' },
      { value: 'published', label: 'Đã công bố' },
      { value: 'closed', label: 'Đã đóng' },
    ],
    placeholder: 'Tất cả',
  },
  {
    key: 'type',
    label: 'Loại',
    type: 'select',
    options: EXERCISE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    placeholder: 'Tất cả',
  },
];

interface FolderRow {
  id: string;
  name: string;
  description: string | null;
  archivedAt: Date | string | null;
}

interface ExerciseRow {
  id: string;
  folderId: string;
  title: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

export default function ExercisesPage() {
  const navigate = useNavigate();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<'create' | 'rename' | null>(null);
  const [folderName, setFolderName] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [exerciseTitle, setExerciseTitle] = useState('');
  const [exerciseType, setExerciseType] = useState<string | null>(null);
  const [pdfBlobRef, setPdfBlobRef] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const pageSize = 20;
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { success: toastSuccess } = useToast();

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, searchQuery, selectedFolderId]);

  const { data: foldersData, isLoading: foldersLoading, error: foldersError } =
    trpc.exerciseFolder.list.useQuery();
  const folders = (foldersData?.items ?? []) as FolderRow[];

  useEffect(() => {
    if (selectedFolderId) return;
    const firstLive = folders.find((f) => !f.archivedAt);
    const first = firstLive ?? folders[0];
    if (first) setSelectedFolderId(first.id);
  }, [folders, selectedFolderId]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const folderArchived = selectedFolder?.archivedAt != null;

  const { data, isLoading, error } = trpc.exercise.list.useQuery(
    {
      ...(selectedFolderId ? { folderId: selectedFolderId } : {}),
      ...(statusFilter
        ? { status: statusFilter as 'draft' | 'published' | 'closed' }
        : {}),
      ...(typeFilter
        ? { type: typeFilter as 'homework' | 'test_entrance' | 'test_periodic' }
        : {}),
    },
    { enabled: selectedFolderId != null },
  );

  const createFolderMut = trpc.exerciseFolder.create.useMutation({
    onSuccess: (created) => {
      void utils.exerciseFolder.list.invalidate();
      setFolderDialog(null);
      setFolderName('');
      setSelectedFolderId(created.id);
      toastSuccess('Đã tạo thư mục');
    },
  });

  const renameFolderMut = trpc.exerciseFolder.update.useMutation({
    onSuccess: () => {
      void utils.exerciseFolder.list.invalidate();
      void utils.exercise.list.invalidate();
      setFolderDialog(null);
      setFolderName('');
      toastSuccess('Đã đổi tên thư mục');
    },
  });

  const archiveFolderMut = trpc.exerciseFolder.archive.useMutation({
    onSuccess: () => {
      void utils.exerciseFolder.list.invalidate();
      setArchiveOpen(false);
      toastSuccess('Đã ẩn thư mục. Dãy bài đã gán của lớp không đổi.');
    },
  });

  const createMut = trpc.exercise.create.useMutation({
    onSuccess: () => {
      void utils.exercise.list.invalidate();
      setCreateOpen(false);
      resetCreateForm();
      toastSuccess('Đã tạo bài tập');
    },
  });

  const folderWriteError =
    (folderDialog === 'rename' ? renameFolderMut.error : createFolderMut.error) ?? null;
  const createError = createMut.error;

  function openExercise(row: ExerciseRow) {
    navigate(links.exercise(row.id));
  }

  function resetCreateForm() {
    setExerciseTitle('');
    setExerciseType(null);
    setPdfBlobRef(null);
    setPdfError(null);
  }

  function closeCreateDialog() {
    setCreateOpen(false);
    resetCreateForm();
  }

  function openCreateFolder() {
    setFolderName('');
    setFolderDialog('create');
  }

  function openRenameFolder() {
    setFolderName(selectedFolder?.name ?? '');
    setFolderDialog('rename');
  }

  function closeFolderDialog() {
    setFolderDialog(null);
    setFolderName('');
  }

  async function handlePdfUpload(file: File) {
    setPdfUploading(true);
    setPdfError(null);
    try {
      const buf = await file.arrayBuffer();
      const resp = await fetch(`${API_URL}/upload/exercise-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        credentials: 'include',
        body: buf,
      });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const { blobRef } = (await resp.json()) as { blobRef: string };
      setPdfBlobRef(blobRef);
    } catch (e: unknown) {
      setPdfError(e instanceof Error ? e.message : 'Upload thất bại');
    } finally {
      setPdfUploading(false);
    }
  }

  const q = searchQuery.trim().toLocaleLowerCase('vi');
  const exercises = useMemo(() => {
    const rows = (data?.items ?? []) as ExerciseRow[];
    if (!q) return rows;
    return rows.filter((row) => row.title.toLocaleLowerCase('vi').includes(q));
  }, [data?.items, q]);
  const pageRows = exercises.slice((page - 1) * pageSize, page * pageSize);

  const columns: TableColumn<ExerciseRow>[] = [
    { key: 'title', label: 'Tên bài' },
    {
      key: 'type',
      label: 'Loại',
      width: 180,
      render: (v) => EXERCISE_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? String(v),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 140,
      render: (v) => (
        <Badge
          label={STATUS_LABELS[v as string] ?? String(v)}
          variant={STATUS_VARIANTS[v as string] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'id',
      label: 'Thao tác',
      width: 120,
      render: (_v, row) => (
        <Button label="Mở phiếu" size="sm" variant="primary" onClick={() => openExercise(row)} />
      ),
    },
  ];

  const folderPanel = (
    <Stack gap={0}>
      <HStack
        justify="between"
        style={{
          paddingInline: 'var(--cmc-space-3)',
          paddingBlock: 'var(--cmc-space-2)',
          borderBottom: '1px solid var(--cmc-border)',
        }}
      >
        <Text size="sm" weight="medium">
          Thư mục
        </Text>
        <Button label="+ Thư mục" size="sm" variant="ghost" onClick={openCreateFolder} />
      </HStack>
      {foldersLoading && (
        <div style={{ margin: 'var(--cmc-space-3)' }}>
          <Skeleton height={160} radius={1} />
        </div>
      )}
      {foldersError && (
        <div style={{ margin: 'var(--cmc-space-3)' }}>
          <Banner status="error" title={foldersError.message} />
        </div>
      )}
      {!foldersLoading && !foldersError && folders.length === 0 && (
        <div style={{ padding: 'var(--cmc-space-3)' }}>
          <EmptyState
            title="Chưa có thư mục"
            description='Nhấn "+ Thư mục" để tạo thư mục đầu tiên.'
          />
        </div>
      )}
      {!foldersLoading &&
        !foldersError &&
        folders.map((folder) => {
          const selected = folder.id === selectedFolderId;
          const archived = folder.archivedAt != null;
          return (
            <div
              key={folder.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedFolderId(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedFolderId(folder.id);
                }
              }}
              style={{
                paddingInline: 'var(--cmc-space-3)',
                paddingBlock: 'var(--cmc-space-2)',
                borderBottom: '1px solid var(--cmc-border)',
                cursor: 'pointer',
                background: selected ? 'var(--cmc-brand-muted)' : 'var(--cmc-surface)',
                borderLeft: selected ? '3px solid var(--cmc-brand)' : '3px solid transparent',
              }}
            >
              <HStack justify="between" style={{ marginBottom: archived ? 2 : 0 }}>
                <Text size="sm" weight="medium">
                  {folder.name}
                </Text>
                {archived ? <Badge label="Đã ẩn" variant="neutral" /> : null}
              </HStack>
            </div>
          );
        })}
    </Stack>
  );

  const listPanel = !selectedFolder ? (
    <div style={{ padding: 'var(--cmc-space-3)' }}>
      <EmptyState title="Chọn một thư mục" description="Chọn thư mục bên trái để xem bài tập." />
    </div>
  ) : (
    <Stack gap={0}>
      <HStack
        justify="between"
        style={{
          paddingInline: 'var(--cmc-space-3)',
          paddingBlock: 'var(--cmc-space-2)',
          borderBottom: '1px solid var(--cmc-border)',
          flexWrap: 'wrap',
          gap: 'var(--cmc-space-2)',
        }}
      >
        <Stack gap={0}>
          <Text size="sm" weight="medium">
            {selectedFolder.name}
          </Text>
          {folderArchived ? (
            <Text type="supporting" size="xsm">
              Thư mục đã ẩn — không thêm bài mới. Dãy lớp không đổi.
            </Text>
          ) : null}
        </Stack>
        <HStack gap={1} style={{ flexWrap: 'wrap' }}>
          <Button label="Đổi tên" size="sm" variant="secondary" onClick={openRenameFolder} />
          <Button
            label="Ẩn thư mục"
            size="sm"
            variant="ghost"
            isDisabled={folderArchived}
            onClick={() => setArchiveOpen(true)}
          />
          <Button
            label="+ Tạo bài tập"
            size="sm"
            variant="primary"
            isDisabled={folderArchived}
            onClick={() => setCreateOpen(true)}
          />
        </HStack>
      </HStack>

      {isLoading && (
        <div style={{ margin: 'var(--cmc-space-3)' }}>
          <Skeleton height={200} radius={1} />
        </div>
      )}
      {error && (
        <div style={{ margin: 'var(--cmc-space-3)' }}>
          <Banner status="error" title={error.message} />
        </div>
      )}
      {!isLoading && !error && (
        <>
          <DataTable<ExerciseRow>
            columns={columns}
            data={pageRows}
            empty={
              q || statusFilter || typeFilter
                ? 'Không có bài khớp bộ lọc hiện tại.'
                : 'Chưa có bài tập trong thư mục này. Nhấn "Tạo bài tập" để tải lên.'
            }
            onRowClick={openExercise}
          />
          <div style={{ padding: 'var(--cmc-space-3)' }}>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={exercises.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </Stack>
  );

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Thư viện bài tập"
          subtitle="Thư mục bên trái · bài tập bên phải. Ẩn thư mục không đụng dãy đã gán."
          breadcrumbs={[{ label: 'Giảng dạy', href: '/teaching' }, { label: 'Bài tập' }]}
        />
      }
      filters={
        <FilterBar
          filters={EXERCISE_FILTERS}
          value={{ q: searchQuery, status: statusFilter, type: typeFilter }}
          onChange={(next) => {
            setSearchQuery(next.q ?? '');
            setStatusFilter(next.status ?? '');
            setTypeFilter(next.type ?? '');
          }}
        />
      }
    >
      <div
        style={{
          flex: 1,
          minHeight: 520,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MasterDetail
          list={folderPanel}
          detail={listPanel}
          selectedId={selectedFolderId ?? undefined}
          listWidth={280}
        />
      </div>

      <Dialog
        purpose="form"
        isOpen={folderDialog != null}
        onOpenChange={(next) => {
          if (!next) closeFolderDialog();
        }}
        width={420}
      >
        <DialogHeader
          title={folderDialog === 'rename' ? 'Đổi tên thư mục' : 'Tạo thư mục'}
          onOpenChange={(next) => {
            if (!next) closeFolderDialog();
          }}
        />
        <Stack gap={2}>
          {folderWriteError ? <Banner status="error" title={folderWriteError.message} /> : null}
          <TextInput
            label="Tên thư mục"
            placeholder="VD: UCREA tháng 3"
            value={folderName}
            onChange={setFolderName}
          />
          <HStack justify="end" gap={2} style={{ flexWrap: 'wrap' }}>
            <Button label="Huỷ" variant="secondary" size="sm" onClick={closeFolderDialog} />
            <Button
              label={folderDialog === 'rename' ? 'Lưu tên' : 'Tạo thư mục'}
              variant="primary"
              size="sm"
              isLoading={createFolderMut.isPending || renameFolderMut.isPending}
              isDisabled={!folderName.trim()}
              onClick={() => {
                const name = folderName.trim();
                if (!name) return;
                if (folderDialog === 'rename' && selectedFolderId) {
                  renameFolderMut.mutate({ folderId: selectedFolderId, name });
                  return;
                }
                createFolderMut.mutate({ name });
              }}
            />
          </HStack>
        </Stack>
      </Dialog>

      <ConfirmDialog
        opened={archiveOpen}
        title="Ẩn thư mục này?"
        message="Thư mục sẽ không nhận bài mới. Dãy bài đã gán cho lớp không đổi — bài vẫn phát và nộp như cũ."
        confirmLabel="Ẩn thư mục"
        confirmColor="red"
        loading={archiveFolderMut.isPending}
        onConfirm={() => {
          if (!selectedFolderId) return;
          archiveFolderMut.mutate({ folderId: selectedFolderId });
        }}
        onCancel={() => setArchiveOpen(false)}
      />

      <Dialog
        purpose="form"
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next) closeCreateDialog();
        }}
        width={480}
      >
        <DialogHeader
          title="Tải bài lên thư mục"
          onOpenChange={(next) => {
            if (!next) closeCreateDialog();
          }}
        />
        <Stack gap={2}>
          {createError ? <Banner status="error" title={createError.message} /> : null}
          <Text type="supporting" size="sm">
            Thư mục: {selectedFolder?.name ?? '—'}
          </Text>
          <TextInput
            label="Tên bài tập"
            placeholder="VD: Bài tập buổi 1"
            value={exerciseTitle}
            onChange={setExerciseTitle}
          />
          <Selector
            label="Loại bài tập"
            placeholder="Chọn loại"
            options={EXERCISE_TYPE_OPTIONS}
            value={exerciseType ?? undefined}
            onChange={(v) => setExerciseType(v ?? null)}
            hasClear={false}
            isRequired
          />
          <div>
            <Text type="body" size="sm" weight="medium" style={{ marginBottom: 'var(--cmc-space-1)' }}>
              File PDF bài tập (bắt buộc)
            </Text>
            {pdfError && (
              <div style={{ marginBottom: 'var(--cmc-space-2)' }}>
                <Banner status="error" title={pdfError} />
              </div>
            )}
            {pdfBlobRef ? (
              <HStack gap={1}>
                <Badge label="PDF đã upload" variant="success" />
                <Button label="Đổi file" size="sm" variant="ghost" onClick={() => setPdfBlobRef(null)} />
              </HStack>
            ) : (
              <Button
                label={pdfUploading ? 'Đang upload…' : 'Chọn file PDF'}
                size="sm"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                isDisabled={pdfUploading}
                isLoading={pdfUploading}
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (file) await handlePdfUpload(file);
                input.value = '';
              }}
            />
          </div>
          <HStack justify="end" gap={2} style={{ flexWrap: 'wrap' }}>
            <Button label="Huỷ" variant="secondary" size="sm" onClick={closeCreateDialog} />
            <Button
              label="Tạo bài tập"
              variant="primary"
              size="sm"
              isLoading={createMut.isPending}
              isDisabled={!selectedFolderId || folderArchived || !exerciseTitle.trim() || !exerciseType || !pdfBlobRef}
              onClick={() => {
                if (!selectedFolderId || !exerciseType || !pdfBlobRef) return;
                const title = exerciseTitle.trim();
                if (!title) return;
                createMut.mutate({
                  folderId: selectedFolderId,
                  title,
                  type: exerciseType as 'homework' | 'test_entrance' | 'test_periodic',
                  basePdfRef: pdfBlobRef,
                });
              }}
            />
          </HStack>
        </Stack>
      </Dialog>
    </ListPage>
  );
}

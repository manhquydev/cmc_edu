// Exercise management — director creates exercises linked to CurriculumUnits.
// exercise.manage permission = giam_doc_dao_tao only.

import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Badge,
  Banner,
  BulkActionBar,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogHeader,
  HStack,
  ListPage,
  ListPagination,
  PageHeader,
  Selector,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

const API_URL = ((import.meta.env['VITE_API_URL'] as string | undefined) ?? '').trim();

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'neutral',
  published: 'success',
  closed: 'error',
};

const EXERCISE_TYPE_OPTIONS = [
  { value: 'homework', label: 'Bài tập về nhà' },
  { value: 'test_entrance', label: 'Kiểm tra đầu vào' },
  { value: 'test_periodic', label: 'Kiểm tra định kỳ' },
];

interface ExerciseRow {
  id: string;
  curriculumUnitId: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

export default function ExercisesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [curriculumUnitId, setCurriculumUnitId] = useState<string | null>(null);
  const [exerciseType, setExerciseType] = useState<string | null>(null);
  const [pdfBlobRef, setPdfBlobRef] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageSize = 20;
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { success: toastSuccess } = useToast();

  const { data: unitsData, isLoading: unitsLoading } = trpc.curriculumUnit.list.useQuery();
  const { data, isLoading, error } = trpc.exercise.list.useQuery({});

  const createMut = trpc.exercise.create.useMutation({
    onSuccess: () => {
      void utils.exercise.list.invalidate();
      setCreateOpen(false);
      resetForm();
    },
  });
  const publishMut = trpc.exercise.publish.useMutation({
    onSuccess: () => {
      void utils.exercise.list.invalidate();
      setPendingPublishId(null);
      toastSuccess('Đã công bố bài tập');
    },
  });
  const closeMut = trpc.exercise.close.useMutation({
    onSuccess: () => {
      void utils.exercise.list.invalidate();
      setPendingCloseId(null);
      toastSuccess('Đã đóng bài tập');
    },
  });

  function resetForm() {
    setCurriculumUnitId(null);
    setExerciseType(null);
    setPdfBlobRef(null);
    setPdfError(null);
  }

  function closeDialog() {
    setCreateOpen(false);
    resetForm();
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

  const units = unitsData?.items ?? [];
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: `${u.program} – Lv${u.level} T${u.monthIndex}: ${u.title}`,
  }));

  const exercises = (data?.items ?? []) as ExerciseRow[];
  const pageRows = exercises.slice((page - 1) * pageSize, page * pageSize);

  const columns: TableColumn<ExerciseRow>[] = [
    {
      key: 'curriculumUnitId',
      label: 'Đơn vị học',
      render: (v) => {
        const unit = unitMap.get(v as string);
        return unit
          ? `${unit.program} Lv${unit.level} T${unit.monthIndex}: ${unit.title}`
          : String(v);
      },
    },
    {
      key: 'type',
      label: 'Loại',
      render: (v) => EXERCISE_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? String(v),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 120,
      render: (v) => <Badge label={String(v)} variant={STATUS_VARIANTS[v as string] ?? 'neutral'} />,
    },
    {
      key: 'id',
      label: 'Thao tác',
      render: (_v, row) => (
        <HStack gap={1}>
          {row.status === 'draft' && (
            <Button
              label="Công bố"
              size="sm"
              variant="primary"
              isLoading={publishMut.isPending && pendingPublishId === row.id}
              onClick={() => setPendingPublishId(row.id)}
            />
          )}
          {row.status === 'published' && (
            <Button
              label="Đóng"
              size="sm"
              variant="destructive"
              isLoading={closeMut.isPending && pendingCloseId === row.id}
              onClick={() => setPendingCloseId(row.id)}
            />
          )}
        </HStack>
      ),
    },
  ];

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Quản lý bài tập"
          breadcrumbs={[{ label: 'Giảng dạy', href: '/teaching' }, { label: 'Bài tập' }]}
          actions={
            <Button label="+ Tạo bài tập" size="sm" variant="primary" onClick={() => setCreateOpen(true)} />
          }
        />
      }
      controlFooter={
        !isLoading && !error ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Sao chép ID"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0}
                onClick={() => {
                  void navigator.clipboard?.writeText(selectedIds.join(', '));
                  toastSuccess(`Đã sao chép ${selectedIds.length} ID bài tập`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={exercises.length}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds([]);
              }}
            />
          </div>
        ) : undefined
      }
    >
      {isLoading && (
        <div style={{ margin: 16 }}>
          <Skeleton height={200} radius={1} />
        </div>
      )}
      {error && (
        <div style={{ margin: 16 }}>
          <Banner status="error" title={error.message} />
        </div>
      )}

      {!isLoading && !error && (
        <DataTable<ExerciseRow>
          columns={columns}
          data={pageRows}
          empty='Chưa có bài tập nào. Nhấn "Tạo bài tập" để bắt đầu.'
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Create dialog.
          TODO(astryx-review): Astryx `Dialog` (native <dialog>-based) manages
          its own focus-trap / auto-focus / Escape-dismiss internally —
          different implementation from the prior `Modal`, though the
          resulting close-on-backdrop/Escape UX is preserved. Flagged per
          migration instructions as "any modal that isn't a simple confirm"
          for reviewer sign-off (same class of flag as EnrollPicker). */}
      <Dialog isOpen={createOpen} onOpenChange={(next) => { if (!next) closeDialog(); }} width={480}>
        <DialogHeader title="Tạo bài tập mới" onOpenChange={(next) => { if (!next) closeDialog(); }} />
        <Stack gap={2}>
          {unitsLoading ? (
            <Skeleton height={36} radius={1} />
          ) : (
            <Selector
              label="Đơn vị học (CurriculumUnit)"
              placeholder="Chọn chương trình / tháng / bài"
              options={unitOptions}
              value={curriculumUnitId ?? undefined}
              onChange={(v) => setCurriculumUnitId(v ?? null)}
              hasSearch
              hasClear={false}
              isRequired
            />
          )}

          <Selector
            label="Loại bài tập"
            placeholder="Chọn loại"
            options={EXERCISE_TYPE_OPTIONS}
            value={exerciseType ?? undefined}
            onChange={(v) => setExerciseType(v ?? null)}
            hasClear={false}
            isRequired
          />

          {/* PDF upload — required */}
          <div>
            <Text type="body" size="sm" weight="medium" style={{ marginBottom: 4 }}>
              File PDF bài tập (bắt buộc)
            </Text>
            {pdfError && (
              <div style={{ marginBottom: 8 }}>
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
                // Capture the input node before the await; React nulls
                // `e.currentTarget` after the handler yields (same class of
                // bug fixed in session-evidence.tsx during phase-07).
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (file) await handlePdfUpload(file);
                input.value = '';
              }}
            />
          </div>

          <HStack justify="end" gap={2} style={{ flexWrap: 'wrap' }}>
            <Button label="Huỷ" variant="secondary" size="sm" onClick={closeDialog} />
            <Button
              label="Tạo bài tập"
              variant="primary"
              size="sm"
              isLoading={createMut.isPending}
              isDisabled={!curriculumUnitId || !exerciseType || !pdfBlobRef}
              onClick={() => {
                if (!curriculumUnitId || !exerciseType || !pdfBlobRef) return;
                createMut.mutate({
                  curriculumUnitId,
                  type: exerciseType as 'homework' | 'test_entrance' | 'test_periodic',
                  basePdfRef: pdfBlobRef,
                });
              }}
            />
          </HStack>
        </Stack>
      </Dialog>

      <ConfirmDialog
        opened={pendingPublishId !== null}
        title="Công bố bài tập?"
        message="Học sinh sẽ có thể nộp bài sau khi công bố. Bạn có chắc muốn công bố bài tập này?"
        confirmLabel="Công bố"
        confirmColor="green"
        loading={publishMut.isPending}
        onConfirm={() => {
          if (pendingPublishId) publishMut.mutate({ exerciseId: pendingPublishId });
        }}
        onCancel={() => setPendingPublishId(null)}
      />
      <ConfirmDialog
        opened={pendingCloseId !== null}
        title="Đóng bài tập?"
        message="Sau khi đóng, học sinh không thể nộp bài mới. Hành động này nên dùng khi hết hạn nộp."
        confirmLabel="Đóng bài tập"
        confirmColor="red"
        loading={closeMut.isPending}
        onConfirm={() => {
          if (pendingCloseId) closeMut.mutate({ exerciseId: pendingCloseId });
        }}
        onCancel={() => setPendingCloseId(null)}
      />
    </ListPage>
  );
}

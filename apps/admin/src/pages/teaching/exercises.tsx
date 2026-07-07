// Exercise management — director creates exercises linked to CurriculumUnits.
// exercise.manage permission = giam_doc_dao_tao only.

import { useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  published: 'green',
  closed: 'red',
};

const EXERCISE_TYPE_OPTIONS = [
  { value: 'homework', label: 'Bài tập về nhà' },
  { value: 'test_entrance', label: 'Kiểm tra đầu vào' },
  { value: 'test_periodic', label: 'Kiểm tra định kỳ' },
];

export default function ExercisesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [curriculumUnitId, setCurriculumUnitId] = useState<string | null>(null);
  const [exerciseType, setExerciseType] = useState<string | null>(null);
  const [pdfBlobRef, setPdfBlobRef] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

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
    onSuccess: () => void utils.exercise.list.invalidate(),
  });
  const closeMut = trpc.exercise.close.useMutation({
    onSuccess: () => void utils.exercise.list.invalidate(),
  });

  function resetForm() {
    setCurriculumUnitId(null);
    setExerciseType(null);
    setPdfBlobRef(null);
    setPdfError(null);
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

  const exercises = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Quản lý bài tập"
        subtitle="Tạo và quản lý bài tập học viên"
        breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Bài tập' }]}
        actions={
          <Button size="xs" radius="xs" onClick={() => setCreateOpen(true)}>
            + Tạo bài tập
          </Button>
        }
      />

      {isLoading && <Skeleton height={200} m="md" />}
      {error && <Alert color="red" m="md">{error.message}</Alert>}

      {!isLoading && exercises.length === 0 && (
        <Box p="xl" ta="center">
          <Text c="dimmed">Chưa có bài tập nào. Nhấn "Tạo bài tập" để bắt đầu.</Text>
        </Box>
      )}

      {exercises.length > 0 && (
        <Box p="md" style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Đơn vị học</Table.Th>
                <Table.Th>Loại</Table.Th>
                <Table.Th>Trạng thái</Table.Th>
                <Table.Th>Thao tác</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {exercises.map((ex) => {
                const unit = unitMap.get(ex.curriculumUnitId);
                return (
                  <Table.Tr key={ex.id}>
                    <Table.Td>
                      {unit
                        ? `${unit.program} Lv${unit.level} T${unit.monthIndex}: ${unit.title}`
                        : ex.curriculumUnitId}
                    </Table.Td>
                    <Table.Td>
                      {EXERCISE_TYPE_OPTIONS.find((o) => o.value === ex.type)?.label ?? ex.type}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" radius="xs" color={STATUS_COLOR[ex.status] ?? 'gray'}>
                        {ex.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {ex.status === 'draft' && (
                          <Button
                            size="xs" radius="xs" color="green" variant="light"
                            loading={publishMut.isPending}
                            onClick={() => publishMut.mutate({ exerciseId: ex.id })}
                          >
                            Publish
                          </Button>
                        )}
                        {ex.status === 'published' && (
                          <Button
                            size="xs" radius="xs" color="red" variant="light"
                            loading={closeMut.isPending}
                            onClick={() => closeMut.mutate({ exerciseId: ex.id })}
                          >
                            Đóng
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      {/* Create modal */}
      <Modal
        opened={createOpen}
        onClose={() => { setCreateOpen(false); resetForm(); }}
        title="Tạo bài tập mới"
        radius="xs"
        size="md"
      >
        <Stack gap="sm">
          {unitsLoading ? (
            <Skeleton height={36} />
          ) : (
            <Select
              label="Đơn vị học (CurriculumUnit)"
              placeholder="Chọn chương trình / tháng / bài"
              data={unitOptions}
              value={curriculumUnitId}
              onChange={setCurriculumUnitId}
              searchable
              required
              radius="xs"
            />
          )}

          <Select
            label="Loại bài tập"
            placeholder="Chọn loại"
            data={EXERCISE_TYPE_OPTIONS}
            value={exerciseType}
            onChange={setExerciseType}
            required
            radius="xs"
          />

          {/* PDF upload — required */}
          <Box>
            <Text fz="sm" fw={500} mb={4}>File PDF bài tập (bắt buộc)</Text>
            {pdfError && <Alert color="red" p="xs" mb="xs">{pdfError}</Alert>}
            {pdfBlobRef ? (
              <Group gap="xs">
                <Badge color="green" radius="xs" size="sm">PDF đã upload</Badge>
                <Button size="xs" radius="xs" variant="subtle" onClick={() => setPdfBlobRef(null)}>
                  Đổi file
                </Button>
              </Group>
            ) : (
              <Button
                size="xs" radius="xs" variant="default"
                onClick={() => fileRef.current?.click()}
                disabled={pdfUploading}
                leftSection={pdfUploading ? <Loader size="xs" /> : undefined}
              >
                {pdfUploading ? 'Đang upload…' : 'Chọn file PDF'}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                if (file) await handlePdfUpload(file);
                e.currentTarget.value = '';
              }}
            />
          </Box>

          <Group justify="flex-end" mt="sm">
            <Button
              radius="xs" variant="default" size="sm"
              onClick={() => { setCreateOpen(false); resetForm(); }}
            >
              Huỷ
            </Button>
            <Button
              radius="xs" size="sm"
              loading={createMut.isPending}
              disabled={!curriculumUnitId || !exerciseType || !pdfBlobRef}
              onClick={() => {
                if (!curriculumUnitId || !exerciseType || !pdfBlobRef) return;
                createMut.mutate({
                  curriculumUnitId,
                  type: exerciseType as 'homework' | 'test_entrance' | 'test_periodic',
                  basePdfRef: pdfBlobRef,
                });
              }}
            >
              Tạo bài tập
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

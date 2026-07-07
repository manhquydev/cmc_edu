import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MasterDetail, PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { PdfAnnotator } from './pdf-annotator.js';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmissionItem {
  id: string;
  exerciseId: string;
  studentId: string;
  status: string;
  score: number | null;
  submittedAt: Date | string | null;
  gradedAt: Date | string | null;
  annotationLayer: unknown;
  teacherAnnotationLayer: unknown;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_URL = ((import.meta as any).env?.['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

const STATUS_COLORS: Record<string, string> = {
  draft: 'gray',
  submitted: 'blue',
  graded: 'green',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ chấm',
  graded: 'Đã chấm',
};

// ---------------------------------------------------------------------------
// Submission list item
// ---------------------------------------------------------------------------

function SubmissionListItem({
  item,
  selected,
  onClick,
}: {
  item: SubmissionItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      px="md"
      py="sm"
      onClick={onClick}
      style={{
        borderBottom: '1px solid var(--cmc-border)',
        cursor: 'pointer',
        background: selected ? 'var(--cmc-accent-subtle, #e8f4fd)' : 'var(--cmc-surface)',
        borderLeft: selected ? '3px solid var(--cmc-accent, #228be6)' : '3px solid transparent',
      }}
    >
      <Group justify="space-between" mb={2}>
        {/* Never show studentCode — show truncated studentId only */}
        <Text fz="sm" fw={500}>
          HS: {item.studentId.slice(0, 8).toUpperCase()}
        </Text>
        <Badge
          color={STATUS_COLORS[item.status] ?? 'gray'}
          size="xs"
          radius="xs"
        >
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </Group>
      <Text fz="xs" c="dimmed">
        {item.submittedAt
          ? `Nộp: ${new Date(item.submittedAt as string).toLocaleDateString('vi-VN')}`
          : 'Chưa nộp'}
        {item.score !== null ? ` · ${item.score}/10` : ''}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detail pane
// ---------------------------------------------------------------------------

function DetailPane({
  item,
  onGraded,
}: {
  item: SubmissionItem;
  onGraded: () => void;
}) {
  const [score, setScore] = useState<number | string>(item.score ?? '');
  const [starAwarded, setStarAwarded] = useState(false);

  // Track whether this grade call is the first (star-awarding) one.
  // Star is awarded exactly once per submission: when status transitions from
  // 'submitted' → 'graded'. On re-grades (already 'graded'), no star is given.
  const wasSubmitted = item.status === 'submitted';

  const grade = trpc.submission.grade.useMutation({
    onSuccess: () => {
      if (wasSubmitted) setStarAwarded(true);
      onGraded();
    },
  });

  function handleGrade() {
    const numScore = typeof score === 'string' ? parseFloat(score) : score;
    if (Number.isNaN(numScore) || numScore < 0 || numScore > 10) return;
    grade.mutate({ submissionId: item.id, score: numScore });
  }

  // basePdfRef is the BlobStorage key (starts with 'exercise-pdf/'); the GET
  // handler at /upload/exercise-pdf?ref=<blobRef> is implemented in upload-route.ts.
  const pdfUrl = item.basePdfRef ? `${API_URL}/upload/exercise-pdf?ref=${item.basePdfRef}` : null;

  return (
    <Stack gap="md" p="md">
      {/* Header */}
      <Group justify="space-between">
        <Stack gap={2}>
          <Text fz="sm" fw={600}>
            Bài nộp: {item.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text fz="xs" c="dimmed">
            Học sinh: {item.studentId.slice(0, 8).toUpperCase()} · Bài tập: {item.exerciseId.slice(0, 8).toUpperCase()}
          </Text>
        </Stack>
        <Badge color={STATUS_COLORS[item.status] ?? 'gray'} size="sm" radius="xs">
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </Group>

      {/* Star award notice — shown only when this grade call was the first */}
      {starAwarded && (
        <Alert color="yellow" title="⭐ +1 sao" radius="xs">
          Học sinh nhận được 1 sao cho bài tập này (lần chấm đầu tiên).
        </Alert>
      )}

      {/* Score input + grade button */}
      <Box
        p="sm"
        style={{
          background: 'var(--cmc-surface-2)',
          border: '1px solid var(--cmc-border)',
          borderRadius: 4,
        }}
      >
        <Text fz="xs" fw={600} mb="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
          Chấm điểm
        </Text>
        <Group gap="sm" align="flex-end">
          <NumberInput
            label="Điểm (0–10)"
            value={score}
            onChange={setScore}
            min={0}
            max={10}
            step={0.5}
            decimalScale={1}
            w={120}
            size="sm"
            radius="xs"
          />
          <Text fz="sm" c="dimmed" pb={4}>
            / 10
          </Text>
          <Button
            size="sm"
            radius="xs"
            loading={grade.isPending}
            disabled={score === '' || score === null}
            onClick={handleGrade}
          >
            {item.status === 'graded' ? 'Chấm lại' : 'Chấm bài'}
          </Button>
        </Group>
        {grade.error && (
          <Alert color="red" mt="xs" p="xs" fz="xs">
            {grade.error.message}
          </Alert>
        )}
        {grade.isSuccess && !starAwarded && (
          <Alert color="green" mt="xs" p="xs" fz="xs">
            Điểm đã được lưu.
          </Alert>
        )}
      </Box>

      {/* PDF viewer */}
      <Box>
        <Text fz="xs" fw={600} mb="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
          Bài làm PDF
        </Text>
        <Box
          style={{
            border: '1px solid var(--cmc-border)',
            borderRadius: 4,
            overflow: 'hidden',
            height: 400,
            background: 'var(--cmc-surface-2)',
          }}
        >
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Bài làm PDF"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <Text fz="sm" c="dimmed" p="md">
              Bài chưa có file PDF
            </Text>
          )}
        </Box>
      </Box>

      {/* Annotation layers */}
      <Box>
        <Text fz="xs" fw={600} mb="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
          Lớp chú thích PDF
        </Text>
        <PdfAnnotator
          submissionId={item.id}
          studentLayer={item.annotationLayer}
          teacherLayer={item.teacherAnnotationLayer}
          onSaved={onGraded}
        />
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GradingPage() {
  const [searchParams] = useSearchParams();
  const classFilter = searchParams.get('class') ?? undefined;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc.submission.listForGrading.useQuery(
    // Default status is 'submitted' (ungraded queue); no class filter on this
    // endpoint — submissions are scoped to the facility via server-side RLS.
    {},
    { refetchOnWindowFocus: false },
  );

  const items = (data?.items ?? []) as SubmissionItem[];
  const selected = items.find((it) => it.id === selectedId) ?? null;

  // ---------------------------------------------------------------------------
  // List panel
  // ---------------------------------------------------------------------------

  const listPanel = (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        px="md"
        py="sm"
        style={{ borderBottom: '1px solid var(--cmc-border)', background: 'var(--cmc-surface-2)' }}
      >
        <Text fz="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
          Bài chờ chấm
          {items.length > 0 && (
            <Badge color="blue" size="xs" radius="xs" ml={6}>
              {items.length}
            </Badge>
          )}
        </Text>
        {classFilter && (
          <Text fz="xs" c="dimmed" mt={2}>
            Lớp: {classFilter.slice(0, 8)}…
          </Text>
        )}
      </Box>

      {error && (
        <Box p="md">
          <Alert color="red" fz="xs">
            {error.message}
          </Alert>
        </Box>
      )}

      <Box style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Stack gap={0}>
            {Array.from({ length: 5 }, (_, i) => (
              <Box key={i} px="md" py="sm" style={{ borderBottom: '1px solid var(--cmc-border)' }}>
                <Skeleton height={14} mb={4} radius="xs" />
                <Skeleton height={11} width="60%" radius="xs" />
              </Box>
            ))}
          </Stack>
        ) : items.length === 0 ? (
          <Box p="xl">
            <Text c="dimmed" ta="center" fz="sm">
              Không có bài nào chờ chấm.
            </Text>
          </Box>
        ) : (
          items.map((item) => (
            <SubmissionListItem
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onClick={() => setSelectedId(item.id)}
            />
          ))
        )}
      </Box>
    </Box>
  );

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const detailPanel = selected ? (
    <DetailPane
      key={selected.id}
      item={selected}
      onGraded={() => void refetch()}
    />
  ) : (
    <Box
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text c="dimmed" fz="sm">
        Chọn một bài để chấm
      </Text>
    </Box>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Chấm bài"
        subtitle="Danh sách bài nộp cần chấm điểm"
        breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Chấm bài' }]}
      />
      <Box style={{ height: 'calc(100vh - 120px)' }}>
        <MasterDetail
          list={listPanel}
          detail={detailPanel}
          selectedId={selectedId ?? undefined}
          listWidth={300}
        />
      </Box>
    </>
  );
}

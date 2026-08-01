import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Badge, Banner, Button, HStack, MasterDetail, NumberInput, PageHeader, Skeleton, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { PdfAnnotator } from './pdf-annotator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmissionItem {
  id: string;
  exerciseId: string;
  studentId: string;
  /** Populated by `submission.listForGrading`; undefined only if the API's
   * student join ever fails to resolve (deleted student row) — falls back to
   * a truncated id at render time so the row never looks silently blank. */
  studentFullName?: string;
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

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'neutral',
  submitted: 'blue',
  graded: 'success',
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
    <div
      onClick={onClick}
      style={{
        paddingInline: 16,
        paddingBlock: 8,
        borderBottom: '1px solid var(--cmc-border)',
        cursor: 'pointer',
        background: selected ? 'var(--cmc-accent-subtle, #e8f4fd)' : 'var(--cmc-surface)',
        borderLeft: selected ? '3px solid var(--cmc-accent, #228be6)' : '3px solid transparent',
      }}
    >
      <HStack justify="between" style={{ marginBottom: 2 }}>
        <Text size="sm" weight="medium">
          {item.studentFullName ?? `HS: ${item.studentId.slice(0, 8).toUpperCase()}`}
        </Text>
        <Badge label={STATUS_LABELS[item.status] ?? item.status} variant={STATUS_VARIANTS[item.status] ?? 'neutral'} />
      </HStack>
      <Text type="supporting" size="xsm">
        {item.submittedAt
          ? `Nộp: ${new Date(item.submittedAt as string).toLocaleDateString('vi-VN')}`
          : 'Chưa nộp'}
        {item.score !== null ? ` · Điểm: ${item.score}` : ''}
      </Text>
    </div>
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

  // Bug fix: this used to hardcode `numScore > 10` and silently `return` —
  // an exercise with maxScore=100 (apps/api/src/exercise/router.ts) could
  // never be graded above 10, with no feedback at all. The client doesn't
  // know each exercise's real maxScore (this DTO doesn't carry it), so it no
  // longer second-guesses the number: `NumberInput`'s own `min={0}` already
  // keeps the value non-negative and numeric (verified: it never calls
  // `onChange` with NaN or a negative number), and `isDisabled` below blocks
  // the empty-value case. The server is the one true ceiling check
  // (submission/router.ts's `grade` rejects score > exercise.maxScore with a
  // BAD_REQUEST) — its message is surfaced via `grade.error` below, so a
  // rejection is always visible, never silent.
  function handleGrade() {
    if (score === '' || score === null) return;
    grade.mutate({ submissionId: item.id, score: Number(score) });
  }

  // basePdfRef is the BlobStorage key (starts with 'exercise-pdf/'); the GET
  // handler at /upload/exercise-pdf?ref=<blobRef> is implemented in upload-route.ts.
  const pdfUrl = item.basePdfRef ? `${API_URL}/upload/exercise-pdf?ref=${item.basePdfRef}` : null;

  return (
    <Stack gap={4} style={{ padding: 16 }}>
      {/* Header */}
      <HStack justify="between">
        <Stack gap={0.5}>
          <Text size="sm" weight="semibold">
            Bài nộp: {item.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text type="supporting" size="xsm">
            Học sinh: {item.studentFullName ?? item.studentId.slice(0, 8).toUpperCase()} · Bài tập: {item.exerciseId.slice(0, 8).toUpperCase()}
          </Text>
        </Stack>
        <Badge label={STATUS_LABELS[item.status] ?? item.status} variant={STATUS_VARIANTS[item.status] ?? 'neutral'} />
      </HStack>

      {/* Star award notice — shown only when this grade call was the first */}
      {starAwarded && (
        <Banner
          status="warning"
          title="⭐ +1 sao"
          description="Học sinh nhận được 1 sao cho bài tập này (lần chấm đầu tiên)."
        />
      )}

      {/* Score input + grade button */}
      <div
        style={{
          padding: 12,
          background: 'var(--cmc-surface-2)',
          border: '1px solid var(--cmc-border)',
          borderRadius: 4,
        }}
      >
        <Text type="supporting" size="xsm" weight="semibold" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Chấm điểm
        </Text>
        <HStack gap={2} align="end">
          <div style={{ width: 120 }}>
            {/* TODO(astryx-review): Astryx NumberInput has no confirmed
                decimalScale prop (thousand/decimal formatting dropped per
                mapping doc) — `step={0.5}` still constrains scoring
                increments, just without forced 1-decimal display rounding.
                No `max` set: exercise.maxScore varies per exercise (not
                always 10) and this DTO does not carry it — the server is the
                real ceiling check (see handleGrade's comment above). */}
            <NumberInput
              label="Điểm"
              value={score === '' ? null : Number(score)}
              onChange={(v) => setScore(v ?? '')}
              min={0}
              step={0.5}
            />
          </div>
          <Button
            label={item.status === 'graded' ? 'Chấm lại' : 'Chấm bài'}
            size="sm"
            variant="primary"
            isLoading={grade.isPending}
            isDisabled={score === '' || score === null}
            onClick={handleGrade}
          />
        </HStack>
        {grade.error && (
          <div style={{ marginTop: 8 }}>
            <Banner status="error" title={grade.error.message} />
          </div>
        )}
        {grade.isSuccess && !starAwarded && (
          <div style={{ marginTop: 8 }}>
            <Banner status="success" title="Điểm đã được lưu." />
          </div>
        )}
      </div>

      {/* PDF viewer */}
      <div>
        <Text type="supporting" size="xsm" weight="semibold" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Bài làm PDF
        </Text>
        <div
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
            <Text type="supporting" size="sm" style={{ padding: 16 }}>
              Bài chưa có file PDF
            </Text>
          )}
        </div>
      </div>

      {/* Annotation layers */}
      <div>
        <Text type="supporting" size="xsm" weight="semibold" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Lớp chú thích PDF
        </Text>
        <PdfAnnotator
          submissionId={item.id}
          studentLayer={item.annotationLayer}
          teacherLayer={item.teacherAnnotationLayer}
          onSaved={onGraded}
        />
      </div>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GradingPage() {
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          paddingInline: 16,
          paddingBlock: 8,
          borderBottom: '1px solid var(--cmc-border)',
          background: 'var(--cmc-surface-2)',
        }}
      >
        <HStack gap={1} align="center">
          <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Bài chờ chấm
          </Text>
          {items.length > 0 && <Badge label={String(items.length)} variant="blue" />}
        </HStack>
      </div>

      {error && (
        <div style={{ padding: 16 }}>
          <Banner status="error" title={error.message} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Stack gap={0}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ paddingInline: 16, paddingBlock: 8, borderBottom: '1px solid var(--cmc-border)' }}>
                <Skeleton height={14} radius={1} style={{ marginBottom: 4 }} />
                <Skeleton height={11} width="60%" radius={1} />
              </div>
            ))}
          </Stack>
        ) : items.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Text type="supporting" size="sm" justify="center" display="block">
              Không có bài nào chờ chấm.
            </Text>
          </div>
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
      </div>
    </div>
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
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text type="supporting" size="sm">
        Chọn một bài để chấm
      </Text>
    </div>
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
      <div style={{ height: 'calc(100vh - 120px)' }}>
        <MasterDetail
          list={listPanel}
          detail={detailPanel}
          selectedId={selectedId ?? undefined}
          listWidth={300}
        />
      </div>
    </>
  );
}

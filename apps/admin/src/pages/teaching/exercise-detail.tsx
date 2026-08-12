// Form chi tiết 1 Exercise — /teaching/exercises/:exerciseId
// Resource-centric form-depth (docs/ux-resource-centric-structure.md).
// List is index-only; HITL Công bố / Đóng lives here with ConfirmDialog.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  DetailPage,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatusBadge,
  Text,
  WorkflowStatusbar,
} from '@cmc/ui';
import { UUID_RE } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đã công bố',
  closed: 'Đã đóng',
};

const TYPE_LABELS: Record<string, string> = {
  homework: 'Bài tập về nhà',
  test_entrance: 'Kiểm tra đầu vào',
  test_periodic: 'Kiểm tra định kỳ',
};

const LIST_PATH = '/teaching/exercises';

type Step = { id: string; label: string };

function statusSteps(status: string): { steps: Step[]; activeIndex: number } {
  if (status === 'closed') {
    return {
      steps: [
        { id: 'draft', label: 'Nháp' },
        { id: 'published', label: 'Đã công bố' },
        { id: 'closed', label: 'Đã đóng' },
      ],
      activeIndex: 2,
    };
  }
  const steps = [
    { id: 'draft', label: 'Nháp' },
    { id: 'published', label: 'Đã công bố' },
    { id: 'closed', label: 'Đã đóng' },
  ];
  const activeIndex = status === 'published' ? 1 : 0;
  return { steps, activeIndex };
}

export default function ExerciseDetailPage() {
  const { exerciseId = '' } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const canManage = canDo('exercise', 'manage');
  const idOk = UUID_RE.test(exerciseId);

  const { data, isLoading, error, refetch } = trpc.exercise.get.useQuery(
    { exerciseId },
    { enabled: idOk },
  );

  const utils = trpc.useUtils();
  const [publishOpen, setPublishOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function invalidate() {
    void refetch();
    void utils.exercise.list.invalidate();
  }

  const publishMut = trpc.exercise.publish.useMutation({
    onSuccess() {
      setPublishOpen(false);
      setFlash({ ok: true, text: 'Đã công bố bài tập.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setPublishOpen(false);
    },
  });

  const closeMut = trpc.exercise.close.useMutation({
    onSuccess() {
      setCloseOpen(false);
      setFlash({ ok: true, text: 'Đã đóng bài tập.' });
      invalidate();
    },
    onError(e) {
      setFlash({ ok: false, text: e.message });
      setCloseOpen(false);
    },
  });

  if (!idOk) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Giảng dạy' },
              { label: 'Bài tập', href: LIST_PATH },
              { label: 'Phiếu' },
            ]}
          />
        }
      >
        <EmptyState title="Mã bài tập không hợp lệ" description="URL cần UUID exerciseId." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Giảng dạy' },
              { label: 'Bài tập', href: LIST_PATH },
              { label: '…' },
            ]}
          />
        }
      >
        <Text type="supporting" size="sm">
          Đang tải bài tập…
        </Text>
      </DetailPage>
    );
  }

  if (error || !data) {
    return (
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Giảng dạy' },
              { label: 'Bài tập', href: LIST_PATH },
              { label: 'Phiếu' },
            ]}
          />
        }
      >
        <ResultPanel
          status="error"
          title="Không mở được bài tập"
          message={error?.message ?? 'Exercise not found.'}
          actions={
            <Button
              label="Về danh sách"
              size="sm"
              variant="secondary"
              onClick={() => navigate(LIST_PATH)}
            />
          }
        />
      </DetailPage>
    );
  }

  const status = data.status as string;
  const canPublish = canManage && status === 'draft';
  const canClose = canManage && status === 'published';
  const { steps, activeIndex } = statusSteps(status);
  const shortId = exerciseId.slice(0, 8);
  const typeLabel = TYPE_LABELS[data.type] ?? data.type;
  const unitLabel = data.curriculumUnit
    ? `${data.curriculumUnit.program} Lv${data.curriculumUnit.level} T${data.curriculumUnit.monthIndex}: ${data.curriculumUnit.title}`
    : data.curriculumUnitId;

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Giảng dạy' },
            { label: 'Bài tập', href: LIST_PATH },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="exercise" id={exerciseId} />
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate(LIST_PATH)}
              />
            </HStack>
          }
        />
      }
      entity={
        <EntityHeader
          title={`Bài tập / ${typeLabel}`}
          subtitle={unitLabel}
          initials={typeLabel.slice(0, 1).toUpperCase()}
          badges={
            <StatusBadge status={status} label={STATUS_LABELS[status] ?? status} />
          }
          actions={
            canPublish || canClose ? (
              <HStack gap={1} wrap="wrap">
                {canClose ? (
                  <Button
                    label="Đóng"
                    size="sm"
                    variant="destructive"
                    onClick={() => setCloseOpen(true)}
                  />
                ) : null}
                {canPublish ? (
                  <Button
                    label="Công bố"
                    size="sm"
                    variant="primary"
                    onClick={() => setPublishOpen(true)}
                  />
                ) : null}
              </HStack>
            ) : undefined
          }
        />
      }
      summary={
        <HighlightStrip
          items={[
            {
              key: 'status',
              label: 'Trạng thái',
              value: (
                <StatusBadge status={status} label={STATUS_LABELS[status] ?? status} />
              ),
            },
            { key: 'type', label: 'Loại', value: typeLabel },
            {
              key: 'maxScore',
              label: 'Điểm tối đa',
              value: String(data.maxScore),
              tabular: true,
            },
            {
              key: 'stars',
              label: 'Sao thưởng',
              value: String(data.starReward),
              tabular: true,
            },
          ]}
        />
      }
      statusbar={<WorkflowStatusbar steps={steps} activeIndex={activeIndex} />}
    >
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)' }}>
          {flash ? (
            <Banner status={flash.ok ? 'success' : 'error'} title={flash.text} />
          ) : null}

          <SectionBlock
            title="Thông tin bài tập"
            description="List chỉ mở phiếu — công bố / đóng trên form."
          >
            <KeyValueList
              items={[
                { key: 'unit', label: 'Đơn vị học', value: unitLabel },
                { key: 'type', label: 'Loại', value: typeLabel },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: STATUS_LABELS[status] ?? status,
                },
                { key: 'max', label: 'Điểm tối đa', value: String(data.maxScore) },
                { key: 'stars', label: 'Sao thưởng', value: String(data.starReward) },
                { key: 'pdf', label: 'PDF', value: data.basePdfRef || '—' },
              ]}
            />
          </SectionBlock>
        </Stack>
      </div>

      <ConfirmDialog
        opened={publishOpen}
        title="Công bố bài tập?"
        message="Học sinh sẽ có thể nộp bài sau khi công bố. draft → published?"
        confirmLabel="Công bố"
        confirmColor="green"
        loading={publishMut.isPending}
        onConfirm={() => publishMut.mutate({ exerciseId })}
        onCancel={() => setPublishOpen(false)}
      />
      <ConfirmDialog
        opened={closeOpen}
        title="Đóng bài tập?"
        message="Sau khi đóng, học sinh không thể nộp bài mới. published → closed?"
        confirmLabel="Đóng bài tập"
        confirmColor="red"
        loading={closeMut.isPending}
        onConfirm={() => closeMut.mutate({ exerciseId })}
        onCancel={() => setCloseOpen(false)}
      />
    </DetailPage>
  );
}

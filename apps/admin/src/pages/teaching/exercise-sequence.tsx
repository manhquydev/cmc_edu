// Class exercise sequence work surface — /teaching/classes/:classBatchId/exercise-sequence
// Library (published only) on the left; class sequence on the right.
// assignExerciseSequence.exerciseIds is the UNLOCKED TAIL only.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  HighlightStrip,
  HStack,
  LineIcon,
  ListPage,
  ListPagination,
  MasterDetail,
  PageHeader,
  SectionBlock,
  Skeleton,
  Stack,
  StatusBadge,
  Text,
  useToast,
} from '@cmc/ui';
import type { FilterDef } from '@cmc/ui';
import { UUID_RE } from '@cmc/links';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { useUnsavedBlocker } from '../../lib/use-unsaved-blocker.js';
import {
  buildDisplaySequence,
  canAddExercise,
  canSafelySaveSequence,
  chronologicalActiveSessions,
  formatSessionDay,
  hasAuthoritativeFreeze,
  isSequenceEmpty,
  isSequenceShort,
  moveTailId,
  nextDeliverySession,
  remainingSessionCount,
  sessionForPosition,
  tailExerciseIds,
  tailHasUnpublished,
} from './exercise-sequence-model.js';

const TYPE_LABELS: Record<string, string> = {
  homework: 'Bài tập về nhà',
  test_entrance: 'Kiểm tra đầu vào',
  test_periodic: 'Kiểm tra định kỳ',
};

const LIBRARY_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm bài',
    type: 'text',
    placeholder: 'Tên bài…',
  },
];

const LIBRARY_PAGE_SIZE = 20;

interface ExerciseRow {
  id: string;
  title: string;
  type: string;
  status: string;
  folderId: string;
}

interface FolderRow {
  id: string;
  name: string;
  archivedAt: Date | string | null;
}

export default function ExerciseSequencePage() {
  const { classBatchId = '' } = useParams<{ classBatchId: string }>();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const canManage = canDo('exercise', 'manage');
  const idOk = UUID_RE.test(classBatchId);
  const { success: toastSuccess } = useToast();

  const [search, setSearch] = useState('');
  const [libraryPage, setLibraryPage] = useState(1);
  const [draftTail, setDraftTail] = useState<string[] | null>(null);
  const [assignedDeliveredCount, setAssignedDeliveredCount] = useState<number | null>(null);
  const [dropConfirm, setDropConfirm] = useState(false);

  const { data: cls, isLoading: classLoading, error: classError } = trpc.classBatch.get.useQuery(
    { classBatchId },
    { enabled: idOk && canManage },
  );
  const { data: seq, isLoading: seqLoading, error: seqError } = trpc.lmsOps.listExerciseSequence.useQuery(
    { classBatchId },
    { enabled: idOk && canManage },
  );
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } =
    trpc.classSession.list.useQuery({ classBatchId }, { enabled: idOk && canManage });
  const { data: exercisesData, isLoading: exercisesLoading, error: exercisesError } =
    trpc.exercise.list.useQuery({}, { enabled: canManage });
  const { data: foldersData } = trpc.exerciseFolder.list.useQuery(undefined, { enabled: canManage });

  const utils = trpc.useUtils();
  const assignMut = trpc.lmsOps.assignExerciseSequence.useMutation({
    onSuccess(result) {
      setAssignedDeliveredCount(result.deliveredCount);
      setDraftTail(null);
      void utils.lmsOps.listExerciseSequence.invalidate({ classBatchId });
      toastSuccess('Đã lưu dãy bài');
    },
  });

  const serverItems = seq?.items ?? [];
  const sessionRows = (sessions ?? []) as Parameters<typeof chronologicalActiveSessions>[0];
  const listedDeliveredCount = seq?.deliveredCount;
  const freezeKnown = hasAuthoritativeFreeze(assignedDeliveredCount ?? listedDeliveredCount);
  const deliveredCount = assignedDeliveredCount ?? listedDeliveredCount ?? 0;
  const serverTail = freezeKnown ? tailExerciseIds(serverItems, deliveredCount) : [];
  const tailIds = draftTail ?? serverTail;
  const frozen = freezeKnown ? serverItems.filter((item) => item.position <= deliveredCount) : [];
  const display = freezeKnown
    ? buildDisplaySequence(frozen, tailIds, deliveredCount)
    : [...serverItems].sort((a, b) => a.position - b.position);
  const remaining = remainingSessionCount(sessionRows, freezeKnown ? deliveredCount : 0);
  const nextSession = freezeKnown ? nextDeliverySession(sessionRows, deliveredCount) : null;
  const dirty = draftTail !== null && draftTail.join(',') !== serverTail.join(',');
  const empty = isSequenceEmpty(display.length);
  const short = isSequenceShort(tailIds.length, remaining);
  const classLocked = cls?.status === 'completed' || cls?.status === 'cancelled' || cls?.status === 'closed';
  const freezeUnknown = !freezeKnown;
  const readOnly = classLocked || !canManage || freezeUnknown;
  const leaveBlocker = useUnsavedBlocker({
    dirty,
    title: 'Huỷ thay đổi chưa lưu?',
    message: 'Dãy bài chưa lưu sẽ mất nếu rời trang.',
    confirmLabel: 'Rời trang',
  });

  const exercises = (exercisesData?.items ?? []) as ExerciseRow[];
  const folders = (foldersData?.items ?? []) as FolderRow[];
  const folderName = useMemo(() => {
    const map = new Map(folders.map((f) => [f.id, f.name]));
    return (folderId: string) => map.get(folderId) ?? 'Thư mục';
  }, [folders]);
  const exerciseById = useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e]));
    return (id: string) => map.get(id);
  }, [exercises]);

  const inSequence = useMemo(() => new Set(display.map((i) => i.exerciseId)), [display]);
  const q = search.trim().toLowerCase();
  const published = exercises.filter((e) => e.status === 'published');
  const filteredLibrary = published.filter((e) => {
    if (!q) return true;
    const folder = folderName(e.folderId).toLowerCase();
    return e.title.toLowerCase().includes(q) || folder.includes(q);
  });
  const librarySlice = filteredLibrary.slice(
    (libraryPage - 1) * LIBRARY_PAGE_SIZE,
    libraryPage * LIBRARY_PAGE_SIZE,
  );

  const statusById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e.status])),
    [exercises],
  );
  const tailAllPublished = !tailHasUnpublished(tailIds, statusById);
  const canSave = canSafelySaveSequence({
    listedDeliveredCount: assignedDeliveredCount ?? listedDeliveredCount,
    dirty,
    tailIds,
    tailAllPublished,
    readOnly: classLocked || !canManage,
  });

  function goBack() {
    navigate(`/admin/classes/${classBatchId}`);
  }

  function addExercise(id: string) {
    if (readOnly) return;
    const row = exerciseById(id);
    if (!row || !canAddExercise({ status: row.status, exerciseId: id, alreadyInSequence: inSequence })) {
      return;
    }
    setDraftTail([...tailIds, id]);
  }

  function removeTail(index: number) {
    if (readOnly) return;
    setDraftTail(tailIds.filter((_, i) => i !== index));
  }

  function moveTail(index: number, delta: -1 | 1) {
    if (readOnly) return;
    setDraftTail(moveTailId(tailIds, index, delta));
  }

  function save() {
    if (!canSave) return;
    if (draftTail && draftTail.length < serverTail.length) {
      setDropConfirm(true);
      return;
    }
    assignMut.mutate({ classBatchId, exerciseIds: tailIds });
  }

  if (!canManage) {
    return (
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Xếp dãy bài"
            breadcrumbs={[{ label: 'Giảng dạy', href: '/teaching' }, { label: 'Xếp dãy bài' }]}
          />
        }
      >
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý bài tập (exercise.manage)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </ListPage>
    );
  }

  if (!idOk) {
    return (
      <ListPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh', href: '/admin/students' },
              { label: 'Lớp học', href: '/admin/classes' },
              { label: 'Xếp dãy bài' },
            ]}
          />
        }
      >
        <EmptyState title="Mã lớp không hợp lệ" description="URL cần UUID classBatchId." />
      </ListPage>
    );
  }

  const loading = classLoading || seqLoading || sessionsLoading || exercisesLoading;
  const loadError = classError ?? seqError ?? sessionsError ?? exercisesError;

  const libraryPanel = (
    <Stack gap={2} style={{ padding: 'var(--cmc-space-2)' }}>
      <Text type="supporting" size="xsm" weight="bold" style={{ textTransform: 'uppercase' }}>
        Thư viện (đã công bố)
      </Text>
      <FilterBar
        filters={LIBRARY_FILTERS}
        value={{ q: search }}
        onChange={(next) => {
          setSearch(next.q ?? '');
          setLibraryPage(1);
        }}
      />
      {librarySlice.length === 0 ? (
        <EmptyState
          title="Không có bài khớp bộ lọc"
          description="Chỉ bài đã công bố mới kéo được vào dãy. Xoá lọc hoặc công bố bài nháp."
        />
      ) : (
        librarySlice.map((row) => {
          const already = inSequence.has(row.id);
          const addable = !readOnly && canAddExercise({
            status: row.status,
            exerciseId: row.id,
            alreadyInSequence: inSequence,
          });
          return (
            <div
              key={row.id}
              draggable={addable}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', row.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              style={{
                border: '1px solid var(--cmc-border)',
                borderRadius: 'var(--cmc-radius-control)',
                padding: 'var(--cmc-space-2)',
                background: 'var(--cmc-surface)',
                opacity: already ? 0.55 : 1,
              }}
            >
              <Stack gap={0.5}>
                <Text type="body" size="sm" weight="medium">
                  {row.title}
                </Text>
                <HStack gap={1} wrap="wrap">
                  <Badge label={TYPE_LABELS[row.type] ?? row.type} variant="neutral" />
                  <Text type="supporting" size="2xs">
                    {folderName(row.folderId)}
                  </Text>
                </HStack>
                <Button
                  label={already ? 'Đã có trong dãy' : 'Thêm'}
                  size="sm"
                  variant="secondary"
                  isDisabled={!addable}
                  onClick={() => addExercise(row.id)}
                />
              </Stack>
            </div>
          );
        })
      )}
      {filteredLibrary.length > LIBRARY_PAGE_SIZE ? (
        <ListPagination
          page={libraryPage}
          pageSize={LIBRARY_PAGE_SIZE}
          total={filteredLibrary.length}
          onPageChange={setLibraryPage}
        />
      ) : null}
    </Stack>
  );

  const sequencePanel = (
    <div
      style={{ padding: 'var(--cmc-space-2)', minHeight: 320 }}
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) addExercise(id);
      }}
    >
      <Stack gap={2}>
        <Text type="supporting" size="xsm" weight="bold" style={{ textTransform: 'uppercase' }}>
          Dãy của lớp
        </Text>

        {empty ? (
          <Callout tone="danger" title="Lớp chưa có dãy bài">
            Mỗi buổi phát tối đa 1 bài. Sau khi bỏ fallback theo unit, không có dãy nghĩa là
            không có bài tập nào được phát. Kéo bài đã công bố từ thư viện — hệ thống không tự
            lặp bài.
          </Callout>
        ) : null}

        {short ? (
          <Callout tone="warning" title="Dãy ngắn hơn số buổi còn lại">
            Dãy còn {tailIds.length} bài chưa phát, lớp còn {remaining} buổi chưa có bài. Lớp
            sẽ hết bài giữa chừng. Không tự lặp lại bài.
            {nextSession
              ? ` Buổi kế tiếp chưa có chỗ: ${formatSessionDay(nextSession.sessionDate)}.`
              : ''}
          </Callout>
        ) : null}

        {classLocked ? (
          <Callout tone="info" title="Lớp đã kết thúc">
            Chỉ xem dãy, không sửa.
          </Callout>
        ) : null}

        {freezeUnknown && !seqLoading ? (
          <Callout tone="danger" title="Chưa biết biên đã phát — không lưu">
            Phản hồi list thiếu deliveredCount. Không lưu để tránh xoá bài chưa phát. Tải lại
            trang sau khi API trả số bài đã phát.
          </Callout>
        ) : null}

        {freezeKnown && deliveredCount > 0 ? (
          <Callout tone="info" title="Phần đã phát (khoá)">
            {deliveredCount} vị trí đã phát không đổi thứ tự. Kéo chỉ phần dưới. Lý do: bài đã
            phát cho buổi học — sửa sẽ lệch bài học sinh đã nhận.
          </Callout>
        ) : null}

        {display.length === 0 ? (
          <EmptyState
            title="Lớp chưa có dãy bài"
            description="Mỗi buổi phát 1 bài. Chưa xếp thì không có bài tập nào. Thêm bài đã công bố từ thư viện."
          />
        ) : (
          display.map((item) => {
            const frozenRow = item.position <= deliveredCount;
            const tailIndex = item.position - deliveredCount - 1;
            const ex = exerciseById(item.exerciseId);
            const bound = sessionForPosition(sessionRows, item.position);
            const isNext = !frozenRow && item.position === deliveredCount + 1;
            const unpublished = ex == null || ex.status !== 'published';
            const lockReasonId = `seq-lock-${item.position}`;
            return (
              <div
                key={`${item.position}-${item.exerciseId}`}
                role={frozenRow ? 'group' : undefined}
                aria-label={frozenRow ? `Vị trí ${item.position} đã phát — khoá` : undefined}
                aria-describedby={frozenRow ? lockReasonId : undefined}
                style={{
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 'var(--cmc-radius-control)',
                  padding: 'var(--cmc-space-2)',
                  background: frozenRow ? 'var(--cmc-surface-2)' : 'var(--cmc-surface)',
                  cursor: frozenRow ? 'not-allowed' : 'default',
                }}
              >
                <Stack gap={0.5}>
                  <HStack gap={1} wrap="wrap" justify="between">
                    <Text type="body" size="sm" weight="medium">
                      {item.position}. {ex?.title ?? `Bài ${item.exerciseId.slice(0, 8)}`}
                    </Text>
                    {frozenRow ? (
                      <StatusBadge status="disabled" label="Đã phát — khoá" />
                    ) : isNext ? (
                      <StatusBadge status="pending" label="Buổi kế" />
                    ) : null}
                  </HStack>
                  <Text type="supporting" size="2xs" id={frozenRow ? lockReasonId : undefined}>
                    {frozenRow
                      ? `Đã phát${bound ? ` · buổi ${formatSessionDay(bound.sessionDate)}` : ''} — không sửa được vì học sinh đã nhận bài này.`
                      : isNext
                        ? `Vị trí kế tiếp sẽ phát vào buổi ${nextSession ? formatSessionDay(nextSession.sessionDate) : 'chưa xếp lịch'}.`
                        : bound
                          ? `Dự kiến buổi ${formatSessionDay(bound.sessionDate)}`
                          : 'Chưa gắn buổi còn lại'}
                  </Text>
                  {unpublished && !frozenRow ? (
                    <Banner
                      status="warning"
                      title="Bài không còn công bố hoặc không tìm thấy — học sinh sẽ không mở được. Gỡ khỏi phần chưa phát trước khi lưu."
                    />
                  ) : null}
                  {!frozenRow && !readOnly ? (
                    <HStack gap={1} wrap="wrap">
                      <Button
                        label="Lên"
                        size="sm"
                        variant="ghost"
                        isDisabled={tailIndex <= 0}
                        onClick={() => moveTail(tailIndex, -1)}
                      />
                      <Button
                        label="Xuống"
                        size="sm"
                        variant="ghost"
                        isDisabled={tailIndex >= tailIds.length - 1}
                        onClick={() => moveTail(tailIndex, 1)}
                      />
                      <Button
                        label="Gỡ"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTail(tailIndex)}
                      />
                    </HStack>
                  ) : null}
                </Stack>
              </div>
            );
          })
        )}
      </Stack>
    </div>
  );

  const previewRows = chronologicalActiveSessions(sessionRows);

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Xếp dãy bài"
          subtitle={cls ? `${cls.code} · ${cls.program}` : 'Gán bài đã công bố vào dãy của lớp'}
          breadcrumbs={[
            { label: 'Lớp & Học sinh', href: '/admin/students' },
            { label: 'Lớp học', href: '/admin/classes' },
            { label: cls?.code ?? '…', href: `/admin/classes/${classBatchId}` },
            { label: 'Xếp dãy bài' },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <Button label="Về lớp" size="sm" variant="ghost" onClick={goBack} />
              <Button
                label="Lưu dãy"
                size="sm"
                variant="primary"
                isLoading={assignMut.isPending}
                isDisabled={!canSave || assignMut.isPending}
                onClick={save}
              />
            </HStack>
          }
        />
      }
    >
      {loading ? <Skeleton height={200} radius={1} /> : null}
      {loadError ? <Banner status="error" title={loadError.message} /> : null}

      {!loading && !loadError ? (
        <Stack gap={3} style={{ padding: 'var(--cmc-space-2)' }}>
          {assignMut.error ? <Banner status="error" title={assignMut.error.message} /> : null}

          <HighlightStrip
            items={[
              {
                key: 'delivered',
                label: 'Đã phát',
                value: freezeKnown ? `${deliveredCount}/${display.length}` : 'chưa rõ',
                tabular: freezeKnown,
              },
              {
                key: 'remaining',
                label: 'Buổi còn lại',
                value: String(remaining),
                tabular: true,
              },
              {
                key: 'next',
                label: 'Buổi kế phát',
                value: nextSession ? formatSessionDay(nextSession.sessionDate) : '—',
              },
              {
                key: 'nextPos',
                label: 'Vị trí kế',
                value: freezeKnown ? String(deliveredCount + 1) : '—',
                tabular: freezeKnown,
              },
            ]}
          />

          <div style={{ flex: 1, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
            <MasterDetail list={libraryPanel} detail={sequencePanel} listWidth={320} />
          </div>

          <SectionBlock
            title="Xem trước lịch phát"
            description="Mỗi buổi không huỷ nhận tối đa một bài theo thứ tự dãy. Không tự lặp bài khi dãy ngắn."
          >
            <Stack gap={1}>
              {previewRows.length === 0 ? (
                <Text type="supporting" size="sm">
                  Chưa có buổi học nào.
                </Text>
              ) : (
                previewRows.map((s, idx) => {
                  const position = idx + 1;
                  const item = display.find((d) => d.position === position);
                  const title = item ? (exerciseById(item.exerciseId)?.title ?? item.exerciseId.slice(0, 8)) : null;
                  const frozenRow = position <= deliveredCount;
                  return (
                    <HStack key={s.id} gap={2} wrap="wrap">
                      <Text type="body" size="sm">
                        {formatSessionDay(s.sessionDate)}
                      </Text>
                      <Text type="supporting" size="sm">
                        {title
                          ? `${position}. ${title}${frozenRow ? ' · đã phát' : ''}`
                          : 'Không có bài — dãy đã hết'}
                      </Text>
                    </HStack>
                  );
                })
              )}
            </Stack>
          </SectionBlock>
        </Stack>
      ) : null}

      {leaveBlocker.dialog}
      <ConfirmDialog
        opened={dropConfirm}
        title="Gỡ bài chưa phát?"
        message={`${Math.max(0, serverTail.length - tailIds.length)} bài chưa phát sẽ ra khỏi dãy. Bài đã phát không đổi.`}
        confirmLabel="Lưu dãy"
        confirmColor="orange"
        loading={assignMut.isPending}
        onConfirm={() => {
          setDropConfirm(false);
          if (tailIds.length > 0) assignMut.mutate({ classBatchId, exerciseIds: tailIds });
        }}
        onCancel={() => setDropConfirm(false)}
      />
    </ListPage>
  );
}

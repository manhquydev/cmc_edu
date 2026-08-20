import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Link, NavLink } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  DetailPage,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  PageHeader,
  SectionBlock,
  Selector,
  Skeleton,
  Stack,
  StatusBadge,
  Text,
  WorkflowStatusbar,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { ClassActivitySection } from './class-activity.js';
import { useSession } from '../../lib/session-context.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { RecordLink } from '../../lib/record-link.js';
import { exerciseSequencePath } from '../teaching/exercise-sequence-model.js';
import { classSectionPath, UUID_RE, studentSectionPath } from '@cmc/links';

const CLASS_STATUS_LABELS: Record<string, string> = {
  planned: 'Dự kiến',
  active: 'Đang mở',
  completed: 'Kết thúc',
  cancelled: 'Đã hủy',
  closed: 'Đã đóng',
};

function classStatusSteps(status: string): {
  steps: { id: string; label: string }[];
  activeIndex: number;
} {
  if (status === 'cancelled') {
    return {
      steps: [
        { id: 'planned', label: 'Dự kiến' },
        { id: 'active', label: 'Đang mở' },
        { id: 'cancelled', label: 'Đã hủy' },
      ],
      activeIndex: 2,
    };
  }
  const steps = [
    { id: 'planned', label: 'Dự kiến' },
    { id: 'active', label: 'Đang mở' },
    { id: 'completed', label: 'Kết thúc' },
  ];
  const activeIndex =
    status === 'completed' || status === 'closed'
      ? 2
      : status === 'active'
        ? 1
        : 0;
  return { steps, activeIndex };
}

// HR remediation phase 5 (R2 #C5): teacher picker — AppUser role giao_vien.
function TeacherPicker({ classBatchId, currentTeacherId }: { classBatchId: string; currentTeacherId: string | null }) {
  const utils = trpc.useUtils();
  // Filtered on the server: the same rule is enforced in `assignTeacher`, so
  // the dropdown cannot offer a choice the mutation would reject.
  const { data, isLoading } = trpc.user.pickList.useQuery({ role: 'giao_vien' });
  const teachers = (data?.items ?? []) as Array<{ id: string; fullName: string }>;
  const currentTeacher = teachers.find((t) => t.id === currentTeacherId);
  const options = teachers.map((t) => ({ value: t.id, label: t.fullName }));

  const assignMut = trpc.classBatch.assignTeacher.useMutation({
    onSuccess: () => void utils.classBatch.get.invalidate({ classBatchId }),
  });

  return (
    <Stack gap={0.5}>
      <Text type="supporting" size="2xs" weight="bold" style={{ textTransform: 'uppercase' }}>
        Giáo viên
      </Text>
      <div style={{ width: 220 }}>
        <Selector
          label="Giáo viên"
          isLabelHidden
          placeholder={isLoading ? 'Đang tải…' : 'Chọn giáo viên'}
          options={options}
          value={currentTeacherId ?? undefined}
          onChange={(v) => v && assignMut.mutate({ classBatchId, teacherAppUserId: v })}
          hasClear={false}
        />
      </div>
      {currentTeacher ? (
        <Text type="supporting" size="sm">
          <RecordLink entity="staff" id={currentTeacher.id}>
            {currentTeacher.fullName}
          </RecordLink>
        </Text>
      ) : null}
      {assignMut.error && (
        <Text type="supporting" size="2xs" style={{ color: 'var(--cmc-danger)' }}>
          {assignMut.error.message}
        </Text>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Sub-tabs
// ---------------------------------------------------------------------------

interface StudentTabRow {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  status: string;
  [key: string]: unknown;
}

function StudentsTab({ classBatchId }: { classBatchId: string }) {
  const location = useLocation();
  const { data, isLoading, error } = trpc.classBatch.listStudents.useQuery({ classBatchId });

  const columns: TableColumn<StudentTabRow>[] = [
    {
      key: 'fullName',
      label: 'Họ tên',
      render: (v, row) => (
        // Phase 5 cross-record link: canonical student profile section with
        // validated same-origin return context back to this class roster.
        <Link
          to={studentSectionPath(row.studentId, 'profile')}
          state={{
            from: {
              pathname: `/admin/classes/${classBatchId}/students`,
              search: location.search,
            },
          }}
        >
          <Text type="body" size="sm" weight="medium">
            {String(v)}
          </Text>
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái đăng ký',
      width: 160,
      render: (v) => (
        <Badge
          label={String(v)}
          variant={String(v) === 'active' ? 'success' : 'neutral'}
        />
      ),
    },
  ];

  return (
    <div className="console-detail-panel">
      <div className="console-list">
        <DataTable<StudentTabRow>
          columns={columns}
          data={(data as StudentTabRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có học viên nào trong lớp."
        />
      </div>
    </div>
  );
}

const SESSION_STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'error' | 'success'> = {
  planned: 'neutral',
  confirmed: 'info',
  cancelled: 'error',
  done: 'success',
};

interface SessionTabRow {
  id: string;
  sessionDate: string | Date;
  startTime: string | Date;
  endTime: string | Date;
  status: string;
  curriculumUnitId: string | null;
  [key: string]: unknown;
}

interface CurriculumUnitRow {
  id: string;
  program: string;
  level: string;
  monthIndex: number;
  unitType: string;
  title: string;
}

// T2-I gap fix (docs/26 WF-P2-01 remainder): `classSession.assignUnit` is the
// ONLY writer of `curriculumUnitId` (class-session-router.ts) — without this
// picker, `exercise/open-tier.ts`'s `curriculumUnitId not null` filter is
// always empty, so students can never open an exercise. `CurriculumUnit` is a
// GLOBAL catalog (no courseId — schema.prisma), keyed by `program`+`level`, so
// this filters the full list down to the class's own `program` client-side
// (same shape the exercises.tsx picker uses, just program-scoped here).
function SessionUnitPicker({
  sessionId,
  classBatchId,
  currentUnitId,
  options,
  isLoading,
  isDisabled,
}: {
  sessionId: string;
  classBatchId: string;
  currentUnitId: string | null;
  options: { value: string; label: string }[];
  isLoading: boolean;
  isDisabled: boolean;
}) {
  const utils = trpc.useUtils();
  const assignMut = trpc.classSession.assignUnit.useMutation({
    onSuccess: () => void utils.classSession.list.invalidate({ classBatchId }),
  });

  return (
    <Stack gap={0.5}>
      <div style={{ width: 240 }}>
        <Selector
          label="Đơn vị học"
          isLabelHidden
          placeholder={isLoading ? 'Đang tải…' : 'Chọn đơn vị học'}
          options={options}
          value={currentUnitId ?? undefined}
          onChange={(v) => v && assignMut.mutate({ sessionId, curriculumUnitId: v })}
          hasClear={false}
          hasSearch
          isDisabled={isDisabled || isLoading}
        />
      </div>
      {assignMut.error && (
        <Text type="supporting" size="2xs" style={{ color: 'var(--cmc-danger)' }}>
          {assignMut.error.message}
        </Text>
      )}
    </Stack>
  );
}

function SessionsTab({
  classBatchId,
  program,
  canGenerateSchedule,
}: {
  classBatchId: string;
  program?: string;
  canGenerateSchedule: boolean;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.classSession.list.useQuery({ classBatchId });
  const { data: unitsData, isLoading: unitsLoading } = trpc.curriculumUnit.list.useQuery();
  const confirmMut = trpc.classSession.confirm.useMutation({
    onSuccess: () => void utils.classSession.list.invalidate({ classBatchId }),
  });
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelMut = trpc.classSession.cancel.useMutation({
    onSuccess: () => {
      void utils.classSession.list.invalidate({ classBatchId });
      setCancelTarget(null);
    },
    onError: (err) => {
      setCancelTarget(null);
      setCancelError(err.message);
    },
  });

  const units = ((unitsData?.items ?? []) as CurriculumUnitRow[]);
  const unitOptions = units
    .filter((u) => !program || u.program === program)
    .map((u) => ({ value: u.id, label: `Lv${u.level} • T${u.monthIndex}: ${u.title}` }));

  // Cancelled sessions are dimmed (opacity) at the row level in the prior UI's
  // Table; DataTable has no per-row style hook, so each cell's rendered
  // content is wrapped individually to approximate the same dimmed look.
  function dim(status: string, content: ReactNode) {
    return <span style={{ opacity: status === 'cancelled' ? 0.5 : 1 }}>{content}</span>;
  }

  const columns: TableColumn<SessionTabRow>[] = [
    {
      key: 'sessionDate',
      label: 'Ngày',
      render: (v, row) => dim(row.status, new Date(v as string).toLocaleDateString('vi-VN')),
    },
    {
      key: 'startTime',
      label: 'Bắt đầu',
      render: (v, row) =>
        dim(
          row.status,
          new Date(v as string).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
    },
    {
      key: 'endTime',
      label: 'Kết thúc',
      render: (v, row) =>
        dim(
          row.status,
          new Date(v as string).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 180,
      render: (v, row) =>
        dim(
          row.status,
          <Badge label={String(v)} variant={SESSION_STATUS_VARIANT[String(v)] ?? 'neutral'} />,
        ),
    },
    {
      key: 'curriculumUnitId',
      label: 'Đơn vị học',
      width: 260,
      render: (v, row) => (
        <SessionUnitPicker
          sessionId={row.id}
          classBatchId={classBatchId}
          currentUnitId={v as string | null}
          options={unitOptions}
          isLoading={unitsLoading}
          isDisabled={
            row.status === 'cancelled' ||
            row.status === 'done' ||
            !canGenerateSchedule
          }
        />
      ),
    },
    {
      key: '_actions',
      label: 'Thao tác',
      width: 160,
      render: (_v, row) => (
        <HStack gap={0.5}>
          <Button
            label="Mở buổi"
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigate(`/teaching/sessions/${row.id}?tab=attendance`);
            }}
          />
          {row.status === 'planned' && canGenerateSchedule && (
            <Button
              label="Xác nhận"
              size="sm"
              variant="secondary"
              isLoading={confirmMut.isPending}
              onClick={() => confirmMut.mutate({ sessionId: row.id })}
            />
          )}
          {canGenerateSchedule && row.status !== 'cancelled' && row.status !== 'done' && (
            <Button
              label="Huỷ"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCancelError(null);
                setCancelTarget(row.id);
              }}
            />
          )}
        </HStack>
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--cmc-space-3)' }}>
      <Stack gap={2}>
        <Text type="supporting" size="xsm">
          Buổi học được sinh tự động khi tạo lớp (theo khung giờ đã chọn).
        </Text>

        {cancelError && (
          <Banner status="error" title="Lỗi huỷ buổi học" description={cancelError} />
        )}

        <DataTable<SessionTabRow>
          columns={columns}
          data={(data as SessionTabRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có buổi học nào."
        />
      </Stack>

      <ConfirmDialog
        opened={cancelTarget !== null}
        title="Huỷ buổi học"
        message="Huỷ buổi học này? Buổi đã huỷ không tính điểm danh; unit các buổi còn lại sẽ được restamp."
        confirmLabel="Huỷ buổi"
        confirmColor="red"
        loading={cancelMut.isPending}
        onConfirm={() => cancelTarget && cancelMut.mutate({ sessionId: cancelTarget })}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClassDetailPage() {
  return <ClassDetailContent />;
}

function ClassDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { section } = useParams<{ section: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const canEditClass = canDo('class', 'create');
  const canGenerateSchedule = canDo('schedule', 'generate');
  const canSequence = canDo('exercise', 'manage');
  const idOk = UUID_RE.test(id ?? '');

  const { data: cls, isLoading, error } = trpc.classBatch.get.useQuery(
    { classBatchId: id ?? '' },
    { enabled: idOk },
  );

  if (!idOk) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh', href: '/admin/students' },
              { label: 'Lớp học', href: '/admin/classes' },
              { label: 'ID không hợp lệ' },
            ]}
          />
        }
      >
        <EmptyState title="ID không hợp lệ" description="URL cần UUID lớp học." />
      </DetailPage>
    );
  }

  const overviewContent = (() => {
    if (isLoading) {
      return (
        <div className="console-detail-panel">
          <Skeleton height={120} radius={1} />
        </div>
      );
    }
    if (error) {
      return (
        <div className="console-detail-panel">
          <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
        </div>
      );
    }
    if (!cls) return null;
    const statusLabel = CLASS_STATUS_LABELS[cls.status] ?? cls.status;
    return (
      <div className="console-detail-panel">
        <div className="console-detail-stack">
          <SectionBlock
            title="Thông tin lớp"
            description="Cùng khung form chứng từ Console (list → form · statusbar · sheet)."
          >
            <KeyValueList
              items={[
                { key: 'code', label: 'Mã lớp', value: cls.code },
                { key: 'program', label: 'Chương trình', value: cls.program },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: <StatusBadge status={cls.status} label={statusLabel} />,
                },
                {
                  key: 'start',
                  label: 'Bắt đầu',
                  value: new Date(cls.startDate).toLocaleDateString('vi-VN'),
                },
                {
                  key: 'end',
                  label: 'Kết thúc',
                  value: new Date(cls.endDate).toLocaleDateString('vi-VN'),
                },
              ]}
            />
          </SectionBlock>
          {canEditClass ? (
            <SectionBlock
              title="Phân công giáo viên"
              description="classBatch.assignTeacher — chỉ giáo viên (server filter), quyền không đổi."
            >
              <TeacherPicker classBatchId={cls.id} currentTeacherId={cls.teacherAppUserId} />
            </SectionBlock>
          ) : null}
          {id ? <ClassActivitySection classBatchId={id} /> : null}
        </div>
      </div>
    );
  })();

  const tabs: Array<{
    id: 'overview' | 'students' | 'sessions';
    label: string;
    content: ReactNode;
  }> = [
    { id: 'overview', label: 'Tổng quan', content: overviewContent },
    { id: 'students', label: 'Học viên', content: id ? <StudentsTab classBatchId={id} /> : null },
    {
      id: 'sessions',
      label: 'Buổi học',
      content: id ? (
        <SessionsTab
          classBatchId={id}
          program={cls?.program}
          canGenerateSchedule={canGenerateSchedule}
        />
      ) : null,
    },
  ];
  const activeTab = section ?? 'overview';

  const statusBar = cls ? classStatusSteps(cls.status) : null;
  const statusLabel = cls
    ? (CLASS_STATUS_LABELS[cls.status] ?? cls.status)
    : '—';

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Lớp & Học sinh', href: '/admin/students' },
            { label: 'Lớp học', href: '/admin/classes' },
            { label: cls?.code ?? '…' },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              {id && canSequence ? (
                <Button
                  label="Xếp dãy bài"
                  size="sm"
                  variant="primary"
                  onClick={() => navigate(exerciseSequencePath(id))}
                />
              ) : null}
              {id ? <CopyLinkButton mode="go" entity="classBatch" id={id} /> : null}
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate({ pathname: '/admin/classes', search: location.search })}
              />
            </HStack>
          }
        />
      }
      entity={
        cls ? (
          <EntityHeader
            title={cls.code}
            subtitle={cls.program}
            initials={cls.code.slice(0, 2).toUpperCase()}
            badges={<StatusBadge status={cls.status} label={statusLabel} />}
            meta={
              <span>
                {new Date(cls.startDate).toLocaleDateString('vi-VN')}
                {' – '}
                {new Date(cls.endDate).toLocaleDateString('vi-VN')}
              </span>
            }
            actions={
              <Button
                label="Tổng quan lớp"
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/admin/classes/${id}/overview`)}
              />
            }
          />
        ) : isLoading ? (
          <Skeleton height={88} radius={1} />
        ) : null
      }
      summary={
        cls ? (
          <HighlightStrip
            items={[
              { key: 'code', label: 'Mã lớp', value: cls.code },
              { key: 'program', label: 'Chương trình', value: cls.program },
              {
                key: 'status',
                label: 'Trạng thái',
                value: <StatusBadge status={cls.status} label={statusLabel} />,
              },
              {
                key: 'range',
                label: 'Thời gian',
                value: `${new Date(cls.startDate).toLocaleDateString('vi-VN')} – ${new Date(cls.endDate).toLocaleDateString('vi-VN')}`,
              },
            ]}
          />
        ) : undefined
      }
      statusbar={
        statusBar ? (
          <WorkflowStatusbar steps={statusBar.steps} activeIndex={statusBar.activeIndex} />
        ) : undefined
      }
      tabs={
        <nav className="console-section-tabs" aria-label="Phân đoạn lớp học">
          {tabs.map((t) => (
            <NavLink
              key={t.id}
              to={{ pathname: classSectionPath(id!, t.id), search: location.search }}
              end
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      }
      children={tabs.find((t) => t.id === activeTab)?.content ?? overviewContent}
    />
  );
}

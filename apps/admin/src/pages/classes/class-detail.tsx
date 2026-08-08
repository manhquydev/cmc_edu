import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  CmcTabs,
  ConfirmDialog,
  DataTable,
  DetailPage,
  Dialog,
  DialogHeader,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  LineIcon,
  PageHeader,
  SectionBlock,
  Selector,
  Skeleton,
  Stack,
  StatusBadge,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// HR remediation phase 5 (R2 #C5): teacher picker — AppUser role giao_vien.
function TeacherPicker({ classBatchId, currentTeacherId }: { classBatchId: string; currentTeacherId: string | null }) {
  const utils = trpc.useUtils();
  // Filtered on the server: the same rule is enforced in `assignTeacher`, so
  // the dropdown cannot offer a choice the mutation would reject.
  const { data, isLoading } = trpc.user.pickList.useQuery({ role: 'giao_vien' });
  const teachers = (data?.items ?? []) as Array<{ id: string; fullName: string }>;
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
  fullName: string;
  status: string;
  [key: string]: unknown;
}

function StudentsTab({ classBatchId }: { classBatchId: string }) {
  const { data, isLoading, error } = trpc.classBatch.listStudents.useQuery({ classBatchId });

  const columns: TableColumn<StudentTabRow>[] = [
    {
      key: 'fullName',
      label: 'Họ tên',
      render: (v) => (
        <Text type="body" size="sm" weight="medium">
          {String(v)}
        </Text>
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
  isMakeup: boolean;
  curriculumUnitId: string | null;
  [key: string]: unknown;
}

interface CurriculumUnitRow {
  id: string;
  program: string;
  level: number;
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

function SessionsTab({ classBatchId, program }: { classBatchId: string; program?: string }) {
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

  const [makeupOpen, setMakeupOpen] = useState(false);
  const [makeupForm, setMakeupForm] = useState({ sessionDate: '', startTime: '', endTime: '' });
  const addMakeupMut = trpc.classSession.addMakeup.useMutation({
    onSuccess: () => {
      void utils.classSession.list.invalidate({ classBatchId });
      setMakeupOpen(false);
      setMakeupForm({ sessionDate: '', startTime: '', endTime: '' });
    },
  });

  function closeMakeupDialog() {
    if (addMakeupMut.isPending) return;
    setMakeupOpen(false);
    setMakeupForm({ sessionDate: '', startTime: '', endTime: '' });
    addMakeupMut.reset();
  }

  const makeupValid =
    DATE_RE.test(makeupForm.sessionDate) &&
    TIME_RE.test(makeupForm.startTime) &&
    TIME_RE.test(makeupForm.endTime) &&
    makeupForm.startTime < makeupForm.endTime;

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
          <HStack gap={0.5}>
            <Badge label={String(v)} variant={SESSION_STATUS_VARIANT[String(v)] ?? 'neutral'} />
            {row.isMakeup && <Badge label="makeup" variant="warning" />}
          </HStack>,
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
          isDisabled={row.status === 'cancelled' || row.status === 'done'}
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
          {row.status === 'planned' && (
            <Button
              label="Xác nhận"
              size="sm"
              variant="secondary"
              isLoading={confirmMut.isPending}
              onClick={() => confirmMut.mutate({ sessionId: row.id })}
            />
          )}
          {row.status !== 'cancelled' && row.status !== 'done' && (
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
        <HStack justify="between" align="center">
          <Text type="supporting" size="xsm">
            Buổi học được sinh tự động khi tạo lớp (theo khung giờ đã chọn). Dùng nút bên phải để thêm buổi bù
            phát sinh ngoài lịch.
          </Text>
          <Button label="+ Thêm buổi bù" size="sm" variant="secondary" onClick={() => setMakeupOpen(true)} />
        </HStack>

        {cancelError && (
          <Banner status="error" title="Lỗi huỷ buổi học" description={cancelError} />
        )}

        <DataTable<SessionTabRow>
          columns={columns}
          data={(data as SessionTabRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty='Chưa có buổi học nào. Dùng nút "+ Thêm buổi bù" để thêm một buổi.'
        />
      </Stack>

      <ConfirmDialog
        opened={cancelTarget !== null}
        title="Huỷ buổi học"
        message="Huỷ buổi học này? Buổi đã huỷ sẽ không được tính vào điểm danh và không thể khôi phục."
        confirmLabel="Huỷ buổi"
        confirmColor="red"
        loading={cancelMut.isPending}
        onConfirm={() => cancelTarget && cancelMut.mutate({ sessionId: cancelTarget })}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Makeup session dialog — `classSession.addMakeup` (isMakeup=true),
          scoped to this batch's own room (server resolves it, not the form). */}
      <Dialog
        isOpen={makeupOpen}
        onOpenChange={(next) => {
          if (!next) closeMakeupDialog();
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title="Thêm buổi bù"
          onOpenChange={(next) => {
            if (!next) closeMakeupDialog();
          }}
        />
        <Stack gap={2} padding={4}>
          <TextInput
            label="Ngày (YYYY-MM-DD)"
            placeholder="2026-08-15"
            isRequired
            value={makeupForm.sessionDate}
            onChange={(v) => setMakeupForm((f) => ({ ...f, sessionDate: v }))}
          />
          <HStack gap={1}>
            <div style={{ flex: 1 }}>
              <TextInput
                label="Giờ bắt đầu (HH:mm)"
                placeholder="18:00"
                isRequired
                value={makeupForm.startTime}
                onChange={(v) => setMakeupForm((f) => ({ ...f, startTime: v }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <TextInput
                label="Giờ kết thúc (HH:mm)"
                placeholder="19:30"
                isRequired
                value={makeupForm.endTime}
                onChange={(v) => setMakeupForm((f) => ({ ...f, endTime: v }))}
              />
            </div>
          </HStack>
          {addMakeupMut.error && (
            <Banner status="error" title="Lỗi thêm buổi bù" description={addMakeupMut.error.message} />
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={closeMakeupDialog}
              isDisabled={addMakeupMut.isPending}
            />
            <Button
              label="Thêm buổi bù"
              variant="primary"
              isLoading={addMakeupMut.isPending}
              isDisabled={!makeupValid}
              onClick={() =>
                addMakeupMut.mutate({
                  classBatchId,
                  sessionDate: makeupForm.sessionDate,
                  startTime: makeupForm.startTime,
                  endTime: makeupForm.endTime,
                })
              }
            />
          </HStack>
        </Stack>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClassDetailPage() {
  const { canDo } = useSession();

  // Same guard as the list screen it is reached from — otherwise the URL is a
  // way around the list guard straight to the roster tab.
  if (!canDo('class', 'create')) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh', href: '/admin/students' },
              { label: 'Lớp học', href: '/admin/classes' },
              { label: 'Chi tiết' },
            ]}
          />
        }
      >
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý lớp học (class.create)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </DetailPage>
    );
  }

  return <ClassDetailContent />;
}

function ClassDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: cls, isLoading, error } = trpc.classBatch.get.useQuery(
    { classBatchId: id! },
    { enabled: Boolean(id) },
  );

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
    return (
      <div className="console-detail-panel">
        <div className="console-detail-stack">
          <SectionBlock title="Thông tin lớp" description="Tổng quan kỳ học — cùng recipe KeyValue với màn chi tiết khác.">
            <KeyValueList
              items={[
                { key: 'code', label: 'Mã lớp', value: cls.code },
                { key: 'program', label: 'Chương trình', value: cls.program },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  value: <StatusBadge status={cls.status} />,
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
          <SectionBlock title="Phân công giáo viên">
            <TeacherPicker classBatchId={cls.id} currentTeacherId={cls.teacherAppUserId} />
          </SectionBlock>
        </div>
      </div>
    );
  })();

  const tabs = [
    { id: 'overview', label: 'Tổng quan', content: overviewContent },
    { id: 'students', label: 'Học viên', content: id ? <StudentsTab classBatchId={id} /> : null },
    {
      id: 'sessions',
      label: 'Buổi học',
      content: id ? <SessionsTab classBatchId={id} program={cls?.program} /> : null,
    },
  ];

  return (
    <DetailPage
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Lớp & Học sinh', href: '/admin/students' },
            { label: 'Lớp học', href: '/admin/classes' },
            { label: cls?.code ?? '…' },
          ]}
          actions={id ? <CopyLinkButton mode="go" entity="classBatch" id={id} /> : undefined}
        />
      }
      entity={
        cls ? (
          <EntityHeader
            title={cls.code}
            subtitle={cls.program}
            initials={cls.code.slice(0, 2).toUpperCase()}
            badges={<StatusBadge status={cls.status} />}
            meta={
              <span>
                {new Date(cls.startDate).toLocaleDateString('vi-VN')}
                {' – '}
                {new Date(cls.endDate).toLocaleDateString('vi-VN')}
              </span>
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
                value: <StatusBadge status={cls.status} />,
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
      tabs={<CmcTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />}
    />
  );
}

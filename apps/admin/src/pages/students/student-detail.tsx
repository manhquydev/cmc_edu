import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  DetailPage,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  LineIcon,
  PageHeader,
  SectionBlock,
  Selector,
  StatusBadge,
  WorkflowStatusbar,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { returnContextFromState } from '../../lib/safe-return-to.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { EnrollmentRangesPanel } from './enrollment-ranges-panel.js';

interface StudentState {
  id: string;
  fullName: string;
  lifecycle: string;
}

const LIFECYCLE_OPTIONS = [
  { value: 'active', label: 'Đang học' },
  { value: 'blocked_lms', label: 'Khóa LMS' },
  { value: 'withdrawn', label: 'Rút học' },
];

const LIFECYCLE_LABELS: Record<string, string> = {
  active: 'Đang học',
  blocked_lms: 'Khóa LMS',
  withdrawn: 'Rút học',
};

const LIFECYCLE_CONSEQUENCES: Record<string, string> = {
  blocked_lms:
    'Khóa LMS sẽ ngăn học viên đăng nhập ứng dụng học. Hành động này sẽ được ghi nhận trong nhật ký kiểm tra. Tiếp tục?',
  withdrawn:
    'Đánh dấu rút học xác nhận học viên đã kết thúc chương trình tại cơ sở. Tiếp tục?',
  active: 'Khôi phục trạng thái học viên về đang học. Tiếp tục?',
};

/** Multi-step lifecycle strip — same states as setLifecycle (domain unchanged). */
function lifecycleSteps(lifecycle: string): {
  steps: { id: string; label: string }[];
  activeIndex: number;
} {
  const steps = [
    { id: 'active', label: 'Đang học' },
    { id: 'blocked_lms', label: 'Khóa LMS' },
    { id: 'withdrawn', label: 'Rút học' },
  ];
  const idx =
    lifecycle === 'withdrawn' ? 2 : lifecycle === 'blocked_lms' ? 1 : 0;
  return { steps, activeIndex: idx };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { canDo } = useSession();

  // Prefer route fetch so deep-link / refresh still loads identity (red-team C1).
  // location.state is a warm-path optimistic seed ONLY while the query is in
  // flight — once settled, the query is the sole source so a deleted/other-
  // facility id shows EmptyState even when list state still holds a row.
  const stateStudent = (location.state as { student?: StudentState } | null)?.student;
  const getQ = trpc.student.get.useQuery(
    { id: id ?? '' },
    { enabled: Boolean(id && id.length > 0), refetchOnWindowFocus: false },
  );
  const mapStudent = (row: { id: string; fullName: string; lifecycle: string }): StudentState => ({
    id: row.id,
    fullName: row.fullName,
    lifecycle: row.lifecycle,
  });
  const querySettled = !getQ.isLoading && !getQ.isFetching;
  const student: StudentState | undefined = (() => {
    if (getQ.data != null) return mapStudent(getQ.data);
    // Warm seed only during load — never after success/error (H1 code review).
    if (!querySettled && stateStudent?.id === id) return stateStudent;
    return undefined;
  })();

  const [pendingLifecycle, setPendingLifecycle] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { section } = useParams<{ section: string }>();

  const utils = trpc.useUtils();
  const setLifecycleMut = trpc.student.setLifecycle.useMutation({
    onSuccess: () => {
      setConfirmOpen(false);
      setPendingLifecycle(null);
      void utils.student.lookup.invalidate();
      if (id) void utils.student.get.invalidate({ id });
    },
  });

  const canSetLifecycle = canDo('student', 'setLifecycle');
  const canGrantUnits = canDo('enrollment', 'grantUnits');
  const displayName = student?.fullName ?? (!querySettled ? 'Đang tải…' : 'Chi tiết học viên');
  const notFound =
    Boolean(id) && querySettled && student == null && (getQ.isError || getQ.isSuccess);
  // Phase 5 cross-record return: class roster links carry {from} in router
  // state; direct/F5 falls back to the student list.
  const backPath = returnContextFromState(location.state, '/admin/students');
  const crossRecord = backPath !== '/admin/students';

  function handleApply() {
    if (!id || !pendingLifecycle) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!id || !pendingLifecycle) return;
    setLifecycleMut.mutate({
      studentId: id,
      lifecycle: pendingLifecycle as 'active' | 'blocked_lms' | 'withdrawn',
    });
  }

  const tabs = [
    {
      id: 'profile',
      label: 'Hồ sơ',
      content: (
        <div className="console-detail-panel">
          <div className="console-detail-stack">
            <SectionBlock
              title="Thông tin học viên"
              description="Cùng khung form chứng từ Console (list → form · statusbar · sheet)."
            >
              <KeyValueList
                items={[
                  {
                    key: 'name',
                    label: 'Họ tên',
                    value: student?.fullName ?? `ID: ${id}`,
                  },
                  {
                    key: 'lifecycle',
                    label: 'Trạng thái',
                    value: student ? (
                      <StatusBadge
                        status={student.lifecycle}
                        label={
                          LIFECYCLE_LABELS[student.lifecycle] ?? student.lifecycle
                        }
                      />
                    ) : (
                      '—'
                    ),
                  },
                  {
                    key: 'id',
                    label: 'Mã hệ thống',
                    value: id ?? '—',
                    fullWidth: true,
                  },
                ]}
              />
            </SectionBlock>

            {canSetLifecycle ? (
              <SectionBlock
                title="Đổi trạng thái"
                description="Gọi student.setLifecycle — xác nhận trước khi ghi nhật ký (quyền không đổi)."
              >
                <HStack gap={2} align="end">
                  <div style={{ width: 200 }}>
                    <Selector
                      label="Đổi trạng thái"
                      placeholder="Chọn trạng thái…"
                      value={pendingLifecycle ?? undefined}
                      onChange={(v) => setPendingLifecycle(v)}
                      options={LIFECYCLE_OPTIONS}
                      size="sm"
                    />
                  </div>
                  <Button
                    label="Áp dụng"
                    size="sm"
                    variant="primary"
                    isDisabled={!pendingLifecycle || setLifecycleMut.isPending}
                    onClick={handleApply}
                  />
                </HStack>
                {setLifecycleMut.error ? (
                  <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
                    {setLifecycleMut.error.message}
                  </span>
                ) : null}
              </SectionBlock>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'enrollments',
      label: 'Lớp học',
      content: (
        <div className="console-detail-panel">
          {canGrantUnits && id ? (
            <EnrollmentRangesPanel studentId={id} />
          ) : (
            <EmptyState
              title="Không có quyền cấp unit"
              description="Chỉ GĐĐT (enrollment.grantUnits) xem và cấp range."
              icon={<LineIcon name="layers" size={28} />}
            />
          )}
        </div>
      ),
    },
  ];
  const activeTab = section ?? 'profile';

  if (notFound) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh', href: '/admin/students' },
              { label: 'Học viên', href: '/admin/students' },
              { label: 'Không tìm thấy' },
            ]}
          />
        }
      >
        <EmptyState
          title="Không tìm thấy học viên"
          description="Liên kết có thể đã hết hạn hoặc học viên không thuộc cơ sở hiện tại."
          icon={<LineIcon name="users" size={28} />}
        />
      </DetailPage>
    );
  }

  const lifecycleBar = student
    ? lifecycleSteps(student.lifecycle)
    : { steps: lifecycleSteps('active').steps, activeIndex: 0 };
  const lifecycleLabel = student
    ? (LIFECYCLE_LABELS[student.lifecycle] ?? student.lifecycle)
    : '—';

  return (
    <>
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh', href: '/admin/students' },
              { label: 'Học viên', href: backPath },
              { label: student?.fullName ?? '…' },
            ]}
            actions={
              <HStack gap={1} wrap="wrap">
                {id ? <CopyLinkButton mode="go" entity="student" id={id} /> : null}
                {crossRecord ? (
                  <Button
                    label="Về danh sách học viên của lớp"
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(backPath)}
                  />
                ) : null}
                <Button
                  label="Về danh sách"
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/admin/students')}
                />
              </HStack>
            }
          />
        }
        entity={
          <EntityHeader
            title={displayName}
            subtitle={id ? `Mã: ${id.slice(0, 8)}…` : undefined}
            initials={student ? initialsFromName(student.fullName) : 'HS'}
            badges={
              student ? (
                <StatusBadge
                  status={student.lifecycle}
                  label={LIFECYCLE_LABELS[student.lifecycle] ?? student.lifecycle}
                />
              ) : undefined
            }
            meta={
              student ? (
                <span>Học viên · {lifecycleLabel}</span>
              ) : !querySettled ? (
                <span>Đang tải hồ sơ học viên…</span>
              ) : (
                <span>Chưa có dữ liệu học viên</span>
              )
            }
            actions={
              canSetLifecycle ? (
                <Button
                  label="Đổi trạng thái"
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/admin/students/${id}/profile`)}
                />
              ) : undefined
            }
          />
        }
        summary={
          <HighlightStrip
            items={[
              { key: 'name', label: 'Họ tên', value: displayName },
              {
                key: 'lifecycle',
                label: 'Trạng thái',
                value: student ? (
                  <StatusBadge
                    status={student.lifecycle}
                    label={LIFECYCLE_LABELS[student.lifecycle] ?? student.lifecycle}
                  />
                ) : (
                  '—'
                ),
              },
              {
                key: 'id',
                label: 'Mã',
                value: id ? `${id.slice(0, 8)}…` : '—',
              },
            ]}
          />
        }
        statusbar={
          student ? (
            <WorkflowStatusbar
              steps={lifecycleBar.steps}
              activeIndex={lifecycleBar.activeIndex}
            />
          ) : undefined
        }
        tabs={
          <nav className="console-section-tabs" aria-label="Phân đoạn hồ sơ học viên">
            {tabs.map((t) => (
              <NavLink key={t.id} to={`/admin/students/${id}/${t.id}`} end>
                {t.label}
              </NavLink>
            ))}
          </nav>
        }
        children={tabs.find((t) => t.id === activeTab)?.content ?? tabs[0].content}
      />
      <ConfirmDialog
        opened={confirmOpen}
        title="Xác nhận đổi trạng thái"
        message={
          LIFECYCLE_CONSEQUENCES[pendingLifecycle ?? ''] ??
          'Xác nhận thay đổi trạng thái học viên?'
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        loading={setLifecycleMut.isPending}
        confirmColor={
          pendingLifecycle === 'blocked_lms'
            ? 'orange'
            : pendingLifecycle === 'withdrawn'
              ? 'red'
              : 'green'
        }
        confirmLabel="Xác nhận"
      />
    </>
  );
}

import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  Button,
  CmcTabs,
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
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';

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

const LIFECYCLE_CONSEQUENCES: Record<string, string> = {
  blocked_lms:
    'Khóa LMS sẽ ngăn học viên đăng nhập ứng dụng học. Hành động này sẽ được ghi nhận trong nhật ký kiểm tra. Tiếp tục?',
  withdrawn:
    'Đánh dấu rút học xác nhận học viên đã kết thúc chương trình tại cơ sở. Tiếp tục?',
  active: 'Khôi phục trạng thái học viên về đang học. Tiếp tục?',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { canDo } = useSession();

  // Prefer route fetch so deep-link / refresh still loads identity (red-team C1).
  // location.state is a warm-path cache from the list click only.
  const stateStudent = (location.state as { student?: StudentState } | null)?.student;
  const getQ = trpc.student.get.useQuery(
    { id: id ?? '' },
    { enabled: Boolean(id && id.length > 0), refetchOnWindowFocus: false },
  );
  const student: StudentState | undefined =
    getQ.data != null
      ? {
          id: getQ.data.id,
          fullName: getQ.data.fullName,
          lifecycle: getQ.data.lifecycle,
        }
      : stateStudent?.id === id
        ? stateStudent
        : undefined;

  const [pendingLifecycle, setPendingLifecycle] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

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
  const displayName = student?.fullName ?? (getQ.isLoading ? 'Đang tải…' : 'Chi tiết học viên');
  const notFound =
    Boolean(id) &&
    !getQ.isLoading &&
    !getQ.isFetching &&
    student == null &&
    (getQ.isError || getQ.isSuccess);

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
        <div className="tpl-detail-panel">
          <div className="tpl-detail-stack">
            <SectionBlock title="Thông tin học viên" description="Trường hiển thị theo recipe detail hệ thống.">
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
                      <StatusBadge status={student.lifecycle} />
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
              <SectionBlock title="Đổi trạng thái" description="Cần xác nhận trước khi ghi nhật ký.">
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
                  <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
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
        <div className="tpl-detail-panel">
          <EmptyState
            title="Chưa có dữ liệu"
            description="API danh sách lớp học theo học viên chưa khả dụng."
            icon={<LineIcon name="layers" size={28} />}
          />
        </div>
      ),
    },
    {
      id: 'attendance',
      label: 'Điểm danh',
      content: (
        <div className="tpl-detail-panel">
          <EmptyState
            title="Chưa có dữ liệu"
            description="API điểm danh cá nhân học viên chưa khả dụng."
            icon={<LineIcon name="check-circle" size={28} />}
          />
        </div>
      ),
    },
    {
      id: 'grades',
      label: 'Điểm số',
      content: (
        <div className="tpl-detail-panel">
          <EmptyState
            title="Chưa có dữ liệu"
            description="API điểm số học viên chưa khả dụng."
            icon={<LineIcon name="clipboard" size={28} />}
          />
        </div>
      ),
    },
    {
      id: 'guardians',
      label: 'Phụ huynh',
      content: (
        <div className="tpl-detail-panel">
          <EmptyState
            title="Chưa có dữ liệu"
            description="API danh sách phụ huynh liên kết chưa khả dụng."
            icon={<LineIcon name="users" size={28} />}
          />
        </div>
      ),
    },
  ];

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

  return (
    <>
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh', href: '/admin/students' },
              { label: 'Học viên', href: '/admin/students' },
              { label: student?.fullName ?? '…' },
            ]}
            actions={id ? <CopyLinkButton mode="go" entity="student" id={id} /> : undefined}
          />
        }
        entity={
          <EntityHeader
            title={displayName}
            subtitle={id ? `Mã: ${id.slice(0, 8)}…` : undefined}
            initials={student ? initialsFromName(student.fullName) : 'HS'}
            badges={
              student ? <StatusBadge status={student.lifecycle} /> : undefined
            }
            meta={
              student ? (
                <span>Lifecycle · {student.lifecycle}</span>
              ) : getQ.isLoading ? (
                <span>Đang tải hồ sơ học viên…</span>
              ) : (
                <span>Chưa có dữ liệu học viên</span>
              )
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
                value: student ? <StatusBadge status={student.lifecycle} /> : '—',
              },
              {
                key: 'id',
                label: 'Mã',
                value: id ? `${id.slice(0, 8)}…` : '—',
              },
            ]}
          />
        }
        tabs={<CmcTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />}
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

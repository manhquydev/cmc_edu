import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  Button,
  CmcTabs,
  ConfirmDialog,
  EmptyState,
  HStack,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

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

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { canDo } = useSession();

  const student = (location.state as { student?: StudentState } | null)?.student;
  const [pendingLifecycle, setPendingLifecycle] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const utils = trpc.useUtils();
  const setLifecycleMut = trpc.student.setLifecycle.useMutation({
    onSuccess: () => {
      setConfirmOpen(false);
      setPendingLifecycle(null);
      void utils.student.lookup.invalidate();
    },
  });

  const canSetLifecycle = canDo('student', 'setLifecycle');

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
        <Stack padding={4} gap={2}>
          <HStack gap={1}>
            <Text weight="semibold" size="sm">
              Họ tên:
            </Text>
            <Text size="sm">{student?.fullName ?? `ID: ${id}`}</Text>
          </HStack>
          <HStack gap={1}>
            <Text weight="semibold" size="sm">
              Trạng thái:
            </Text>
            {student ? (
              <StatusBadge status={student.lifecycle} />
            ) : (
              <Text type="supporting" size="sm">
                —
              </Text>
            )}
          </HStack>

          {canSetLifecycle && (
            <HStack gap={2} align="end" style={{ marginTop: 16 }}>
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
          )}

          {setLifecycleMut.error && (
            // TODO(astryx-review): Text's color enum (primary/secondary/disabled/
            // placeholder/accent/inherit) has no error/danger slot — plain <span>
            // with the CSS var per migration flag rule for raw-color text.
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
              {setLifecycleMut.error.message}
            </span>
          )}
        </Stack>
      ),
    },
    {
      id: 'enrollments',
      label: 'Lớp học',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API danh sách lớp học theo học viên chưa khả dụng."
          icon="📚"
        />
      ),
    },
    {
      id: 'attendance',
      label: 'Điểm danh',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API điểm danh cá nhân học viên chưa khả dụng."
          icon="✅"
        />
      ),
    },
    {
      id: 'grades',
      label: 'Điểm số',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API điểm số học viên chưa khả dụng."
          icon="📊"
        />
      ),
    },
    {
      id: 'guardians',
      label: 'Phụ huynh',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API danh sách phụ huynh liên kết chưa khả dụng."
          icon="👨‍👩‍👧"
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={student?.fullName ?? 'Chi tiết học viên'}
        breadcrumbs={[
          { label: 'Quản trị' },
          { label: 'Học viên', href: '/admin/students' },
          { label: student?.fullName ?? '…' },
        ]}
        actions={student ? <StatusBadge status={student.lifecycle} size="lg" /> : undefined}
      />
      <CmcTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
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

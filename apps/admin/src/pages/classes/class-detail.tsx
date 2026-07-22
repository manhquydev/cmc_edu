import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  CmcTabs,
  DataTable,
  EmptyState,
  HStack,
  LineIcon,
  PageHeader,
  Selector,
  Skeleton,
  Stack,
  StatusBadge,
  Text,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

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
    <div style={{ padding: 16 }}>
      <DataTable<StudentTabRow>
        columns={columns}
        data={(data as StudentTabRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có học viên nào trong lớp."
      />
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
  [key: string]: unknown;
}

function SessionsTab({ classBatchId }: { classBatchId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.classSession.list.useQuery({ classBatchId });
  const confirmMut = trpc.classSession.confirm.useMutation({
    onSuccess: () => void utils.classSession.list.invalidate({ classBatchId }),
  });
  const cancelMut = trpc.classSession.cancel.useMutation({
    onSuccess: () => void utils.classSession.list.invalidate({ classBatchId }),
  });

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
      key: '_actions',
      label: 'Thao tác',
      width: 160,
      render: (_v, row) => (
        <HStack gap={0.5}>
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
              isLoading={cancelMut.isPending}
              onClick={() => cancelMut.mutate({ sessionId: row.id })}
            />
          )}
        </HStack>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <DataTable<SessionTabRow>
        columns={columns}
        data={(data as SessionTabRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty='Chưa có buổi học nào. Dùng "Sinh buổi học" từ quản lý lớp.'
      />
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
      <>
        <PageHeader title="Chi tiết lớp" breadcrumbs={[{ label: 'Quản trị' }, { label: 'Lớp học' }]} />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý lớp học (class.create)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
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
    if (isLoading) return <Skeleton height={120} style={{ margin: 16 }} />;
    if (error)
      return (
        <div style={{ margin: 16 }}>
          <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
        </div>
      );
    if (!cls) return null;
    return (
      <Stack padding={4} gap={2}>
        <HStack gap={6}>
          <Stack gap={0.5}>
            <Text type="supporting" size="2xs" weight="bold" style={{ textTransform: 'uppercase' }}>
              Mã lớp
            </Text>
            <Text size="sm" weight="medium">{cls.code}</Text>
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" size="2xs" weight="bold" style={{ textTransform: 'uppercase' }}>
              Chương trình
            </Text>
            <Text size="sm">{cls.program}</Text>
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" size="2xs" weight="bold" style={{ textTransform: 'uppercase' }}>
              Trạng thái
            </Text>
            <StatusBadge status={cls.status} />
          </Stack>
        </HStack>
        <HStack gap={6}>
          <Stack gap={0.5}>
            <Text type="supporting" size="2xs" weight="bold" style={{ textTransform: 'uppercase' }}>
              Bắt đầu
            </Text>
            <Text size="sm">{new Date(cls.startDate).toLocaleDateString('vi-VN')}</Text>
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" size="2xs" weight="bold" style={{ textTransform: 'uppercase' }}>
              Kết thúc
            </Text>
            <Text size="sm">{new Date(cls.endDate).toLocaleDateString('vi-VN')}</Text>
          </Stack>
          <TeacherPicker classBatchId={cls.id} currentTeacherId={cls.teacherAppUserId} />
        </HStack>
      </Stack>
    );
  })();

  const tabs = [
    { id: 'overview', label: 'Tổng quan', content: overviewContent },
    { id: 'students', label: 'Học viên', content: id ? <StudentsTab classBatchId={id} /> : null },
    { id: 'sessions', label: 'Buổi học', content: id ? <SessionsTab classBatchId={id} /> : null },
  ];

  return (
    <>
      <PageHeader
        title={cls?.code ?? 'Chi tiết lớp học'}
        breadcrumbs={[
          { label: 'Quản trị' },
          { label: 'Lớp học', href: '/admin/classes' },
          { label: cls?.code ?? '…' },
        ]}
        actions={cls ? <StatusBadge status={cls.status} size="lg" /> : undefined}
      />
      <CmcTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}

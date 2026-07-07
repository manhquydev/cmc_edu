import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Group, Stack, Text } from '@mantine/core';
import { CmcTabs, EmptyState, PageHeader, StatusBadge } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const {
    data: cls,
    isLoading,
    error,
  } = trpc.classBatch.get.useQuery({ classBatchId: id! }, { enabled: Boolean(id) });

  const overviewContent = (() => {
    if (isLoading) return <Text p="md" fz="sm" c="dimmed">Đang tải…</Text>;
    if (error) return <Alert color="red" m="md">{error.message}</Alert>;
    if (!cls) return null;
    return (
      <Stack p="md" gap="sm">
        <Group gap="xl">
          <Stack gap={2}>
            <Text fz={11} tt="uppercase" c="dimmed" fw={600}>Mã lớp</Text>
            <Text fz="sm" fw={500}>{cls.code}</Text>
          </Stack>
          <Stack gap={2}>
            <Text fz={11} tt="uppercase" c="dimmed" fw={600}>Chương trình</Text>
            <Text fz="sm">{cls.program}</Text>
          </Stack>
          <Stack gap={2}>
            <Text fz={11} tt="uppercase" c="dimmed" fw={600}>Trạng thái</Text>
            <StatusBadge status={cls.status} />
          </Stack>
        </Group>
        <Group gap="xl">
          <Stack gap={2}>
            <Text fz={11} tt="uppercase" c="dimmed" fw={600}>Bắt đầu</Text>
            <Text fz="sm">{new Date(cls.startDate).toLocaleDateString('vi-VN')}</Text>
          </Stack>
          <Stack gap={2}>
            <Text fz={11} tt="uppercase" c="dimmed" fw={600}>Kết thúc</Text>
            <Text fz="sm">{new Date(cls.endDate).toLocaleDateString('vi-VN')}</Text>
          </Stack>
          {cls.teacherId && (
            <Stack gap={2}>
              <Text fz={11} tt="uppercase" c="dimmed" fw={600}>Giáo viên (ID)</Text>
              <Text fz="sm">{cls.teacherId}</Text>
            </Stack>
          )}
        </Group>
      </Stack>
    );
  })();

  const tabs = [
    { id: 'overview', label: 'Tổng quan', content: overviewContent },
    {
      id: 'students',
      label: 'Học viên',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API danh sách học viên trong lớp chưa khả dụng."
          icon="🎓"
        />
      ),
    },
    {
      id: 'sessions',
      label: 'Buổi học',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API danh sách buổi học chưa khả dụng."
          icon="📅"
        />
      ),
    },
    {
      id: 'enrollment',
      label: 'Đăng ký',
      content: (
        <EmptyState
          title="Chưa có dữ liệu"
          description="API đăng ký lớp học chưa khả dụng."
          icon="📝"
        />
      ),
    },
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

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { CmcTabs, PageHeader, StatusBadge } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Sub-tabs
// ---------------------------------------------------------------------------

function StudentsTab({ classBatchId }: { classBatchId: string }) {
  const { data, isLoading, error } = trpc.classBatch.listStudents.useQuery({ classBatchId });
  if (isLoading) return <Skeleton height={120} m="md" />;
  if (error) return <Alert color="red" m="md">{error.message}</Alert>;
  if (!data || data.length === 0) return (
    <Box p="xl" ta="center"><Text c="dimmed">Chưa có học viên nào trong lớp.</Text></Box>
  );
  return (
    <Box p="md" style={{ overflowX: 'auto' }}>
      <Table striped fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Họ tên</Table.Th>
            <Table.Th>Trạng thái đăng ký</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((s, idx) => (
            <Table.Tr key={s.enrollmentId}>
              <Table.Td c="dimmed">{idx + 1}</Table.Td>
              <Table.Td fw={500}>{s.fullName}</Table.Td>
              <Table.Td>
                <Badge size="xs" radius="xs" color={s.status === 'active' ? 'green' : 'gray'}>
                  {s.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

const SESSION_STATUS_COLOR: Record<string, string> = {
  planned: 'gray',
  confirmed: 'blue',
  cancelled: 'red',
};

function SessionsTab({ classBatchId }: { classBatchId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.classSession.list.useQuery({ classBatchId });
  const confirmMut = trpc.classSession.confirm.useMutation({
    onSuccess: () => void utils.classSession.list.invalidate({ classBatchId }),
  });
  const cancelMut = trpc.classSession.cancel.useMutation({
    onSuccess: () => void utils.classSession.list.invalidate({ classBatchId }),
  });

  if (isLoading) return <Skeleton height={160} m="md" />;
  if (error) return <Alert color="red" m="md">{error.message}</Alert>;
  if (!data || data.length === 0) return (
    <Box p="xl" ta="center"><Text c="dimmed">Chưa có buổi học nào. Dùng "Sinh buổi học" từ quản lý lớp.</Text></Box>
  );
  return (
    <Box p="md" style={{ overflowX: 'auto' }}>
      <Table striped fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Ngày</Table.Th>
            <Table.Th>Bắt đầu</Table.Th>
            <Table.Th>Kết thúc</Table.Th>
            <Table.Th>Trạng thái</Table.Th>
            <Table.Th>Thao tác</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((s, idx) => (
            <Table.Tr key={s.id} style={{ opacity: s.status === 'cancelled' ? 0.5 : 1 }}>
              <Table.Td c="dimmed">{idx + 1}</Table.Td>
              <Table.Td>{new Date(s.sessionDate).toLocaleDateString('vi-VN')}</Table.Td>
              <Table.Td>{new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Table.Td>
              <Table.Td>{new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Table.Td>
              <Table.Td>
                <Badge size="xs" radius="xs" color={SESSION_STATUS_COLOR[s.status] ?? 'gray'}>
                  {s.status}
                </Badge>
                {s.isMakeup && <Badge size="xs" radius="xs" color="yellow" ml={4}>makeup</Badge>}
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {s.status === 'planned' && (
                    <Button
                      size="xs" radius="xs" color="blue" variant="light"
                      loading={confirmMut.isPending}
                      onClick={() => confirmMut.mutate({ sessionId: s.id })}
                    >
                      Xác nhận
                    </Button>
                  )}
                  {s.status !== 'cancelled' && (
                    <Button
                      size="xs" radius="xs" color="red" variant="subtle"
                      loading={cancelMut.isPending}
                      onClick={() => cancelMut.mutate({ sessionId: s.id })}
                    >
                      Huỷ
                    </Button>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: cls, isLoading, error } = trpc.classBatch.get.useQuery(
    { classBatchId: id! },
    { enabled: Boolean(id) },
  );

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

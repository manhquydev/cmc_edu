import { useState } from 'react';
import { Badge, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { DataTable, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

type FilterStatus = 'pending' | 'approved' | 'rejected';

interface LinkRow {
  id: string;
  studentName: string;
  parentPhone: string;
  parentAccountId: string;
  status: string;
  createdAt: string | Date;
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const RELATION_OPTIONS = [
  { value: 'father', label: 'Bố' },
  { value: 'mother', label: 'Mẹ' },
  { value: 'guardian', label: 'Người giám hộ' },
];

const BASE_COLUMNS: TableColumn<LinkRow>[] = [
  { key: 'studentName', label: 'Học viên' },
  { key: 'parentPhone', label: 'SĐT phụ huynh', width: 160 },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 120,
    render: (v) => (
      <Badge color={STATUS_COLORS[String(v)] ?? 'gray'} variant="light">
        {STATUS_LABELS[String(v)] ?? String(v)}
      </Badge>
    ),
  },
  {
    key: 'createdAt',
    label: 'Ngày yêu cầu',
    width: 140,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

export default function ParentListPage() {
  const { canDo } = useSession();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');

  // Approve modal state
  const [approveRow, setApproveRow] = useState<LinkRow | null>(null);
  const [relation, setRelation] = useState<string>('guardian');

  // Email update modal state
  const [emailRow, setEmailRow] = useState<LinkRow | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.guardian.listPendingLinks.useQuery({
    status: filterStatus,
    page: 1,
    pageSize: 50,
  });

  const approveMut = trpc.guardian.approveLink.useMutation({
    onSuccess: () => {
      setApproveRow(null);
      setRelation('guardian');
      void utils.guardian.listPendingLinks.invalidate();
    },
  });

  const rejectMut = trpc.guardian.rejectLink.useMutation({
    onSuccess: () => {
      void utils.guardian.listPendingLinks.invalidate();
    },
  });

  const updateEmailMut = trpc.parentAccount.updateEmail.useMutation({
    onSuccess: () => {
      setEmailRow(null);
      setEmailInput('');
    },
  });

  function handleReject(requestId: string) {
    rejectMut.mutate({ requestId });
  }

  function handleApproveSubmit() {
    if (!approveRow) return;
    approveMut.mutate({
      requestId: approveRow.id,
      relation: relation as 'father' | 'mother' | 'guardian',
    });
  }

  function handleOpenEmailModal(row: LinkRow) {
    setEmailRow(row);
    setEmailInput('');
  }

  function handleEmailSubmit() {
    if (!emailRow) return;
    updateEmailMut.mutate({
      parentAccountId: emailRow.parentAccountId,
      email: emailInput,
    });
  }

  const canUpdateEmail = canDo('parentAccount', 'updateEmail');

  // Action column only appears on pending tab.
  const columns: TableColumn<LinkRow>[] =
    filterStatus === 'pending'
      ? [
          ...BASE_COLUMNS,
          {
            key: '_actions',
            label: 'Thao tác',
            width: 180,
            render: (_v, row) => (
              <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                <Button size="xs" color="green" onClick={() => setApproveRow(row)}>
                  Duyệt
                </Button>
                <Button
                  size="xs"
                  color="red"
                  variant="outline"
                  loading={rejectMut.isPending && rejectMut.variables?.requestId === row.id}
                  onClick={() => handleReject(row.id)}
                >
                  Từ chối
                </Button>
              </Group>
            ),
          },
        ]
      : filterStatus === 'approved' && canUpdateEmail
        ? [
            ...BASE_COLUMNS,
            {
              key: '_email_actions',
              label: 'Thao tác',
              width: 160,
              render: (_v, row) => (
                <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleOpenEmailModal(row)}
                  >
                    Cập nhật email
                  </Button>
                </Group>
              ),
            },
          ]
        : BASE_COLUMNS;

  const rows: LinkRow[] = (data?.items ?? []).map((item) => ({
    ...item,
    _actions: null,
    _email_actions: null,
  }));

  return (
    <>
      <PageHeader
        title="Phụ huynh"
        subtitle="Duyệt yêu cầu liên kết phụ huynh — học viên"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Phụ huynh' }]}
      />

      <Group p="md" gap="sm">
        <Text fz="sm" c="dimmed">
          Lọc:
        </Text>
        <Select
          value={filterStatus}
          onChange={(v) => setFilterStatus((v as FilterStatus) ?? 'pending')}
          data={[
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'approved', label: 'Đã duyệt' },
            { value: 'rejected', label: 'Từ chối' },
          ]}
          size="sm"
          style={{ width: 160 }}
        />
        {data && (
          <Text fz="sm" c="dimmed">
            {data.total} yêu cầu
          </Text>
        )}
      </Group>

      <DataTable<LinkRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Không có yêu cầu nào"
      />

      {/* Approve modal with relation selector */}
      <Modal
        opened={Boolean(approveRow)}
        onClose={() => setApproveRow(null)}
        title="Duyệt liên kết phụ huynh"
        size="sm"
        radius="xs"
        centered
        closeOnClickOutside={!approveMut.isPending}
      >
        {approveRow && (
          <Stack gap="sm">
            <Text fz="sm">
              Học viên: <strong>{approveRow.studentName}</strong>
            </Text>
            <Text fz="sm">
              SĐT phụ huynh: <strong>{approveRow.parentPhone}</strong>
            </Text>
            <Select
              label="Quan hệ với học viên"
              data={RELATION_OPTIONS}
              value={relation}
              onChange={(v) => setRelation(v ?? 'guardian')}
              required
            />
            {approveMut.error && (
              <Text fz="sm" c="red">
                {approveMut.error.message}
              </Text>
            )}
            <Group justify="flex-end" mt="xs" gap="xs">
              <Button
                variant="default"
                radius="xs"
                onClick={() => setApproveRow(null)}
                disabled={approveMut.isPending}
              >
                Hủy
              </Button>
              <Button
                color="green"
                radius="xs"
                onClick={handleApproveSubmit}
                loading={approveMut.isPending}
              >
                Xác nhận duyệt
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Email update modal — allows staff to set/update parent email for LMS login */}
      <Modal
        opened={Boolean(emailRow)}
        onClose={() => { setEmailRow(null); setEmailInput(''); }}
        title="Cập nhật email phụ huynh"
        size="sm"
        radius="xs"
        centered
        closeOnClickOutside={!updateEmailMut.isPending}
      >
        {emailRow && (
          <Stack gap="sm">
            <Text fz="sm">
              Phụ huynh: <strong>{emailRow.parentPhone}</strong>
            </Text>
            <Text fz="sm">
              Học viên: <strong>{emailRow.studentName}</strong>
            </Text>
            <TextInput
              label="Email đăng nhập LMS"
              placeholder="example@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.currentTarget.value)}
              type="email"
              required
            />
            {updateEmailMut.error && (
              <Text fz="sm" c="red">
                {updateEmailMut.error.message}
              </Text>
            )}
            <Group justify="flex-end" mt="xs" gap="xs">
              <Button
                variant="default"
                radius="xs"
                onClick={() => { setEmailRow(null); setEmailInput(''); }}
                disabled={updateEmailMut.isPending}
              >
                Hủy
              </Button>
              <Button
                color="blue"
                radius="xs"
                onClick={handleEmailSubmit}
                loading={updateEmailMut.isPending}
                disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)}
              >
                Lưu email
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

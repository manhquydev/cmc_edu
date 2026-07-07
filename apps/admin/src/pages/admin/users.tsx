import { useState } from 'react';
import { Badge, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { DataTable, EmptyState, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface UserRow {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string;
  email: string;
  isActive: boolean;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<UserRow>[] = [
  { key: 'employeeCode', label: 'Mã NV', width: 100 },
  { key: 'fullName', label: 'Họ tên' },
  { key: 'position', label: 'Vị trí', width: 160 },
  { key: 'email', label: 'Email' },
  {
    key: 'isActive',
    label: 'Trạng thái',
    width: 120,
    render: (v) => (
      <Badge color={Boolean(v) ? 'green' : 'gray'} variant="light">
        {Boolean(v) ? 'Hoạt động' : 'Vô hiệu'}
      </Badge>
    ),
  },
];

interface CreateForm {
  userId: string;
  email: string;
  fullName: string;
  position: string;
}

const EMPTY_FORM: CreateForm = { userId: '', email: '', fullName: '', position: '' };

function UsersContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.user.list.useQuery();

  const createMut = trpc.user.create.useMutation({
    onSuccess: () => {
      setModalOpen(false);
      setForm(EMPTY_FORM);
      void utils.user.list.invalidate();
    },
  });

  function handleCreate() {
    createMut.mutate({
      userId: form.userId.trim(),
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      position: form.position.trim(),
    });
  }

  const isFormValid =
    form.userId.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.fullName.trim().length > 0 &&
    form.position.trim().length > 0;

  function setField(field: keyof CreateForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.currentTarget.value }));
  }

  return (
    <>
      <PageHeader
        title="Nhân viên"
        subtitle="Danh sách tài khoản nhân viên tại cơ sở"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhân viên' }]}
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Thêm nhân viên
          </Button>
        }
      />

      <DataTable<UserRow>
        columns={COLUMNS}
        data={(data?.items as UserRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có nhân viên nào"
      />

      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setForm(EMPTY_FORM); }}
        title="Thêm nhân viên"
        size="sm"
        radius="xs"
        centered
        closeOnClickOutside={!createMut.isPending}
      >
        <Stack gap="sm">
          <TextInput
            label="User ID (auth identity)"
            placeholder="email hoặc sub từ IdP…"
            value={form.userId}
            onChange={setField('userId')}
            required
          />
          <TextInput
            label="Họ tên"
            value={form.fullName}
            onChange={setField('fullName')}
            required
          />
          <TextInput
            label="Email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            required
          />
          <TextInput
            label="Vị trí"
            placeholder="VD: Giáo viên, Nhân viên kinh doanh…"
            value={form.position}
            onChange={setField('position')}
            required
          />
          {createMut.error && (
            <Text fz="sm" c="red">
              {createMut.error.message}
            </Text>
          )}
          <Group justify="flex-end" mt="xs" gap="xs">
            <Button
              variant="default"
              radius="xs"
              onClick={() => { setModalOpen(false); setForm(EMPTY_FORM); }}
              disabled={createMut.isPending}
            >
              Hủy
            </Button>
            <Button
              radius="xs"
              onClick={handleCreate}
              loading={createMut.isPending}
              disabled={!isFormValid}
            >
              Tạo
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default function UsersPage() {
  const { canDo } = useSession();

  if (!canDo('user', 'manage')) {
    return (
      <>
        <PageHeader
          title="Nhân viên"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhân viên' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý tài khoản (user.manage)."
          icon="🔒"
        />
      </>
    );
  }

  return <UsersContent />;
}

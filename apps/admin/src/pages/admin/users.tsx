import { useState } from 'react';
import { Badge, Button, Group, Modal, MultiSelect, Stack, Text, TextInput } from '@mantine/core';
import { DataTable, EmptyState, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { ACTIVE_ROLES } from '@cmc/auth';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  giam_doc_kinh_doanh: 'GĐ Kinh doanh',
  giam_doc_dao_tao: 'GĐ Đào tạo',
  sale: 'Sale',
  giao_vien: 'Giáo viên',
};

const ROLE_OPTIONS = ACTIVE_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABELS[r] ?? r,
}));

interface UserRow {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string;
  email: string;
  roles: string[];
  isActive: boolean;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<UserRow>[] = [
  { key: 'employeeCode', label: 'Mã NV', width: 100 },
  { key: 'fullName', label: 'Họ tên' },
  { key: 'position', label: 'Vị trí', width: 160 },
  { key: 'email', label: 'Email' },
  {
    key: 'roles',
    label: 'Roles',
    render: (v) => {
      const roles = v as string[];
      if (!roles || roles.length === 0) return <Text fz="xs" c="dimmed">—</Text>;
      return (
        <Group gap={4}>
          {roles.map((r) => (
            <Badge key={r} size="xs" variant="outline" color="blue">
              {r}
            </Badge>
          ))}
        </Group>
      );
    },
  },
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
  const [rolesModalUser, setRolesModalUser] = useState<UserRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
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

  const updateRolesMut = trpc.user.updateRoles.useMutation({
    onSuccess: () => {
      setRolesModalUser(null);
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

  function openRolesModal(user: UserRow) {
    setRolesModalUser(user);
    // Drop dormant roles on open — next Save will persist only active roles.
    // The user's badge still shows old roles until saved.
    const activeSet = new Set<string>(ACTIVE_ROLES);
    setSelectedRoles((user.roles ?? []).filter((r) => activeSet.has(r)));
  }

  function handleSaveRoles() {
    if (!rolesModalUser) return;
    updateRolesMut.mutate({ appUserId: rolesModalUser.id, roles: selectedRoles });
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

  const rows = (data?.items as UserRow[] | undefined) ?? [];

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
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có nhân viên nào"
        onRowClick={(row) => openRolesModal(row)}
      />

      {/* Create modal */}
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

      {/* Assign roles modal */}
      <Modal
        opened={rolesModalUser !== null}
        onClose={() => setRolesModalUser(null)}
        title={rolesModalUser ? `Phân quyền — ${rolesModalUser.fullName}` : ''}
        size="sm"
        radius="xs"
        centered
        closeOnClickOutside={!updateRolesMut.isPending}
      >
        <Stack gap="sm">
          <MultiSelect
            label="Roles"
            data={ROLE_OPTIONS}
            value={selectedRoles}
            onChange={setSelectedRoles}
            searchable
            clearable
            placeholder="Chọn vai trò…"
          />
          {updateRolesMut.error && (
            <Text fz="sm" c="red">
              {updateRolesMut.error.message}
            </Text>
          )}
          <Group justify="flex-end" mt="xs" gap="xs">
            <Button
              variant="default"
              radius="xs"
              onClick={() => setRolesModalUser(null)}
              disabled={updateRolesMut.isPending}
            >
              Hủy
            </Button>
            <Button
              radius="xs"
              onClick={handleSaveRoles}
              loading={updateRolesMut.isPending}
            >
              Lưu
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

import { useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  LineIcon,
  ListPage,
  MultiSelector,
  PageHeader,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
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
      if (!roles || roles.length === 0)
        return (
          <Text type="supporting" size="xsm">
            —
          </Text>
        );
      return (
        <HStack gap={0.5}>
          {roles.map((r) => (
            <Badge key={r} label={r} variant="info" />
          ))}
        </HStack>
      );
    },
  },
  {
    key: 'isActive',
    label: 'Trạng thái',
    width: 120,
    render: (v) => (
      <Badge label={Boolean(v) ? 'Hoạt động' : 'Vô hiệu'} variant={Boolean(v) ? 'success' : 'neutral'} />
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
    return (value: string) => setForm((f) => ({ ...f, [field]: value }));
  }

  function closeCreateModal() {
    setModalOpen(false);
    setForm(EMPTY_FORM);
  }

  const rows = (data?.items as UserRow[] | undefined) ?? [];

  return (
    <>
      <ListPage
        header={
          <PageHeader
            title="Nhân viên"
            subtitle="Danh sách tài khoản nhân viên tại cơ sở"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhân viên' }]}
            actions={
              <Button label="Thêm nhân viên" size="sm" variant="primary" onClick={() => setModalOpen(true)} />
            }
          />
        }
      >
        <DataTable<UserRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có nhân viên nào"
          onRowClick={(row) => openRolesModal(row)}
        />
      </ListPage>

      {/* Create modal.
          TODO(astryx-review): Astryx Dialog manages its own focus-trap and
          Escape/backdrop-dismiss internally (native <dialog>-based) — different
          implementation from the prior Modal. purpose="form" blocks backdrop
          click (closest match to the original closeOnClickOutside={!pending}
          guard). Flagged per migration rule for any non-confirm modal. */}
      <Dialog
        isOpen={modalOpen}
        onOpenChange={(next) => {
          if (!next && !createMut.isPending) closeCreateModal();
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title="Thêm nhân viên"
          onOpenChange={(next) => {
            if (!next && !createMut.isPending) closeCreateModal();
          }}
        />
        <Stack gap={2} padding={4}>
          <TextInput
            label="User ID (auth identity)"
            placeholder="email hoặc sub từ IdP…"
            value={form.userId}
            onChange={setField('userId')}
            isRequired
          />
          <TextInput
            label="Họ tên"
            value={form.fullName}
            onChange={setField('fullName')}
            isRequired
          />
          <TextInput
            label="Email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            isRequired
          />
          <TextInput
            label="Vị trí"
            placeholder="VD: Giáo viên, Nhân viên kinh doanh…"
            value={form.position}
            onChange={setField('position')}
            isRequired
          />
          {createMut.error && (
            // TODO(astryx-review): Text color enum has no error/danger slot —
            // plain <span> with CSS var per migration flag rule.
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
              {createMut.error.message}
            </span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={closeCreateModal}
              isDisabled={createMut.isPending}
            />
            <Button
              label="Tạo"
              variant="primary"
              onClick={handleCreate}
              isLoading={createMut.isPending}
              isDisabled={!isFormValid}
            />
          </HStack>
        </Stack>
      </Dialog>

      {/* Assign roles modal.
          TODO(astryx-review): non-confirm modal — see create-modal note above
          for Dialog focus-trap/dismiss behavior flag. MultiSelector is a
          first-use of this primitive in the admin app (0 prior usages
          found), flagged per migration rule. */}
      <Dialog
        isOpen={rolesModalUser !== null}
        onOpenChange={(next) => {
          if (!next && !updateRolesMut.isPending) setRolesModalUser(null);
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title={rolesModalUser ? `Phân quyền — ${rolesModalUser.fullName}` : 'Phân quyền'}
          onOpenChange={(next) => {
            if (!next && !updateRolesMut.isPending) setRolesModalUser(null);
          }}
        />
        <Stack gap={2} padding={4}>
          <MultiSelector
            label="Roles"
            options={ROLE_OPTIONS}
            value={selectedRoles}
            onChange={setSelectedRoles}
            hasSearch
            hasClear
            placeholder="Chọn vai trò…"
          />
          {updateRolesMut.error && (
            // TODO(astryx-review): Text color enum has no error/danger slot —
            // plain <span> with CSS var per migration flag rule.
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
              {updateRolesMut.error.message}
            </span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={() => setRolesModalUser(null)}
              isDisabled={updateRolesMut.isPending}
            />
            <Button
              label="Lưu"
              variant="primary"
              onClick={handleSaveRoles}
              isLoading={updateRolesMut.isPending}
            />
          </HStack>
        </Stack>
      </Dialog>
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
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return <UsersContent />;
}

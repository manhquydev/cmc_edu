import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  EmptyState,
  FilterBar,
  HStack,
  LineIcon,
  BulkActionBar,
  ListPage,
  ListPagination,
  MultiSelector,
  PageHeader,
  PasswordInput,
  Selector,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { ACTIVE_ROLES, formatRole } from '@cmc/auth';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

const ROLE_OPTIONS = ACTIVE_ROLES.map((r) => ({
  value: r,
  label: formatRole(r),
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

// Same minimum the server enforces (user.resetPassword input schema).
const PASSWORD_MIN_LENGTH = 8;

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
            <Badge key={r} label={formatRole(r)} variant="info" />
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
  roles: string[];
  managerId: string;
  tempPassword: string;
}

const EMPTY_FORM: CreateForm = {
  userId: '',
  email: '',
  fullName: '',
  position: '',
  roles: [],
  managerId: '',
  tempPassword: '',
};

const NO_MANAGER = '__none__';

const USER_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên, email, mã NV…',
  },
];

/** Job title suggested from the first role picked, so the free-text field
 *  starts from the right answer instead of an empty box. Still editable —
 *  two teachers can hold different titles. */
const POSITION_FROM_ROLE: Record<string, string> = {
  super_admin: 'Quản trị hệ thống',
  giam_doc_kinh_doanh: 'Giám đốc kinh doanh',
  giam_doc_dao_tao: 'Giám đốc đào tạo',
  sale: 'Nhân viên kinh doanh',
  giao_vien: 'Giáo viên',
};

function UsersContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [rolesModalUser, setRolesModalUser] = useState<UserRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [resetModalUser, setResetModalUser] = useState<UserRow | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 20;
  const { success: toastSuccess } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [debouncedSearch]);

  const utils = trpc.useUtils();
  const listInput = debouncedSearch ? { search: debouncedSearch } : {};
  const { data, isLoading, error } = trpc.user.list.useQuery(listInput);
  // Manager picker must see the full roster, not the filtered table query.
  const { data: managerRoster } = trpc.user.list.useQuery(
    {},
    { enabled: modalOpen },
  );

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

  const resetPasswordMut = trpc.user.resetPassword.useMutation({
    onSuccess: () => {
      // Keep the modal open so the admin can hand the temp password over —
      // it is only ever displayed here, never stored readable anywhere.
      setResetDone(true);
    },
  });

  function openResetModal(user: UserRow) {
    setResetModalUser(user);
    setTempPassword('');
    setResetDone(false);
    resetPasswordMut.reset();
  }

  function closeResetModal() {
    if (resetPasswordMut.isPending) return;
    setResetModalUser(null);
    setTempPassword('');
    setResetDone(false);
  }

  function handleResetPassword() {
    if (!resetModalUser) return;
    resetPasswordMut.mutate({ appUserId: resetModalUser.id, tempPassword });
  }

  function handleCreate() {
    createMut.mutate({
      userId: form.userId.trim(),
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      position: form.position.trim(),
      roles: form.roles,
      ...(form.managerId && form.managerId !== NO_MANAGER
        ? { managerId: form.managerId }
        : {}),
      ...(form.tempPassword ? { tempPassword: form.tempPassword } : {}),
    });
  }

  // Full roster for manager select (unfiltered) when the create modal is open.
  const managerOptions = [
    { value: NO_MANAGER, label: '— Chưa có —' },
    ...(managerRoster?.items ?? data?.items ?? []).map((u) => ({
      value: u.id,
      label: `${u.fullName} (${u.employeeCode})`,
    })),
  ];

  /** Picking a role fills an empty job title with that role's usual one. */
  function setRolesField(next: string[]) {
    setForm((f) => ({
      ...f,
      roles: next,
      position: f.position.trim() ? f.position : (POSITION_FROM_ROLE[next[0] ?? ''] ?? ''),
    }));
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

  // A role is required: an account with none can sign in but reach nothing,
  // which reads as a broken system rather than a pending setup step.
  // The first password stays optional (8+ chars when given) — an admin may
  // provision the profile now and hand over credentials later.
  const isFormValid =
    form.userId.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.fullName.trim().length > 0 &&
    form.position.trim().length > 0 &&
    form.roles.length > 0 &&
    (form.tempPassword.length === 0 || form.tempPassword.length >= PASSWORD_MIN_LENGTH);

  function setField(field: 'userId' | 'email' | 'fullName' | 'position' | 'tempPassword') {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }));
  }

  function closeCreateModal() {
    setModalOpen(false);
    setForm(EMPTY_FORM);
  }

  const allRows = (data?.items as UserRow[] | undefined) ?? [];
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);

  // Actions column lives here (not in module-level COLUMNS) because it closes
  // over openResetModal. The stopPropagation wrapper keeps the row's
  // onRowClick (roles modal) from firing on the same click.
  const columns: TableColumn<UserRow>[] = [
    ...COLUMNS,
    {
      key: 'actions',
      label: '',
      width: 150,
      render: (_v, row) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Button
            label="Đặt lại mật khẩu"
            size="sm"
            variant="secondary"
            onClick={() => openResetModal(row)}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Nhân viên"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Nhân viên' }]}
            actions={
              <Button label="Thêm nhân viên" size="sm" variant="primary" onClick={() => setModalOpen(true)} />
            }
          />
        }
        filters={
          <FilterBar
            filters={USER_FILTERS}
            value={{ q: searchInput }}
            onChange={(next) => setSearchInput(next.q ?? '')}
          />
        }
        controlFooter={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Sao chép email"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0}
                onClick={() => {
                  const emails = allRows
                    .filter((r) => selectedIds.includes(r.id))
                    .map((r) => r.email)
                    .filter(Boolean);
                  void navigator.clipboard?.writeText(emails.join(', '));
                  toastSuccess(`Đã sao chép ${emails.length} email`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={allRows.length}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds([]);
              }}
            />
          </div>
        }
      >
        <DataTable<UserRow>
          columns={columns}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có nhân viên nào"
          onRowClick={(row) => openRolesModal(row)}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
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
          <MultiSelector
            label="Vai trò"
            options={ROLE_OPTIONS}
            value={form.roles}
            onChange={setRolesField}
            hasSearch
            hasClear
            placeholder="Chọn vai trò…"
          />
          <TextInput
            label="Vị trí"
            placeholder="VD: Giáo viên, Nhân viên kinh doanh…"
            description="Chức danh hiển thị trên hồ sơ — quyền truy cập do Vai trò quyết định."
            value={form.position}
            onChange={setField('position')}
            isRequired
          />
          <Selector
            label="Quản lý trực tiếp"
            description="Người duyệt ca và xác nhận KPI cho nhân viên này."
            options={managerOptions}
            value={form.managerId || NO_MANAGER}
            onChange={(v) => setForm((f) => ({ ...f, managerId: v }))}
          />
          <PasswordInput
            label="Mật khẩu đầu tiên"
            description="Tối thiểu 8 ký tự. Nhân viên bắt buộc đổi ở lần đăng nhập đầu. Bỏ trống nếu muốn cấp sau."
            value={form.tempPassword}
            onChange={setField('tempPassword')}
          />
          {createMut.error && (
            // TODO(astryx-review): Text color enum has no error/danger slot —
            // plain <span> with CSS var per migration flag rule.
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
              {createMut.error.message}
            </span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 8, flexWrap: 'wrap' }}>
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

      {/* Reset password modal — admin sets a temporary password; the target is
          forced to change it at their next login (user.resetPassword). */}
      <Dialog
        isOpen={resetModalUser !== null}
        onOpenChange={(next) => {
          if (!next) closeResetModal();
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title={
            resetModalUser ? `Đặt lại mật khẩu — ${resetModalUser.fullName}` : 'Đặt lại mật khẩu'
          }
          onOpenChange={(next) => {
            if (!next) closeResetModal();
          }}
        />
        <Stack gap={2} padding={4}>
          {resetDone ? (
            <>
              <Text size="sm">
                Đã đặt mật khẩu tạm. Hãy chuyển mật khẩu này cho nhân viên — họ sẽ bị yêu cầu đổi
                ngay ở lần đăng nhập kế tiếp.
              </Text>
              <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
                <Button label="Đóng" variant="primary" onClick={closeResetModal} />
              </HStack>
            </>
          ) : (
            <>
              <TextInput
                label="Mật khẩu tạm"
                placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự…`}
                value={tempPassword}
                onChange={setTempPassword}
                isRequired
              />
              {resetPasswordMut.error && (
                // Text color enum has no error/danger slot — plain <span> with
                // CSS var per migration flag rule.
                <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>
                  {resetPasswordMut.error.message}
                </span>
              )}
              <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
                <Button
                  label="Hủy"
                  variant="secondary"
                  onClick={closeResetModal}
                  isDisabled={resetPasswordMut.isPending}
                />
                <Button
                  label="Đặt mật khẩu tạm"
                  variant="primary"
                  onClick={handleResetPassword}
                  isLoading={resetPasswordMut.isPending}
                  isDisabled={tempPassword.length < PASSWORD_MIN_LENGTH}
                />
              </HStack>
            </>
          )}
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

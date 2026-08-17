// Staff create — full form on its own route (/hr/staff/new, D1/D7).
//
// Create-success navigates with `replace` to the created profile URL: the
// submitted form is never the previous history entry, so Back skips it and
// returns to the page before /new (the list or wherever the user came from).
// The returned `AppUser.id` is the canonical detail URL, never the list.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  EmptyState,
  FormPage,
  HStack,
  LineIcon,
  MultiSelector,
  PageHeader,
  PasswordInput,
  Selector,
  Stack,
  TextInput,
} from '@cmc/ui';
import { ACTIVE_ROLES, formatRole } from '@cmc/auth';
import { trpc } from '../../../lib/trpc.js';
import { useSession } from '../../../lib/session-context.js';
import { staffProfilePath } from '@cmc/links';

const ROLE_OPTIONS = ACTIVE_ROLES.map((r) => ({
  value: r,
  label: formatRole(r),
}));

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

/** Job title suggested from the first role picked, so the free-text field
 *  starts from the right answer instead of an empty box. Still editable. */
const POSITION_FROM_ROLE: Record<string, string> = {
  super_admin: 'Quản trị hệ thống',
  giam_doc_kinh_doanh: 'Giám đốc kinh doanh',
  giam_doc_dao_tao: 'Giám đốc đào tạo',
  sale: 'Nhân viên kinh doanh',
  giao_vien: 'Giáo viên',
};

export default function StaffNewPage() {
  const { canDo } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const utils = trpc.useUtils();
  // Manager dropdown eligibility comes from the server (D2): directors are
  // never offered a super_admin target; super_admin callers see everyone.
  const { data: managerRoster } = trpc.user.managerPickList.useQuery();

  const createMut = trpc.user.create.useMutation({
    onSuccess: (created) => {
      void utils.user.list.invalidate();
      void utils.user.managerPickList.invalidate();
      // replace: never leave the submitted /new form in history.
      navigate(staffProfilePath(created.id), { replace: true });
    },
  });

  if (!canDo('user', 'manage')) {
    return (
      <>
        <PageHeader
          title="Thêm nhân viên"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý tài khoản (user.manage)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  const isFormValid =
    form.userId.trim().length > 0 &&
    form.fullName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.position.trim().length > 0 &&
    form.roles.length > 0;

  function setField(field: 'userId' | 'email' | 'fullName' | 'position' | 'tempPassword') {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }));
  }

  /** Picking a role fills an empty job title with that role's usual one. */
  function setRolesField(next: string[]) {
    setForm((f) => ({
      ...f,
      roles: next,
      position: f.position.trim() ? f.position : (POSITION_FROM_ROLE[next[0] ?? ''] ?? ''),
    }));
  }

  const managerOptions = [
    { value: NO_MANAGER, label: '— Chưa có —' },
    ...(managerRoster?.items ?? []).map((u) => ({
      value: u.id,
      label: `${u.fullName} (${u.employeeCode})`,
    })),
  ];

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

  return (
    <FormPage
      header={
        <PageHeader
          title="Thêm nhân viên"
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Nhân viên' }, { label: 'Thêm mới' }]}
        />
      }
      actions={
        <HStack justify="end" gap={1} style={{ flexWrap: 'wrap' }}>
          <Button
            label="Hủy"
            variant="secondary"
            onClick={() => navigate(-1)}
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
      }
    >
      <Stack gap={2} padding={4} style={{ maxWidth: 640 }}>
        <TextInput
          label="User ID (auth identity)"
          placeholder="email hoặc sub từ IdP…"
          value={form.userId}
          onChange={setField('userId')}
          isRequired
        />
        <TextInput label="Họ tên" value={form.fullName} onChange={setField('fullName')} isRequired />
        <TextInput label="Email" type="email" value={form.email} onChange={setField('email')} isRequired />
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
          <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
            {createMut.error.message}
          </span>
        )}
      </Stack>
    </FormPage>
  );
}

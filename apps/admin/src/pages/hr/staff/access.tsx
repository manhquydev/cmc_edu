// Staff access section — roles assignment + password reset as EXPLICIT
// secondary actions (D1/D2). Row click never opens this; the user must open
// the Access tab and press a button. Password events contain no secret values
// in the UI (temp password is dialog-local, never URL/router/toast).

import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogHeader,
  FormPage,
  HStack,
  MultiSelector,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import { ACTIVE_ROLES, formatRole } from '@cmc/auth';
import { trpc } from '../../../lib/trpc.js';

const ROLE_OPTIONS = ACTIVE_ROLES.map((r) => ({
  value: r,
  label: formatRole(r),
}));

const PASSWORD_MIN_LENGTH = 8;

interface OutletCtx {
  staff: { id: string; fullName: string; userId: string; roles: string[] };
}

export default function StaffAccessSection() {
  const { staff } = useOutletContext<OutletCtx>();
  const { staffId = '' } = useParams<{ staffId: string }>();

  const [rolesOpen, setRolesOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(staff.roles);
  const [resetOpen, setResetOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const utils = trpc.useUtils();
  const updateRolesMut = trpc.user.updateRoles.useMutation({
    onSuccess: () => {
      setRolesOpen(false);
      void utils.user.get.invalidate({ appUserId: staffId });
      void utils.user.list.invalidate();
    },
  });
  const resetPasswordMut = trpc.user.resetPassword.useMutation({
    onSuccess: () => {
      // Keep the dialog open so the admin can hand the temp password over —
      // it is only ever displayed here, never stored readable anywhere.
      setResetDone(true);
    },
  });

  function openRoles() {
    setSelectedRoles(staff.roles);
    setRolesOpen(true);
  }

  function handleSaveRoles() {
    updateRolesMut.mutate({ appUserId: staffId, roles: selectedRoles });
  }

  function openReset() {
    setTempPassword('');
    setResetDone(false);
    resetPasswordMut.reset();
    setResetOpen(true);
  }

  function handleReset() {
    resetPasswordMut.mutate({ appUserId: staffId, tempPassword });
  }

  return (
    <FormPage
      header={
        <Text type="supporting" size="sm">
          Quyền truy cập — gán vai trò và đặt lại mật khẩu là các thao tác tường minh.
        </Text>
      }
      actions={
        <HStack justify="end" gap={1} style={{ flexWrap: 'wrap' }}>
          <Button label="Gán vai trò" size="sm" variant="secondary" onClick={openRoles} />
          <Button label="Đặt lại mật khẩu" size="sm" variant="secondary" onClick={openReset} />
        </HStack>
      }
    >
      <Stack gap={2} padding={4} style={{ maxWidth: 640 }}>
        <Text size="sm">
          Vai trò hiện tại: {staff.roles.length ? staff.roles.map(formatRole).join(', ') : '—'}
        </Text>
        {updateRolesMut.error && (
          <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
            {updateRolesMut.error.message}
          </span>
        )}
        {resetPasswordMut.error && (
          <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
            {resetPasswordMut.error.message}
          </span>
        )}
      </Stack>

      <Dialog
        isOpen={rolesOpen}
        onOpenChange={(next) => {
          if (!next && !updateRolesMut.isPending) setRolesOpen(false);
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title={`Phân quyền — ${staff.fullName}`}
          onOpenChange={(next) => {
            if (!next && !updateRolesMut.isPending) setRolesOpen(false);
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
          <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={() => setRolesOpen(false)}
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

      <Dialog
        isOpen={resetOpen}
        onOpenChange={(next) => {
          if (!next) setResetOpen(false);
        }}
        purpose="form"
        width={400}
      >
        <DialogHeader
          title={`Đặt lại mật khẩu — ${staff.fullName}`}
          onOpenChange={(next) => {
            if (!next) setResetOpen(false);
          }}
        />
        <Stack gap={2} padding={4}>
          {resetDone ? (
            <>
              <Text size="sm">
                Đã đặt mật khẩu tạm. Hãy chuyển mật khẩu này cho nhân viên — họ sẽ bị yêu cầu đổi
                ngay ở lần đăng nhập kế tiếp.
              </Text>
              <HStack justify="end" gap={1}>
                <Button label="Đóng" variant="primary" onClick={() => setResetOpen(false)} />
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
              <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
                <Button
                  label="Hủy"
                  variant="secondary"
                  onClick={() => setResetOpen(false)}
                  isDisabled={resetPasswordMut.isPending}
                />
                <Button
                  label="Đặt mật khẩu tạm"
                  variant="primary"
                  onClick={handleReset}
                  isLoading={resetPasswordMut.isPending}
                  isDisabled={tempPassword.length < PASSWORD_MIN_LENGTH}
                />
              </HStack>
            </>
          )}
        </Stack>
      </Dialog>
    </FormPage>
  );
}

// Staff profile section — edits the supported profile fields via the existing
// user.update (fullName, email, position, managerId, isActive). Role and
// password actions live in the Access section, never here (D1/D2).

import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Button,
  FormPage,
  HStack,
  Selector,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import { trpc } from '../../../lib/trpc.js';
import { useUnsavedBlocker } from '../../../lib/use-unsaved-blocker.js';
import { staffListPath } from '@cmc/links';

interface OutletCtx {
  staff: {
    id: string;
    fullName: string;
    email: string;
    position: string;
    managerId: string | null;
    manager: { id: string; fullName: string; employeeCode: string } | null;
    isActive: boolean;
  };
}

const NO_MANAGER = '__none__';

export default function StaffProfileSection() {
  const { staff } = useOutletContext<OutletCtx>();
  const { staffId = '' } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess } = useToast();

  const [fullName, setFullName] = useState(staff.fullName);
  const [email, setEmail] = useState(staff.email);
  const [position, setPosition] = useState(staff.position);
  const [managerId, setManagerId] = useState<string>(staff.managerId ?? NO_MANAGER);
  const [isActive, setIsActive] = useState(staff.isActive);

  // Re-hydrate local state when the shell refetches a different record
  // (navigating straight between two staff ids on the same layout).
  useEffect(() => {
    setFullName(staff.fullName);
    setEmail(staff.email);
    setPosition(staff.position);
    setManagerId(staff.managerId ?? NO_MANAGER);
    setIsActive(staff.isActive);
  }, [staff]);

  const dirty =
    fullName !== staff.fullName ||
    email !== staff.email ||
    position !== staff.position ||
    (managerId === NO_MANAGER ? null : managerId) !== staff.managerId ||
    isActive !== staff.isActive;

  const blocker = useUnsavedBlocker({ dirty });

  const utils = trpc.useUtils();
  const { data: managerRoster } = trpc.user.managerPickList.useQuery();
  const updateMut = trpc.user.update.useMutation({
    onSuccess: () => {
      toastSuccess('Đã lưu hồ sơ');
      void utils.user.get.invalidate({ appUserId: staffId });
      void utils.user.list.invalidate();
      void utils.user.managerPickList.invalidate();
    },
  });

  const managerOptions = [
    { value: NO_MANAGER, label: '— Chưa có —' },
    ...(managerRoster?.items ?? []).map((u) => ({
      value: u.id,
      label: `${u.fullName} (${u.employeeCode})`,
    })),
  ];

  function handleSave() {
    updateMut.mutate({
      appUserId: staffId,
      fullName: fullName.trim(),
      email: email.trim(),
      position: position.trim(),
      ...(managerId === NO_MANAGER ? { managerId: null } : { managerId }),
      isActive,
    });
  }

  return (
    <FormPage
      header={
        <Text type="supporting" size="sm">
          Hồ sơ cá nhân — các thay đổi được lưu qua user.update.
        </Text>
      }
      actions={
        <HStack justify="end" gap={1} style={{ flexWrap: 'wrap' }}>
          <Button
            label="Về danh sách"
            variant="secondary"
            size="sm"
            onClick={() => navigate(staffListPath())}
          />
          <Button
            label="Lưu hồ sơ"
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={updateMut.isPending}
            isDisabled={!dirty}
          />
        </HStack>
      }
    >
      <Stack gap={2} padding={4} style={{ maxWidth: 640 }}>
        <TextInput label="Họ tên" value={fullName} onChange={setFullName} isRequired />
        <TextInput label="Email" type="email" value={email} onChange={setEmail} isRequired />
        <TextInput
          label="Vị trí"
          description="Chức danh hiển thị trên hồ sơ — quyền truy cập do Vai trò quyết định."
          value={position}
          onChange={setPosition}
          isRequired
        />
        <Selector
          label="Quản lý trực tiếp"
          description="Người duyệt ca và xác nhận KPI cho nhân viên này."
          options={managerOptions}
          value={managerId}
          onChange={setManagerId}
        />
        <HStack gap={1} align="center">
          <Button
            label={isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
            size="sm"
            variant={isActive ? 'destructive' : 'primary'}
            onClick={() => setIsActive((v) => !v)}
          />
          <Text size="sm">{isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</Text>
        </HStack>
        {updateMut.error && (
          <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
            {updateMut.error.message}
          </span>
        )}
      </Stack>
      {blocker.dialog}
    </FormPage>
  );
}

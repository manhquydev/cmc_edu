import { Group, Select, Text } from '@mantine/core';
import { useState } from 'react';

// Sentinel facility ID used for dev impersonation. The server accepts any non-empty
// string here (x-dev-user is parsed by devUserHeaderSchema which requires min(1)).
// Replace with a real seeded facility ID to test facility-scoped queries.
const DEV_FACILITY = 'DEV_FACILITY';

const DEV_USERS = [
  { value: JSON.stringify({ userId: 'u1', roles: ['giam_doc_dao_tao'], facilityId: DEV_FACILITY }), label: 'GĐĐT' },
  { value: JSON.stringify({ userId: 'u2', roles: ['giam_doc_kinh_doanh'], facilityId: DEV_FACILITY }), label: 'GĐKD' },
  { value: JSON.stringify({ userId: 'u3', roles: ['giao_vien'], facilityId: DEV_FACILITY }), label: 'Giáo viên' },
  { value: JSON.stringify({ userId: 'u4', roles: ['sale'], facilityId: DEV_FACILITY }), label: 'Sale' },
  { value: JSON.stringify({ userId: 'u5', roles: ['super_admin'], facilityId: DEV_FACILITY }), label: 'Super Admin' },
];
export function RoleSwitcher() {
  const [current, setCurrent] = useState<string>(
    () => localStorage.getItem('cmc_dev_user') ?? (DEV_USERS[0]?.value ?? ''),
  );

  if (import.meta.env.PROD) return null;

  function handleChange(value: string | null) {
    if (!value) return;
    setCurrent(value);
    localStorage.setItem('cmc_dev_user', value);
    // Full reload so tRPC re-fetches with new x-dev-user header.
    window.location.reload();
  }

  return (
    <Group gap="xs">
      <Text size="xs" c="dimmed">
        Dev:
      </Text>
      <Select
        data={DEV_USERS}
        value={current}
        onChange={handleChange}
        size="xs"
        w={120}
        radius="xs"
        comboboxProps={{ withinPortal: true }}
      />
    </Group>
  );
}

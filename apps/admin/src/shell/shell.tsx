import { useState } from 'react';
import { AppShell, Badge, Button, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session-context.js';
import { EnrollPicker } from '../lib/enroll-picker.js';
import { visibleModulesFor } from './nav-registry.js';
import { RoleSwitcher } from './role-switcher.js';

export function Shell() {
  const { me, canDo } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);

  const modules = me ? visibleModulesFor(me.roles, canDo) : [];
  const canCreateReceipt = canDo('finance', 'receiptCreate');

  return (
    <AppShell
      navbar={{ width: 252, breakpoint: 'sm' }}
      header={{ height: 56 }}
      padding={0}
    >
      <AppShell.Header
        style={{
          background: 'var(--cmc-surface)',
          borderBottom: '1px solid var(--cmc-border)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Group h="100%" px="md" justify="space-between" w="100%">
          <Group gap="xs">
            <Text fw={700} fz="sm" style={{ color: 'var(--cmc-brand)' }}>
              CMC EDU
            </Text>
            <Text fz={11} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
              Admin
            </Text>
          </Group>
          <Group gap="sm">
            {canCreateReceipt && (
              <Button
                size="xs"
                radius="xs"
                color="green"
                variant="light"
                onClick={() => setEnrollPickerOpen(true)}
              >
                + Ghi danh
              </Button>
            )}
            {me && me.roles[0] && (
              <Badge variant="light" size="sm">
                {me.roles[0]}
              </Badge>
            )}
            <RoleSwitcher />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar style={{ background: '#1A1A1E', borderRight: 'none' }}>
        <ScrollArea flex={1} p="xs">
          <Stack gap={2}>
            {modules.map((mod) => {
              const isActive = location.pathname.startsWith(mod.path);

              return (
                <NavLink
                  key={mod.id}
                  label={`${mod.icon}  ${mod.label}`}
                  active={isActive}
                  onClick={() => navigate(mod.path)}
                  styles={{
                    root: {
                      color: isActive ? '#fff' : '#aeaeb2',
                      borderRadius: 6,
                      fontWeight: isActive ? 600 : 400,
                    },
                    label: { fontSize: 13 },
                  }}
                />
              );
            })}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: 'var(--cmc-surface-2)' }}>
        <Outlet />
      </AppShell.Main>

      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
    </AppShell>
  );
}

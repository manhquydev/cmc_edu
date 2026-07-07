import { AppShell, Badge, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session-context.js';
import { NAV_MODULES } from './nav-registry.js';
import { RoleSwitcher } from './role-switcher.js';

export function Shell() {
  const { me, canDo } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

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
            {NAV_MODULES.map((mod) => {
              const isActive = location.pathname.startsWith(mod.path);
              // Show module if user has permission for any child, or module has no children.
              const visibleChildren = mod.children?.filter((child) =>
                child.permission ? canDo(child.permission.module, child.permission.action) : true,
              );
              // Hide module entirely when all children are permission-gated and none pass.
              if (mod.children && mod.children.length > 0 && visibleChildren?.length === 0) {
                return null;
              }

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
    </AppShell>
  );
}

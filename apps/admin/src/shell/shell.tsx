import { AppShell, Badge, Button, HStack, SideNav, SideNavItem, Text } from '@cmc/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session-context.js';
import { EnrollPicker } from '../lib/enroll-picker.js';
import { visibleModulesFor } from './nav-registry.js';
import { RoleSwitcher } from './role-switcher.js';
import { useState } from 'react';

export function Shell() {
  const { me, canDo } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);

  const modules = me ? visibleModulesFor(me.roles, canDo) : [];
  const canCreateReceipt = canDo('finance', 'receiptCreate');

  return (
    <AppShell
      contentPadding={0}
      topNav={
        <HStack
          justify="between"
          align="center"
          paddingInline={3}
          style={{
            height: 56,
            background: 'var(--cmc-surface)',
            borderBottom: '1px solid var(--cmc-border)',
          }}
        >
          <HStack gap={1} align="center">
            <Text weight="bold" size="sm" style={{ color: 'var(--cmc-brand)' }}>
              CMC EDU
            </Text>
            <Text type="supporting" size="2xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin
            </Text>
          </HStack>
          <HStack gap={2} align="center">
            {canCreateReceipt && (
              <Button
                label="+ Ghi danh"
                variant="secondary"
                size="sm"
                onClick={() => setEnrollPickerOpen(true)}
              />
            )}
            {me && me.roles[0] && <Badge label={me.roles[0]} variant="neutral" />}
            <RoleSwitcher />
          </HStack>
        </HStack>
      }
      sideNav={
        <SideNav>
          {modules.map((mod) => {
            const isActive = location.pathname.startsWith(mod.path);
            return (
              <SideNavItem
                key={mod.id}
                label={`${mod.icon}  ${mod.label}`}
                isSelected={isActive}
                onClick={() => navigate(mod.path)}
              />
            );
          })}
        </SideNav>
      }
    >
      <div style={{ background: 'var(--cmc-surface-2)', minHeight: '100%' }}>
        <Outlet />
      </div>

      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
    </AppShell>
  );
}

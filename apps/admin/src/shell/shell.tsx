import {
  AppFrame,
  Badge,
  CommandPalette,
  LineIcon,
  SideNav,
  activeModuleId,
  useCommandPaletteHotkey,
  type CommandItem,
} from '@cmc/ui';
import { formatRole } from '@cmc/auth';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session-context.js';
import { EnrollPicker } from '../lib/enroll-picker.js';
import { isNavChildVisible, visibleModulesFor } from './nav-registry.js';
import { RoleSwitcher } from './role-switcher.js';
import { useCallback, useMemo, useState } from 'react';

// Same convention as lib/trpc.ts: empty = same-origin (Vite /auth proxy · nginx).
const API_URL = ((import.meta.env['VITE_API_URL'] as string | undefined) ?? '').trim();

// App-specific shell wiring (design pilot, 2026-07-10; promoted to @cmc/ui in
// P3 — AppFrame/SideNav ship the layout + tree nav). This file keeps only
// session, permission-gated data (NAV_MODULES/visibleModulesFor), and the
// app-specific CTA/RoleSwitcher — no direct @astryxdesign import (one-door
// lint safe; primitives come through @cmc/ui).
export function Shell() {
  const { me, canDo } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const modules = me ? visibleModulesFor(me.roles, canDo) : [];
  const canCreateReceipt = canDo('finance', 'receiptCreate');
  const activeId = activeModuleId(location.pathname, modules);
  const activeModule = modules.find((m) => m.id === activeId);
  const topTitle = activeModule?.label ?? 'CMC EDU';

  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];
    for (const mod of modules) {
      items.push({
        id: `mod-${mod.id}`,
        label: mod.label,
        group: 'Module',
        href: mod.path,
        keywords: mod.id,
      });
      for (const child of mod.children ?? []) {
        if (!isNavChildVisible(child, canDo)) continue;
        items.push({
          id: `nav-${child.id}`,
          label: child.label,
          group: mod.label,
          href: child.path,
          keywords: `${mod.label} ${child.id}`,
        });
      }
    }
    if (import.meta.env.DEV) {
      items.push({
        id: 'design-lab',
        label: 'Design Lab',
        group: 'Dev',
        href: '/design',
        keywords: 'tokens components inventory',
      });
      items.push({
        id: 'design-lab-2',
        label: 'Design Lab 2 (Next-Gen)',
        group: 'Dev',
        href: '/design2',
        keywords: 'nextgen aetheria design2 visual mockup',
      });
    }
    if (canCreateReceipt) {
      items.push({
        id: 'enroll',
        label: 'Ghi danh (tạo phiếu)',
        group: 'Thao tác',
        keywords: 'enroll receipt',
        onSelect: () => setEnrollPickerOpen(true),
      });
    }
    return items;
  }, [modules, canDo, canCreateReceipt]);

  const openCmd = useCallback(() => setCmdOpen(true), []);
  useCommandPaletteHotkey(openCmd, Boolean(me));

  return (
    <>
      <AppFrame
        nav={
          <SideNav
            modules={modules}
            activeId={activeId}
            activePath={location.pathname}
            onNavigate={navigate}
            isChildVisible={(c) => isNavChildVisible(c, canDo)}
            brand={
              <>
                <span className="sh-logo">C</span>
                <span>
                  <span className="sh-brand-name" style={{ display: 'block' }}>
                    CMC EDU
                  </span>
                  <span className="sh-brand-sub" style={{ display: 'block' }}>
                    Admin
                  </span>
                </span>
              </>
            }
          />
        }
        topbarTitle={topTitle}
        topbarActions={
          <>
            <button
              type="button"
              className="sh-cta sh-cta--ghost"
              onClick={() => setCmdOpen(true)}
              title="Điều hướng nhanh (⌘K / Ctrl+K)"
            >
              <LineIcon name="search" size={15} strokeWidth={2.25} /> Tìm
              <kbd
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  opacity: 0.7,
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 4,
                  padding: '0 4px',
                }}
              >
                ⌘K
              </kbd>
            </button>
            {import.meta.env.DEV && (
              <>
                <button
                  type="button"
                  className="sh-cta sh-cta--ghost"
                  onClick={() => navigate('/design')}
                  title="Design Lab — inventory token & component"
                >
                  Design
                </button>
                <button
                  type="button"
                  className="sh-cta sh-cta--ghost"
                  onClick={() => navigate('/design2')}
                  title="Design Lab 2 — Next-Gen Aetheria Design System"
                >
                  Design 2
                </button>
              </>
            )}
            {canCreateReceipt && (
              <button className="sh-cta" onClick={() => setEnrollPickerOpen(true)}>
                <LineIcon name="plus" size={15} strokeWidth={2.25} /> Ghi danh
              </button>
            )}
            {me && me.roles[0] && <Badge label={formatRole(me.roles[0])} variant="neutral" />}
            <RoleSwitcher />
            {me && (
              <button
                type="button"
                className="sh-cta sh-cta--ghost"
                onClick={() => window.location.assign(`${API_URL}/auth/logout`)}
              >
                <LineIcon name="logout" size={15} strokeWidth={2.25} /> Đăng xuất
              </button>
            )}
          </>
        }
      >
        <Outlet />
      </AppFrame>
      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={commandItems}
        onNavigate={(href) => void navigate(href)}
      />
    </>
  );
}

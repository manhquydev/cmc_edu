import {
  Badge,
  CommandPalette,
  LineIcon,
  OdooNavbar,
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

/**
 * Admin application shell — Odoo navbar + app-switcher (design3).
 * Session, permission-gated nav (visibleModulesFor), CommandPalette, and
 * systray live here. Page content renders in <main class="o-main">.
 *
 * Chrome-suppressed mode: on /change-password (forced password rotation) the
 * navbar, app-switcher, ⌘K, and systray are hidden so the user cannot navigate
 * away before rotating. Server still does not enforce staff mCP today.
 */
export function Shell() {
  const { me, canDo } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Empty modules when me is null (should not reach Shell without RequireAuth).
  const modules = me ? visibleModulesFor(me.roles, canDo) : [];
  const canCreateReceipt = canDo('finance', 'receiptCreate');
  const activeId = activeModuleId(location.pathname, modules);

  // Path-only chrome suppress: session.me does not yet return mustChangePassword
  // for staff (client login hint only). Forced rotation always lands on this
  // route from login.tsx; deep-link escape remains a known server non-enforce.
  const suppressChrome =
    location.pathname === '/change-password' ||
    location.pathname.startsWith('/change-password/');

  const commandItems: CommandItem[] = useMemo(() => {
    if (suppressChrome) return [];
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
  }, [modules, canDo, canCreateReceipt, suppressChrome]);

  const openCmd = useCallback(() => {
    if (!suppressChrome) setCmdOpen(true);
  }, [suppressChrome]);
  useCommandPaletteHotkey(openCmd, Boolean(me) && !suppressChrome);

  const systray = suppressChrome ? null : (
    <>
      <button
        type="button"
        className="o-systray-badge"
        onClick={() => setCmdOpen(true)}
        title="Điều hướng nhanh (⌘K / Ctrl+K)"
        aria-label="Tìm (⌘K)"
      >
        <LineIcon name="search" size={15} strokeWidth={2.25} />
      </button>
      {canCreateReceipt && (
        <button
          type="button"
          className="o-systray-badge"
          onClick={() => setEnrollPickerOpen(true)}
          title="Ghi danh (tạo phiếu)"
          aria-label="Ghi danh"
        >
          <LineIcon name="plus" size={15} strokeWidth={2.25} />
        </button>
      )}
      {me && me.roles[0] && <Badge label={formatRole(me.roles[0])} variant="neutral" />}
      <RoleSwitcher />
      {me && (
        <button
          type="button"
          className="o-systray-badge"
          onClick={() => window.location.assign(`${API_URL}/auth/logout`)}
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LineIcon name="logout" size={15} strokeWidth={2.25} />
        </button>
      )}
    </>
  );

  return (
    <div className="o_web_client">
      {!suppressChrome && (
        <OdooNavbar
          apps={modules}
          activeAppId={activeId}
          isChildVisible={(c) => isNavChildVisible(c, canDo)}
          onNavigate={navigate}
          brand="CMC EDU"
          systray={systray}
        />
      )}
      <main className="o-main" role="main">
        <Outlet />
      </main>
      {!suppressChrome && (
        <>
          <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
          <CommandPalette
            open={cmdOpen}
            onOpenChange={setCmdOpen}
            items={commandItems}
            onNavigate={(href) => void navigate(href)}
          />
        </>
      )}
    </div>
  );
}

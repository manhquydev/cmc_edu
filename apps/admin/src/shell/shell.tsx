import { AppFrame, Badge, LineIcon, SideNav, activeModuleId } from '@cmc/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session-context.js';
import { EnrollPicker } from '../lib/enroll-picker.js';
import { isNavChildVisible, visibleModulesFor } from './nav-registry.js';
import { RoleSwitcher } from './role-switcher.js';
import { useState } from 'react';

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

  const modules = me ? visibleModulesFor(me.roles, canDo) : [];
  const canCreateReceipt = canDo('finance', 'receiptCreate');
  const activeId = activeModuleId(location.pathname, modules);
  const activeModule = modules.find((m) => m.id === activeId);
  const topTitle = activeModule?.label ?? 'CMC EDU';

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
                  <span className="sh-brand-name" style={{ display: 'block' }}>CMC EDU</span>
                  <span className="sh-brand-sub" style={{ display: 'block' }}>Admin</span>
                </span>
              </>
            }
          />
        }
        topbarTitle={topTitle}
        topbarActions={
          <>
            {canCreateReceipt && (
              <button className="sh-cta" onClick={() => setEnrollPickerOpen(true)}>
                <LineIcon name="plus" size={15} strokeWidth={2.25} /> Ghi danh
              </button>
            )}
            {me && me.roles[0] && <Badge label={me.roles[0]} variant="neutral" />}
            <RoleSwitcher />
          </>
        }
      >
        <Outlet />
      </AppFrame>
      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
    </>
  );
}

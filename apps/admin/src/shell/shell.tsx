import { Badge } from '@cmc/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session-context.js';
import { EnrollPicker } from '../lib/enroll-picker.js';
import { visibleModulesFor, type NavModule } from './nav-registry.js';
import { RoleSwitcher } from './role-switcher.js';
import { LineIcon } from '../lib/line-icons.js';
import { useState } from 'react';

// Custom light-mode app frame (design pilot, 2026-07-10). Grounded in the
// Apple + Notion reference study: white chrome / warm content canvas separated
// by surface contrast, monochrome outline icons (no emoji), Inter, one accent
// colour, generous whitespace, restrained hairlines. Built from plain elements
// + @cmc/ui primitives (no direct Astryx import — one-door lint safe).

const shellStyles = `
.sh-root { display: flex; height: 100vh; overflow: hidden; background: var(--cmc-canvas); }

/* Sidebar */
.sh-sb { width: 248px; flex-shrink: 0; background: var(--cmc-surface);
  border-right: 1px solid var(--cmc-border-subtle); display: flex; flex-direction: column; }
.sh-brand { display: flex; align-items: center; gap: 10px; padding: 18px 18px 16px; }
.sh-logo { width: 28px; height: 28px; border-radius: 7px; background: var(--cmc-brand);
  color: #fff; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; letter-spacing: -0.02em; }
.sh-brand-name { font-size: 15px; font-weight: 700; color: var(--cmc-text); letter-spacing: -0.02em; line-height: 1; }
.sh-brand-sub { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cmc-text-faint); margin-top: 3px; }
.sh-nav { flex: 1; overflow-y: auto; padding: 6px 10px 16px; }

.sh-item { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;
  padding: 8px 10px; margin-top: 2px; border-radius: 7px; cursor: pointer; border: none; background: none;
  font-size: 14px; font-weight: 500; color: var(--cmc-text-2); font-family: inherit;
  transition: background var(--cmc-transition), color var(--cmc-transition); }
.sh-item:hover { background: var(--cmc-surface-sunken); }
.sh-item-icon { color: var(--cmc-text-muted); transition: color var(--cmc-transition); }
.sh-item.is-active { background: var(--cmc-brand-muted); color: var(--cmc-brand); font-weight: 600; }
.sh-item.is-active .sh-item-icon { color: var(--cmc-brand); }

.sh-sub { margin: 2px 0 6px 0; display: flex; flex-direction: column; }
.sh-subitem { display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 12px; margin-left: 25px;
  border-left: 1.5px solid var(--cmc-border-subtle); border-radius: 0 6px 6px 0; cursor: pointer;
  background: none; border-top: none; border-right: none; border-bottom: none; text-align: left; font-family: inherit;
  font-size: 13px; color: var(--cmc-text-muted); transition: background var(--cmc-transition), color var(--cmc-transition); }
.sh-subitem:hover { background: var(--cmc-surface-sunken); color: var(--cmc-text-2); }
.sh-subitem.is-active { color: var(--cmc-brand); border-left-color: var(--cmc-brand); font-weight: 600; }

/* Main column */
.sh-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.sh-top { height: 60px; flex-shrink: 0; background: rgba(255, 255, 255, 0.78);
  backdrop-filter: var(--cmc-blur-nav); -webkit-backdrop-filter: var(--cmc-blur-nav);
  border-bottom: 1px solid var(--cmc-border-subtle); display: flex; align-items: center;
  justify-content: space-between; padding: 0 24px; }
.sh-top-title { font-size: 15px; font-weight: 600; color: var(--cmc-text); letter-spacing: -0.01em; }
.sh-top-actions { display: flex; align-items: center; gap: 14px; }
.sh-cta { display: inline-flex; align-items: center; gap: 5px; height: 34px; padding: 0 15px;
  border-radius: var(--cmc-radius-pill); background: var(--cmc-brand); color: #fff;
  font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: inherit;
  transition: background var(--cmc-transition); }
.sh-cta:hover { background: var(--cmc-brand-hover); }
.sh-content { flex: 1; overflow-y: auto; }
`;

/** Most-specific active module: longest matching path across module + children. */
function activeModuleId(pathname: string, modules: NavModule[]): string | null {
  let bestId: string | null = null;
  let bestLen = 0;
  for (const mod of modules) {
    const paths = [mod.path, ...(mod.children?.map((c) => c.path) ?? [])];
    for (const p of paths) {
      if ((pathname === p || pathname.startsWith(p + '/')) && p.length > bestLen) {
        bestLen = p.length;
        bestId = mod.id;
      }
    }
  }
  return bestId;
}

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

  const isPathActive = (p: string) => location.pathname === p || location.pathname.startsWith(p + '/');

  return (
    <div className="sh-root">
      <style>{shellStyles}</style>

      <aside className="sh-sb">
        <div className="sh-brand">
          <span className="sh-logo">C</span>
          <span>
            <span className="sh-brand-name" style={{ display: 'block' }}>CMC EDU</span>
            <span className="sh-brand-sub" style={{ display: 'block' }}>Admin</span>
          </span>
        </div>

        <nav className="sh-nav">
          {modules.map((mod) => {
            const active = mod.id === activeId;
            const visibleChildren = (mod.children ?? []).filter(
              (c) => (c.permission ? canDo(c.permission.module, c.permission.action) : true),
            );
            return (
              <div key={mod.id}>
                <button
                  className={`sh-item${active ? ' is-active' : ''}`}
                  onClick={() => navigate(mod.path)}
                >
                  <span className="sh-item-icon"><LineIcon name={mod.icon} size={18} /></span>
                  {mod.label}
                </button>
                {active && visibleChildren.length > 0 && (
                  <div className="sh-sub">
                    {visibleChildren.map((child) => (
                      <button
                        key={child.id}
                        className={`sh-subitem${isPathActive(child.path) ? ' is-active' : ''}`}
                        onClick={() => navigate(child.path)}
                      >
                        <LineIcon name={child.icon} size={15} />
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="sh-main">
        <header className="sh-top">
          <span className="sh-top-title">{topTitle}</span>
          <div className="sh-top-actions">
            {canCreateReceipt && (
              <button className="sh-cta" onClick={() => setEnrollPickerOpen(true)}>
                <LineIcon name="plus" size={15} strokeWidth={2.25} /> Ghi danh
              </button>
            )}
            {me && me.roles[0] && <Badge label={me.roles[0]} variant="neutral" />}
            <RoleSwitcher />
          </div>
        </header>

        <div className="sh-content">
          <Outlet />
        </div>
      </div>

      <EnrollPicker opened={enrollPickerOpen} onClose={() => setEnrollPickerOpen(false)} />
    </div>
  );
}

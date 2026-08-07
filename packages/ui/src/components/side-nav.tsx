import type { ReactNode } from 'react';
import { LineIcon } from './line-icon.js';
import type { NavEntry, NavModule } from './nav-types.js';

// Sidebar tree nav (promoted from apps/admin/src/shell/shell.tsx — P3 shell
// extraction). DUMB — props-only, no router/session/tRPC coupling. Renders
// module rows + permission-filtered children when a module is active, one
// LineIcon per entry. Requires @cmc/ui/console.css (.sh-* classes).
export interface SideNavProps {
  modules: NavModule[];
  /** Active top-level module id (see `activeModuleId`). */
  activeId: string | null;
  /** Full current path — highlights the active child row independent of
   *  `activeId`, mirroring the original route-based highlighting. */
  activePath: string;
  onNavigate: (path: string) => void;
  /** Permission gate per child entry; omitted -> child is always visible. */
  isChildVisible?: (child: NavEntry) => boolean;
  /** Brand/logo content rendered above the nav tree (wrapped in `.sh-brand`). */
  brand?: ReactNode;
}

function isPathActive(activePath: string, path: string): boolean {
  return activePath === path || activePath.startsWith(path + '/');
}

export function SideNav({ modules, activeId, activePath, onNavigate, isChildVisible, brand }: SideNavProps) {
  return (
    <aside className="sh-sb">
      {brand && <div className="sh-brand">{brand}</div>}

      <nav className="sh-nav">
        {modules.map((mod) => {
          const active = mod.id === activeId;
          const visibleChildren = (mod.children ?? []).filter((c) => (isChildVisible ? isChildVisible(c) : true));
          return (
            <div key={mod.id}>
              <button
                className={`sh-item${active ? ' is-active' : ''}`}
                onClick={() => onNavigate(mod.path)}
              >
                <span className="sh-item-icon"><LineIcon name={mod.icon} size={18} /></span>
                {mod.label}
              </button>
              {active && visibleChildren.length > 0 && (
                <div className="sh-sub">
                  {visibleChildren.map((child) => (
                    <button
                      key={child.id}
                      className={`sh-subitem${isPathActive(activePath, child.path) ? ' is-active' : ''}`}
                      onClick={() => onNavigate(child.path)}
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
  );
}

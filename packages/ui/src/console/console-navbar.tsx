import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LineIcon } from '../components/line-icon.js';
import type { NavEntry, NavModule } from '../components/nav-types.js';

/**
 * Odoo-style top navbar (46px purple) + app-switcher dropdown + section menu.
 * Dumb / props-only — no session, router, or tRPC. Permission gate is required
 * (never optional fail-open like SideNav's isChildVisible).
 *
 * Requires `@cmc/ui/console.css` and an ancestor with class `.o_web_client`.
 */
export interface OdooNavbarProps {
  apps: NavModule[];
  activeAppId: string | null;
  /** Required permission gate — children that fail are never rendered. */
  isChildVisible: (child: NavEntry) => boolean;
  onNavigate: (path: string) => void;
  /** Brand label next to the app-switcher toggle (default: active app label). */
  brand?: ReactNode;
  systray?: ReactNode;
  className?: string;
}

export function OdooNavbar({
  apps,
  activeAppId,
  isChildVisible,
  onNavigate,
  brand,
  systray,
  className,
}: OdooNavbarProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const activeApp = apps.find((a) => a.id === activeAppId) ?? null;
  const menuChildren = (activeApp?.children ?? []).filter(isChildVisible);
  const brandContent =
    brand ?? activeApp?.label ?? (apps[0] ? apps[0].label : 'CMC EDU');

  const rootClass = className ? `o-navbar ${className}` : 'o-navbar';

  useEffect(() => {
    if (!switcherOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSwitcherOpen(false);
        toggleRef.current?.focus();
      }
    }

    function onPointerDown(e: MouseEvent | PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setSwitcherOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [switcherOpen]);

  return (
    <nav ref={rootRef} className={rootClass} aria-label="Ứng dụng">
      <button
        ref={toggleRef}
        type="button"
        className="o-app-switcher-toggle"
        onClick={() => setSwitcherOpen((open) => !open)}
        aria-expanded={switcherOpen}
        aria-controls={switcherOpen ? menuId : undefined}
        aria-label="Mở app switcher"
      >
        <LineIcon name="grid" size={18} strokeWidth={2.25} />
      </button>

      <span className="o-brand">{brandContent}</span>

      <ul className="o-menu-sections">
        {menuChildren.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              className="o-menu-item"
              onClick={() => {
                setSwitcherOpen(false);
                onNavigate(child.path);
              }}
            >
              {child.label}
            </button>
          </li>
        ))}
      </ul>

      {systray ? <div className="o-systray">{systray}</div> : null}

      {switcherOpen && (
        <div
          id={menuId}
          className="o-app-switcher-menu"
          role="menu"
          aria-label="App switcher"
        >
          {apps.map((mod) => (
            <button
              key={mod.id}
              type="button"
              role="menuitem"
              className="o-app-switcher-tile"
              aria-current={mod.id === activeAppId ? 'page' : undefined}
              onClick={() => {
                onNavigate(mod.path);
                setSwitcherOpen(false);
              }}
            >
              <LineIcon name={mod.icon} size={20} strokeWidth={2} />
              <span>{mod.label}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

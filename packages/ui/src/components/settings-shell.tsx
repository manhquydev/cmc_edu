import type { ReactNode } from 'react';

export interface SettingsNavItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Polaris/Odoo-style settings layout: left rail + main panel.
 * Requires @cmc/ui/console.css (.console-settings-shell*).
 */
export interface SettingsShellProps {
  items: SettingsNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function SettingsShell({
  items,
  activeId,
  onSelect,
  children,
  title = 'Cài đặt',
  className,
}: SettingsShellProps) {
  const cls = className ? `console-settings-shell ${className}` : 'console-settings-shell';
  return (
    <div className={cls}>
      <aside className="console-settings-rail" aria-label={title}>
        <div className="console-settings-rail-title">{title}</div>
        <nav className="console-settings-nav">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'console-settings-nav-item is-active' : 'console-settings-nav-item'}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {item.icon ? <span className="console-settings-nav-icon">{item.icon}</span> : null}
                <span className="console-settings-nav-copy">
                  <span className="console-settings-nav-label">{item.label}</span>
                  {item.description ? (
                    <span className="console-settings-nav-desc">{item.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="console-settings-main">{children}</div>
    </div>
  );
}

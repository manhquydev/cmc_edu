import type { ReactNode } from 'react';

export interface SettingsNavItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Polaris/Odoo-style settings layout: left rail + main panel.
 * Requires @cmc/ui/premium.css (.ck-settings-shell*).
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
  const cls = className ? `ck-settings-shell ${className}` : 'ck-settings-shell';
  return (
    <div className={cls}>
      <aside className="ck-settings-rail" aria-label={title}>
        <div className="ck-settings-rail-title">{title}</div>
        <nav className="ck-settings-nav">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'ck-settings-nav-item is-active' : 'ck-settings-nav-item'}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {item.icon ? <span className="ck-settings-nav-icon">{item.icon}</span> : null}
                <span className="ck-settings-nav-copy">
                  <span className="ck-settings-nav-label">{item.label}</span>
                  {item.description ? (
                    <span className="ck-settings-nav-desc">{item.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="ck-settings-main">{children}</div>
    </div>
  );
}

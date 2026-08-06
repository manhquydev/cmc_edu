import type { ReactNode } from 'react';

export interface SettingsNavItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Polaris/Odoo-style settings layout: left rail + main panel.
 * Requires @cmc/ui/odoo.css (.o-settings-shell*).
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
  const cls = className ? `o-settings-shell ${className}` : 'o-settings-shell';
  return (
    <div className={cls}>
      <aside className="o-settings-rail" aria-label={title}>
        <div className="o-settings-rail-title">{title}</div>
        <nav className="o-settings-nav">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'o-settings-nav-item is-active' : 'o-settings-nav-item'}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {item.icon ? <span className="o-settings-nav-icon">{item.icon}</span> : null}
                <span className="o-settings-nav-copy">
                  <span className="o-settings-nav-label">{item.label}</span>
                  {item.description ? (
                    <span className="o-settings-nav-desc">{item.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="o-settings-main">{children}</div>
    </div>
  );
}

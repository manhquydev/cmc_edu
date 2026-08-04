import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface StatActionItem {
  key: string;
  label: string;
  count?: number | string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

/**
 * Odoo smart-button / Lightning related-count strip.
 * Requires @cmc/ui/premium.css (.ck-stat-action*).
 */
export interface StatActionsProps {
  items: StatActionItem[];
  className?: string;
}

export function StatActions({ items, className }: StatActionsProps) {
  if (items.length === 0) return null;
  const cls = className ? `ck-stat-actions ${className}` : 'ck-stat-actions';

  return (
    <div className={cls} role="group" aria-label="Liên kết nhanh">
      {items.map((item) => {
        const body = (
          <>
            {item.icon}
            {item.count != null ? (
              <span className="ck-stat-action-count">{item.count}</span>
            ) : null}
            <span className="ck-stat-action-label">{item.label}</span>
          </>
        );
        if (item.href) {
          return (
            <Link key={item.key} to={item.href} className="ck-stat-action">
              {body}
            </Link>
          );
        }
        return (
          <button key={item.key} type="button" className="ck-stat-action" onClick={item.onClick}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

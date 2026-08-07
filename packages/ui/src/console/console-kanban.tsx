import type { CSSProperties, ReactNode } from 'react';

/**
 * Odoo-analogue kanban primitives. Color bar uses --odoo-kanban-color-1..6.
 * Requires `@cmc/ui/console.css` and an ancestor with class `.o_web_client`.
 */

export interface KanbanBoardProps {
  children: ReactNode;
  className?: string;
}

export function KanbanBoard({ children, className }: KanbanBoardProps) {
  const cls = className ? `o-kanban-board ${className}` : 'o-kanban-board';
  return <div className={cls}>{children}</div>;
}

export interface KanbanColumnProps {
  title: ReactNode;
  /** Shown as a pill count; defaults to counting child nodes when omitted. */
  count?: number;
  children?: ReactNode;
  className?: string;
}

export function KanbanColumn({ title, count, children, className }: KanbanColumnProps) {
  const cls = className ? `o-kanban-col ${className}` : 'o-kanban-col';
  const childArray = Array.isArray(children) ? children : children != null ? [children] : [];
  const displayCount = count ?? childArray.filter(Boolean).length;

  return (
    <div className={cls}>
      <div className="o-kanban-col-header">
        <span>{title}</span>
        <span className="o-kanban-col-count">{displayCount}</span>
      </div>
      <div className="o-kanban-col-body">{children}</div>
    </div>
  );
}

export interface KanbanCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Maps to `--odoo-kanban-color-N` (1..6). */
  colorIndex?: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function KanbanCard({
  title,
  subtitle,
  footer,
  colorIndex,
  children,
  onClick,
  className,
}: KanbanCardProps) {
  const cls = className ? `o-kanban-card ${className}` : 'o-kanban-card';
  const style =
    colorIndex != null
      ? ({
          '--odoo-kanban-card-color': `var(--odoo-kanban-color-${colorIndex})`,
        } as CSSProperties)
      : undefined;

  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick}>
        <div className="o-kanban-card-title">{title}</div>
        {subtitle != null ? <div className="o-kanban-card-sub">{subtitle}</div> : null}
        {children}
        {footer != null ? <div className="o-kanban-card-footer">{footer}</div> : null}
      </button>
    );
  }

  return (
    <div className={cls} style={style}>
      <div className="o-kanban-card-title">{title}</div>
      {subtitle != null ? <div className="o-kanban-card-sub">{subtitle}</div> : null}
      {children}
      {footer != null ? <div className="o-kanban-card-footer">{footer}</div> : null}
    </div>
  );
}

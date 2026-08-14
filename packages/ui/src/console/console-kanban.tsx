import type { CSSProperties, ReactNode } from 'react';
import { LineIcon } from '../components/line-icon.js';

/**
 * Odoo-analogue kanban primitives. Color bar uses --console-kanban-color-1..6.
 * Requires `@cmc/ui/console.css` and an ancestor with class `.o_web_client`.
 */

export interface KanbanBoardProps {
  children: ReactNode;
  className?: string;
}

export function KanbanBoard({ children, className }: KanbanBoardProps) {
  const cls = className ? `console-kanban-board ${className}` : 'console-kanban-board';
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
  const cls = className ? `console-kanban-col ${className}` : 'console-kanban-col';
  const childArray = Array.isArray(children) ? children : children != null ? [children] : [];
  const displayCount = count ?? childArray.filter(Boolean).length;

  return (
    <div className={cls}>
      <div className="console-kanban-col-header">
        <span>{title}</span>
        <span className="console-kanban-col-count">{displayCount}</span>
      </div>
      <div className="console-kanban-col-body">{children}</div>
    </div>
  );
}

export interface KanbanCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Maps to `--console-kanban-color-N` (1..6). */
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
  const cls = className ? `console-kanban-card ${className}` : 'console-kanban-card';
  const style =
    colorIndex != null
      ? ({
          '--console-kanban-card-color': `var(--console-kanban-color-${colorIndex})`,
        } as CSSProperties)
      : undefined;

  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick}>
        <div className="console-kanban-card-title">{title}</div>
        {subtitle != null ? <div className="console-kanban-card-sub">{subtitle}</div> : null}
        {children}
        {footer != null ? <div className="console-kanban-card-footer">{footer}</div> : null}
      </button>
    );
  }

  return (
    <div className={cls} style={style}>
      <div className="console-kanban-card-title">{title}</div>
      {subtitle != null ? <div className="console-kanban-card-sub">{subtitle}</div> : null}
      {children}
      {footer != null ? <div className="console-kanban-card-footer">{footer}</div> : null}
    </div>
  );
}

export interface KanbanRecordGridProps {
  children: ReactNode;
  className?: string;
}

/** People-record grid (SIS students / faculties). Not a pipeline board. */
export function KanbanRecordGrid({ children, className }: KanbanRecordGridProps) {
  const cls = className
    ? `console-kanban-record-grid ${className}`
    : 'console-kanban-record-grid';
  return <div className={cls}>{children}</div>;
}

export interface KanbanRecordCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  photoUrl?: string;
  photoInitial?: string;
  onClick?: () => void;
  className?: string;
}

export function KanbanRecordCard({
  title,
  subtitle,
  meta,
  photoUrl,
  photoInitial,
  onClick,
  className,
}: KanbanRecordCardProps) {
  const cls = className
    ? `console-kanban-record-card ${className}`
    : 'console-kanban-record-card';
  const initial =
    photoInitial?.trim().charAt(0).toUpperCase() ||
    (typeof title === 'string' ? title.trim().charAt(0).toUpperCase() : '?');
  const body = (
    <>
      {photoUrl ? (
        <img className="console-kanban-record-photo" src={photoUrl} alt="" />
      ) : (
        <span className="console-kanban-record-photo" aria-hidden>
          {initial}
        </span>
      )}
      <span className="console-kanban-record-body">
        <span className="console-kanban-record-title">{title}</span>
        {subtitle != null ? <span className="console-kanban-record-sub">{subtitle}</span> : null}
        {meta != null ? <span className="console-kanban-record-meta">{meta}</span> : null}
      </span>
      <span className="console-kanban-record-clock" aria-hidden>
        <LineIcon name="clock" size={14} strokeWidth={2} />
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

import type { ReactNode } from 'react';

/**
 * Sticky list ops chrome — Odoo ControlPanel analogue for CMC.
 * Three zones: LEFT (New + title) | CENTER (search/filters) | RIGHT (pager).
 * `left`/`center`/`right` win when set; otherwise `header`/`filters`/`footer`.
 * Requires @cmc/ui/console.css (.console-control-bar*).
 */
export interface ControlBarProps {
  /** Usually `<PageHeader>`. Alias of `left` when `left` is omitted. */
  header?: ReactNode;
  /** Usually `<FilterBar>`. Alias of `center` when `center` is omitted. */
  filters?: ReactNode;
  /** Pager, bulk tools, view switcher. Alias of `right` when `right` is omitted. */
  footer?: ReactNode;
  /** LEFT zone — wins over `header`. */
  left?: ReactNode;
  /** CENTER zone — wins over `filters`. */
  center?: ReactNode;
  /** RIGHT zone — wins over `footer`. */
  right?: ReactNode;
  className?: string;
}

function present(node: ReactNode): boolean {
  return node != null && node !== false;
}

export function ControlBar({
  header,
  filters,
  footer,
  left,
  center,
  right,
  className,
}: ControlBarProps) {
  const leftNode = left ?? header;
  const centerNode = center ?? filters;
  const rightNode = right ?? footer;
  const cls = className ? `console-control-bar ${className}` : 'console-control-bar';

  return (
    <div className={cls}>
      {present(leftNode) ? (
        <div className="console-control-bar-header console-control-bar-left">{leftNode}</div>
      ) : null}
      {present(centerNode) ? (
        <div className="console-control-bar-filters console-control-bar-center">{centerNode}</div>
      ) : null}
      {present(rightNode) ? (
        <div className="console-control-bar-footer console-control-bar-right">{rightNode}</div>
      ) : null}
    </div>
  );
}

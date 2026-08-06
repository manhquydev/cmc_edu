import type { ReactNode } from 'react';

/**
 * Sticky list ops chrome — Odoo ControlPanel analogue for CMC.
 * Compose: PageHeader · FilterBar · ListPagination (footer).
 * Requires @cmc/ui/odoo.css (.o-control-bar*).
 */
export interface ControlBarProps {
  /** Usually `<PageHeader>`. */
  header: ReactNode;
  /** Usually `<FilterBar>`. */
  filters?: ReactNode;
  /** Pager, bulk tools, secondary strip under filters. */
  footer?: ReactNode;
  className?: string;
}

export function ControlBar({ header, filters, footer, className }: ControlBarProps) {
  const cls = className ? `o-control-bar ${className}` : 'o-control-bar';
  const hasFilters = filters != null && filters !== false;
  const hasFooter = footer != null && footer !== false;

  return (
    <div className={cls}>
      <div className="o-control-bar-header">{header}</div>
      {hasFilters ? <div className="o-control-bar-filters">{filters}</div> : null}
      {hasFooter ? <div className="o-control-bar-footer">{footer}</div> : null}
    </div>
  );
}

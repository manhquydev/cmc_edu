import type { ReactNode } from 'react';

/**
 * Sticky list ops chrome — Odoo ControlPanel analogue for CMC.
 * Compose: PageHeader · FilterBar · ListPagination (footer).
 * Requires @cmc/ui/premium.css (.tpl-control-bar*).
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
  const cls = className ? `tpl-control-bar ${className}` : 'tpl-control-bar';
  const hasFilters = filters != null && filters !== false;
  const hasFooter = footer != null && footer !== false;

  return (
    <div className={cls}>
      <div className="tpl-control-bar-header">{header}</div>
      {hasFilters ? <div className="tpl-control-bar-filters">{filters}</div> : null}
      {hasFooter ? <div className="tpl-control-bar-footer">{footer}</div> : null}
    </div>
  );
}

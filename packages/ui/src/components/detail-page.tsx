import type { ReactNode } from 'react';

export interface DetailPageProps {
  /**
   * Chrome: usually `<PageHeader>` with linked breadcrumbs
   * (parent modules clickable → SPA).
   */
  header: ReactNode;
  /**
   * Entity identity strip: `<EntityHeader>` (avatar · title · badges · actions).
   * Prefer this over stuffing identity only into PageHeader title.
   */
  entity?: ReactNode;
  /**
   * Optional overview band: HighlightStrip / Metric / Callout — **not sticky**.
   * Prefer thin workflow chrome in `statusbar` instead of packing it here.
   */
  summary?: ReactNode;
  /**
   * Thin Odoo-like statusband (usually `<WorkflowStatusbar>` / ProgressSteps).
   * Sticky on md+ under `.o_web_client`; keep tall strips out of this slot.
   */
  statusbar?: ReactNode;
  /** Tab strip + tab panels (e.g. `<CmcTabs>`). */
  tabs?: ReactNode;
  /**
   * Main body when not using tabs-only content, or extra sections below tabs.
   * Use `.o-detail-stack` / `.o-detail-split` inside for layout.
   */
  children?: ReactNode;
  /** Tighter padding for ops-dense detail. */
  density?: 'default' | 'ops';
}

/**
 * Canonical detail-page frame for the whole admin product.
 *
 * Odoo form analogue (design3):
 * ```
 * [ PageHeader — CP-like crumbs ]
 * [ .o-form-sheet-bg ]
 *   [ summary — HighlightStrip / metrics (scrolls) ]
 *   [ statusbar — thin WorkflowStatusbar (sticky md+) ]
 *   [ .o-form-sheet ]
 *     [ EntityHeader ]
 *     [ CmcTabs? ]
 *     [ body ]
 * ```
 *
 * Props-only; pages own tRPC. Requires `@cmc/ui/console.css` (`.o-detail*`, `.o-form-sheet*`).
 */
export function DetailPage({
  header,
  entity,
  summary,
  statusbar,
  tabs,
  children,
  density = 'default',
}: DetailPageProps) {
  const wrap = density === 'ops' ? 'o-wrap o-wrap--ops o-detail' : 'o-wrap o-detail';
  const hasBody = children != null && children !== false && children !== true;
  const hasSheet = entity != null || tabs != null || hasBody;

  return (
    <div className={wrap}>
      {header}
      <div className="o-form-sheet-bg">
        {summary != null ? <div className="o-detail-summary">{summary}</div> : null}
        {statusbar != null ? (
          <div className="o-detail-statusbar">{statusbar}</div>
        ) : null}
        {hasSheet ? (
          <div className="o-form-sheet">
            {entity != null ? <div className="o-detail-entity">{entity}</div> : null}
            {tabs != null ? <div className="o-detail-tabs">{tabs}</div> : null}
            {hasBody ? <div className="o-detail-body">{children}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

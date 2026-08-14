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
   * Optional overview band: HighlightStrip / StatActions — sits **inside** the
   * white sheet (after statusbar), not as a card on the gray canvas (pack 14).
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
   * Use `.console-detail-stack` / `.console-detail-split` inside for layout.
   */
  children?: ReactNode;
  /** Tighter padding for ops-dense detail. */
  density?: 'default' | 'ops';
}

/**
 * Canonical detail-page frame for the whole admin product.
 *
 * Odoo / OpenEduCat form analogue (pack 14/16):
 * ```
 * [ PageHeader — CP-like crumbs ]
 * [ .console-form-sheet-bg ]
 *   [ .console-form-sheet ]
 *     [ statusbar — right-aligned chevrons, first row of the white sheet ]
 *     [ summary — key fields / StatActions (no raised card on canvas) ]
 *     [ EntityHeader ]
 *     [ CmcTabs? ]
 *     [ body ]
 * ```
 *
 * Props-only; pages own tRPC. Requires `@cmc/ui/console.css` (`.console-detail*`, `.console-form-sheet*`).
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
  const wrap = density === 'ops' ? 'console-wrap console-wrap--ops console-detail' : 'console-wrap console-detail';
  const hasBody = children != null && children !== false && children !== true;
  const hasSheet = entity != null || tabs != null || hasBody || summary != null;

  return (
    <div className={wrap}>
      {header}
      <div className="console-form-sheet-bg">
        {hasSheet ? (
          <div className="console-form-sheet">
            {statusbar != null ? (
              <div className="console-detail-statusbar">{statusbar}</div>
            ) : null}
            {summary != null ? <div className="console-detail-summary">{summary}</div> : null}
            {entity != null ? <div className="console-detail-entity">{entity}</div> : null}
            {tabs != null ? <div className="console-detail-tabs">{tabs}</div> : null}
            {hasBody ? <div className="console-detail-body">{children}</div> : null}
          </div>
        ) : statusbar != null ? (
          <div className="console-detail-statusbar">{statusbar}</div>
        ) : null}
      </div>
    </div>
  );
}

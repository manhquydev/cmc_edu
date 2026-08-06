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
   * Optional overview band: KeyValueList / Metric strip / Callout — above tabs.
   */
  summary?: ReactNode;
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
 * ```
 * [ PageHeader breadcrumbs ]
 * [ EntityHeader identity ]
 * [ summary — optional ]
 * [ CmcTabs — optional ]
 * [ body sections — optional ]
 * ```
 *
 * Props-only; pages own tRPC. Requires `@cmc/ui/odoo.css` (`.o-detail*`).
 */
export function DetailPage({
  header,
  entity,
  summary,
  tabs,
  children,
  density = 'default',
}: DetailPageProps) {
  const wrap = density === 'ops' ? 'o-wrap o-wrap--ops o-detail' : 'o-wrap o-detail';
  const hasBody = children != null && children !== false && children !== true;

  return (
    <div className={wrap}>
      {header}
      {entity != null ? <div className="o-detail-entity">{entity}</div> : null}
      {summary != null ? <div className="o-detail-summary">{summary}</div> : null}
      {tabs != null ? <div className="o-detail-tabs">{tabs}</div> : null}
      {hasBody ? <div className="o-detail-body">{children}</div> : null}
    </div>
  );
}

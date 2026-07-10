import type { ReactNode } from 'react';

export interface DetailPageProps {
  /** Page header slot — typically a `<PageHeader>` carrying a back/breadcrumb action. */
  header: ReactNode;
  /** Optional tab strip slot — typically a `<CmcTabs>`. */
  tabs?: ReactNode;
  /** Detail content — typically a `<MasterDetail>` or a plain content region. */
  children: ReactNode;
}

// Thin premium detail-page archetype (P4 template extraction): warm-canvas
// wrapper + header slot + optional tab strip + content region. Composes
// existing @cmc/ui atoms — props-only, no data fetching (pages own tRPC +
// navigation). Requires @cmc/ui/premium.css (.tpl-*).
export function DetailPage({ header, tabs, children }: DetailPageProps) {
  return (
    <div className="tpl-wrap">
      {header}
      {tabs}
      <div className="tpl-detail-body">{children}</div>
    </div>
  );
}

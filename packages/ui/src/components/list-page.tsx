import type { ReactNode } from 'react';
import { EmptyState } from './empty-state.js';

export interface ListPageProps {
  /** Page header slot — typically a `<PageHeader>`. */
  header: ReactNode;
  /** Optional filter row slot — typically a `<FilterBar>`. */
  filters?: ReactNode;
  /** List content — typically a `<DataTable>`. Hidden when `isEmpty` is true. */
  children: ReactNode;
  /**
   * When true, renders `empty` (or a default `<EmptyState>`) instead of
   * `children`. Most tables already handle their own loading/empty/error
   * states internally (see `DataTable`) — this prop is for pages that need a
   * page-level empty state instead.
   */
  isEmpty?: boolean;
  /** Custom empty-state node — falls back to a default `<EmptyState>` when omitted. */
  empty?: ReactNode;
}

// Thin premium list-page archetype (P4 template extraction): warm-canvas
// wrapper + header/filter slots + list region with an EmptyState fallback.
// Composes existing @cmc/ui atoms — props-only, no data fetching or business
// logic (pages own tRPC + filters). Requires @cmc/ui/premium.css (.tpl-*).
export function ListPage({ header, filters, children, isEmpty, empty }: ListPageProps) {
  return (
    <div className="tpl-wrap">
      {header}
      {filters}
      <div className="tpl-list-body">
        {isEmpty ? (empty ?? <EmptyState title="Không có dữ liệu" />) : children}
      </div>
    </div>
  );
}

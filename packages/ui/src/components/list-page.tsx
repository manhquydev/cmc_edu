import type { ReactNode } from 'react';
import { ControlBar } from './control-bar.js';
import { EmptyState } from './empty-state.js';

export interface ListPageProps {
  /** Page header slot — typically a `<PageHeader>`. */
  header: ReactNode;
  /** Optional filter row slot — typically a `<FilterBar>`. */
  filters?: ReactNode;
  /**
   * Optional ControlBar footer (pager, bulk tools).
   * Rendered under filters inside the sticky control band.
   */
  controlFooter?: ReactNode;
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
  /** Tighter padding for dense ops tables. */
  density?: 'default' | 'ops';
}

// List-page archetype: canvas wrap + ControlBar + body. Props-only.
// Requires @cmc/ui/console.css (.console-wrap, .console-list-body).
export function ListPage({
  header,
  filters,
  controlFooter,
  children,
  isEmpty,
  empty,
  density = 'default',
}: ListPageProps) {
  const wrapClass = density === 'ops' ? 'console-wrap console-wrap--ops' : 'console-wrap';
  return (
    <div className={wrapClass}>
      <ControlBar header={header} filters={filters} footer={controlFooter} />
      <div className="console-list-body">
        {isEmpty ? (empty ?? <EmptyState title="Không có dữ liệu" density="ops" />) : children}
      </div>
    </div>
  );
}

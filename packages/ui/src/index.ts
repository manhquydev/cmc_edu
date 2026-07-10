// @cmc/ui — design system entrypoint (TL12).
//
// Ships the design tokens as a typed object mirroring `tokens.css` so TS
// consumers get autocompletion and non-CSS surfaces (charts, canvas) can read
// the same values. Import `@cmc/ui/tokens.css` once at the app root to register
// the CSS custom properties.

export const tokens = {
  color: {
    brand: 'var(--cmc-brand)',
    brandHover: 'var(--cmc-brand-hover)',
    brandMuted: 'var(--cmc-brand-muted)',
    brandInk: 'var(--cmc-brand-ink)',
    text: 'var(--cmc-text)',
    text2: 'var(--cmc-text-2)',
    textMuted: 'var(--cmc-text-muted)',
    textFaint: 'var(--cmc-text-faint)',
    surface: 'var(--cmc-surface)',
    surface2: 'var(--cmc-surface-2)',
    border: 'var(--cmc-border)',
    success: 'var(--cmc-success)',
    warning: 'var(--cmc-warning)',
    danger: 'var(--cmc-danger)',
  },
  radius: {
    xs: 'var(--cmc-radius-xs)',
  },
  space: {
    1: 'var(--cmc-space-1)',
    2: 'var(--cmc-space-2)',
    3: 'var(--cmc-space-3)',
    4: 'var(--cmc-space-4)',
  },
  font: {
    sans: 'var(--cmc-font-sans)',
    sizeData: 'var(--cmc-font-size-data)',
    sizeColumn: 'var(--cmc-font-size-column)',
  },
} as const;

export type Tokens = typeof tokens;

// Astryx theme scope provider — see astryx-theme-cmc.css for token values.
export { AstryxCmcProvider } from './astryx-provider.js';
export type { AstryxCmcProviderProps } from './astryx-provider.js';

// Astryx primitive re-export barrel (the "single door" for apps — see
// primitives.ts). Lets apps import Text/Stack/Button/… from @cmc/ui instead
// of @astryxdesign/core directly, satisfying the one-door lint rule.
export * from './primitives.js';

// Primitive components (DUMB — no tRPC calls, props-driven only)
export { StatusBadge } from './components/status-badge.js';
export type { StatusBadgeProps } from './components/status-badge.js';

export { PageHeader } from './components/page-header.js';
export type { PageHeaderProps, Breadcrumb } from './components/page-header.js';

export { DataTable } from './components/data-table.js';
export type { DataTableProps, TableColumn } from './components/data-table.js';

export { EmptyState } from './components/empty-state.js';
export type { EmptyStateProps } from './components/empty-state.js';

export { StatCard } from './components/stat-card.js';
export type { StatCardProps } from './components/stat-card.js';

export { FilterBar } from './components/filter-bar.js';
export type { FilterBarProps, FilterDef } from './components/filter-bar.js';

export { MasterDetail } from './components/master-detail.js';
export type { MasterDetailProps } from './components/master-detail.js';

export { CmcTabs } from './components/cmc-tabs.js';
export type { CmcTabsProps, CmcTabDef } from './components/cmc-tabs.js';

export { ConfirmDialog } from './components/confirm-dialog.js';
export type { ConfirmDialogProps } from './components/confirm-dialog.js';

export { ResultPanel } from './components/result-panel.js';
export type { ResultPanelProps, ResultStatus } from './components/result-panel.js';

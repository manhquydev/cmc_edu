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
    md: 'var(--cmc-radius-md)',
    lg: 'var(--cmc-radius-lg)',
    pill: 'var(--cmc-radius-pill)',
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
  // Premium design-language layer (mirrors the v2 premium block in tokens.css,
  // grounded in the Apple + Notion references). Non-CSS surfaces read these.
  premium: {
    canvas: 'var(--cmc-canvas)',
    surfaceRaised: 'var(--cmc-surface-raised)',
    surfaceSunken: 'var(--cmc-surface-sunken)',
    hover: 'var(--cmc-hover)',
    borderSubtle: 'var(--cmc-border-subtle)',
    shadowSm: 'var(--cmc-shadow-sm)',
    shadowMd: 'var(--cmc-shadow-md)',
    shadowLg: 'var(--cmc-shadow-lg)',
    blurNav: 'var(--cmc-blur-nav)',
    ease: 'var(--cmc-ease)',
    transition: 'var(--cmc-transition)',
    fsLabel: 'var(--cmc-fs-label)',
    fsBody: 'var(--cmc-fs-body)',
    fsH3: 'var(--cmc-fs-h3)',
    fsMetric: 'var(--cmc-fs-metric)',
    lhBody: 'var(--cmc-lh-body)',
    padCard: 'var(--cmc-pad-card)',
    gapSection: 'var(--cmc-gap-section)',
    accentSoft: 'var(--cmc-accent-soft)',
  },
} as const;

export type Tokens = typeof tokens;

// Shared monochrome line-icon set (one icon language for shell + content).
export { LineIcon } from './components/line-icon.js';
export type { IconName } from './components/line-icon.js';

// Premium composites (promoted from the cockpit pilot — presentational,
// props-only; no session/tRPC coupling). MetricCard + TaskRow render
// react-router `Link`s (a declared peer) so they need a Router ancestor;
// AppFrame/SideNav below stay router-free via an onNavigate callback.
// Require `@cmc/ui/premium.css` imported once at the app root.
export type { Tone } from './components/tone.js';
export { MetricCard } from './components/metric-card.js';
export type { MetricCardProps } from './components/metric-card.js';
export { Panel } from './components/panel.js';
export type { PanelProps } from './components/panel.js';
export { TaskRow } from './components/task-row.js';
export type { TaskRowProps } from './components/task-row.js';
export { FunnelBar } from './components/funnel-bar.js';
export type { FunnelBarProps } from './components/funnel-bar.js';

// Astryx theme scope provider — see astryx-theme-cmc.css for token values.
export { AstryxCmcProvider } from './astryx-provider.js';
export type { AstryxCmcProviderProps } from './astryx-provider.js';

// Astryx primitive re-export barrel (the "single door" for apps — see
// primitives.ts). Lets apps import Text/Stack/Button/… from @cmc/ui instead
// of @astryxdesign/core directly, satisfying the one-door lint rule.
export * from './primitives.js';

// Auth-form input composites — fill Astryx gaps (typed input attrs +
// PasswordInput) required by the LMS login hardening spec. See auth-inputs.tsx.
export { TextField, PasswordInput } from './components/auth-inputs.js';
export type { TextFieldProps, PasswordInputProps } from './components/auth-inputs.js';

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

// App shell (promoted from apps/admin/src/shell — P3 shell extraction). DUMB —
// props-only, no router/session/tRPC coupling. Requires @cmc/ui/premium.css
// (.sh-* classes). LMS keeps its own lightweight mobile frame (YAGNI — see
// plans/260710-1730-premium-design-language-buildout/phase-03).
export type { NavEntry, NavModule } from './components/nav-types.js';
export { activeModuleId } from './lib/active-module.js';
export { SideNav } from './components/side-nav.js';
export type { SideNavProps } from './components/side-nav.js';
export { AppFrame } from './components/app-frame.js';
export type { AppFrameProps } from './components/app-frame.js';

// Page templates (P4 template extraction) — thin, slot-based list/detail/form
// page archetypes composing the atoms above. Props-only, no data fetching;
// pages own tRPC + business logic. Require @cmc/ui/premium.css (.tpl-*).
export { ListPage } from './components/list-page.js';
export type { ListPageProps } from './components/list-page.js';
export { DetailPage } from './components/detail-page.js';
export type { DetailPageProps } from './components/detail-page.js';
export { FormPage } from './components/form-page.js';
export type { FormPageProps } from './components/form-page.js';

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
    control: 'var(--cmc-radius-control)',
    card: 'var(--cmc-radius-card)',
    dialog: 'var(--cmc-radius-dialog)',
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
    shadowXs: 'var(--cmc-shadow-xs)',
    shadowSm: 'var(--cmc-shadow-sm)',
    shadowMd: 'var(--cmc-shadow-md)',
    shadowLg: 'var(--cmc-shadow-lg)',
    blurNav: 'var(--cmc-blur-nav)',
    ease: 'var(--cmc-ease)',
    transition: 'var(--cmc-transition)',
    focusHalo: 'var(--cmc-focus-halo)',
    fsLabel: 'var(--cmc-fs-label)',
    fsMeta: 'var(--cmc-fs-meta)',
    fsBody: 'var(--cmc-fs-body)',
    fsTitle: 'var(--cmc-fs-title)',
    fsH3: 'var(--cmc-fs-h3)',
    fsPage: 'var(--cmc-fs-page)',
    fsMetric: 'var(--cmc-fs-metric)',
    lhBody: 'var(--cmc-lh-body)',
    padCard: 'var(--cmc-pad-card)',
    padCardX: 'var(--cmc-pad-card-x)',
    gapCluster: 'var(--cmc-gap-cluster)',
    gapSection: 'var(--cmc-gap-section)',
    accentSoft: 'var(--cmc-accent-soft)',
    /* Structure system */
    rowH: 'var(--cmc-row-h)',
    headH: 'var(--cmc-head-h)',
    keylineX: 'var(--cmc-keyline-x)',
    raisedBg: 'var(--cmc-raised-bg)',
    chipHSm: 'var(--cmc-chip-h-sm)',
    ctaH: 'var(--cmc-cta-h)',
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
// TaskRowProps re-exported for WorkInbox consumers in apps
export { FunnelBar, funnelFillWidth } from './components/funnel-bar.js';
export type { FunnelBarProps } from './components/funnel-bar.js';
export { InsightMetric } from './components/insight-metric.js';
export type { InsightMetricProps } from './components/insight-metric.js';
export { FocusCard } from './components/focus-card.js';
export type { FocusCardProps } from './components/focus-card.js';

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

export { DateField } from './components/date-field.js';
export type { DateFieldProps } from './components/date-field.js';

export { MasterDetail } from './components/master-detail.js';
export type { MasterDetailProps } from './components/master-detail.js';

export { CmcTabs } from './components/cmc-tabs.js';
export type { CmcTabsProps, CmcTabDef } from './components/cmc-tabs.js';

export { ConfirmDialog } from './components/confirm-dialog.js';
export type { ConfirmDialogProps } from './components/confirm-dialog.js';

export { ToastProvider, useToast } from './components/toast.js';
export type { ToastInput, ToastItem, ToastTone } from './components/toast.js';

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

// Odoo admin UI layer (design3) — requires `@cmc/ui/odoo.css` + `.o_web_client` scope.
export { OdooNavbar } from './odoo/odoo-navbar.js';
export type { OdooNavbarProps } from './odoo/odoo-navbar.js';
export { KanbanBoard, KanbanColumn, KanbanCard } from './odoo/odoo-kanban.js';
export type {
  KanbanBoardProps,
  KanbanColumnProps,
  KanbanCardProps,
} from './odoo/odoo-kanban.js';

// Page templates (P4 template extraction) — thin, slot-based list/detail/form
// page archetypes composing the atoms above. Props-only, no data fetching;
// pages own tRPC + business logic. Require @cmc/ui/premium.css (.tpl-*).
export { ListPage } from './components/list-page.js';
export type { ListPageProps } from './components/list-page.js';
export { ControlBar } from './components/control-bar.js';
export type { ControlBarProps } from './components/control-bar.js';
export { DetailPage } from './components/detail-page.js';
export type { DetailPageProps } from './components/detail-page.js';
export { FormPage } from './components/form-page.js';
export type { FormPageProps } from './components/form-page.js';
export { DashboardPage } from './components/dashboard-page.js';
export type { DashboardPageProps } from './components/dashboard-page.js';
export { ShortcutChip } from './components/shortcut-chip.js';
export type { ShortcutChipProps } from './components/shortcut-chip.js';
export { WorkInbox } from './components/work-inbox.js';
export type { WorkInboxProps, WorkInboxSection } from './components/work-inbox.js';
export { StageFunnel } from './components/stage-funnel.js';
export type {
  StageFunnelProps,
  StageFunnelStage,
  StageFunnelLayout,
} from './components/stage-funnel.js';

// Completeness pack — detail / list / form / settings patterns
export { SectionBlock } from './components/section-block.js';
export type { SectionBlockProps } from './components/section-block.js';
export { KeyValueList } from './components/key-value-list.js';
export type { KeyValueListProps, KeyValueItem } from './components/key-value-list.js';
export { BulkActionBar } from './components/bulk-action-bar.js';
export type { BulkActionBarProps } from './components/bulk-action-bar.js';
export { ListPagination } from './components/list-pagination.js';
export type { ListPaginationProps } from './components/list-pagination.js';
export { ProgressSteps } from './components/progress-steps.js';
export type { ProgressStepsProps, ProgressStep } from './components/progress-steps.js';
export { SettingsSection, SettingsRow } from './components/settings-section.js';
export type {
  SettingsSectionProps,
  SettingsRowProps,
} from './components/settings-section.js';
export { EntityHeader } from './components/entity-header.js';
export type { EntityHeaderProps } from './components/entity-header.js';
export { HighlightStrip } from './components/highlight-strip.js';
export type { HighlightStripProps, HighlightItem } from './components/highlight-strip.js';
export { StatActions } from './components/stat-actions.js';
export type { StatActionsProps, StatActionItem } from './components/stat-actions.js';
export { WorkflowStatusbar } from './components/workflow-statusbar.js';
export type { WorkflowStatusbarProps } from './components/workflow-statusbar.js';
export { SettingsShell } from './components/settings-shell.js';
export type { SettingsShellProps, SettingsNavItem } from './components/settings-shell.js';
export { CommandPalette, useCommandPaletteHotkey } from './components/command-palette.js';
export type { CommandPaletteProps, CommandItem } from './components/command-palette.js';

// Xia port pack — patterns adapted from Shopify / GitHub / Cal / Airbnb DESIGN.md
export { Callout } from './components/callout.js';
export type { CalloutProps, CalloutTone } from './components/callout.js';
export { Avatar } from './components/avatar.js';
export type { AvatarProps } from './components/avatar.js';
export { MetaRow, MetaItem } from './components/meta-row.js';
export type { MetaRowProps, MetaItemProps } from './components/meta-row.js';
export { CountBadge } from './components/count-badge.js';
export type { CountBadgeProps } from './components/count-badge.js';
export { ActivityTimeline } from './components/activity-timeline.js';
export type { ActivityTimelineProps, ActivityItem } from './components/activity-timeline.js';

// Education schedule
export { SessionCard } from './components/session-card.js';
export type { SessionCardProps, SessionStatus } from './components/session-card.js';
export { WeekSchedule } from './components/week-schedule.js';
export type { WeekScheduleProps, WeekDayColumn } from './components/week-schedule.js';
export { ScheduleMonth, batchStatusToSession } from './components/schedule-month.js';
export type { ScheduleMonthProps, ScheduleMonthGroup } from './components/schedule-month.js';

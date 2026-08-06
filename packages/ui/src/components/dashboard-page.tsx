import type { ReactNode } from 'react';
import { Skeleton } from '@astryxdesign/core/Skeleton';

/**
 * Shared operational dashboard layout for role cockpits.
 * Same chrome for every role — only slot content differs (metrics / tasks / side).
 * Requires `@cmc/ui/odoo.css` (`.o-wrap`, `.o-dash-*`).
 */
export interface DashboardPageProps {
  /** Page title — typically "Tổng quan". */
  title: string;
  /** Subtitle — greeting / role label. */
  subtitle?: string;
  /** Optional quick-action chips (same pattern all roles). */
  shortcuts?: ReactNode;
  /** KPI strip — MetricCard grid. */
  metrics?: ReactNode;
  /** Primary column — usually "Việc cần bạn xử lý". */
  primary: ReactNode;
  /** Secondary column — pipeline, schedule, etc. */
  secondary?: ReactNode;
  /** Full-page loading skeleton. */
  loading?: boolean;
}

export function DashboardPage({
  title,
  subtitle,
  shortcuts,
  metrics,
  primary,
  secondary,
  loading,
}: DashboardPageProps) {
  if (loading) {
    return (
      <div className="o-wrap o-dash">
        <div className="o-dash-metrics">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={116} radius={1} />
          ))}
        </div>
        <Skeleton height={220} radius={1} />
      </div>
    );
  }

  return (
    <div className="o-wrap o-dash">
      <header className="o-dash-head">
        <h1 className="o-dash-title">{title}</h1>
        {subtitle ? <p className="o-dash-sub">{subtitle}</p> : null}
      </header>

      {shortcuts ? <div className="o-dash-shortcuts">{shortcuts}</div> : null}

      {metrics ? <div className="o-dash-metrics">{metrics}</div> : null}

      <div className="o-dash-body">
        <div className="o-dash-primary">{primary}</div>
        {secondary ? <div className="o-dash-secondary">{secondary}</div> : null}
      </div>
    </div>
  );
}

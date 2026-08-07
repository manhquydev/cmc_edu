import type { ReactNode } from 'react';
import { Skeleton } from '@astryxdesign/core/Skeleton';

/**
 * Shared operational dashboard layout for role cockpits.
 * Same chrome for every role — only slot content differs (metrics / tasks / side).
 * Requires `@cmc/ui/console.css` (`.console-wrap`, `.console-dash-*`).
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
      <div className="console-wrap console-dash">
        <div className="console-dash-metrics">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={116} radius={1} />
          ))}
        </div>
        <Skeleton height={220} radius={1} />
      </div>
    );
  }

  return (
    <div className="console-wrap console-dash">
      <header className="console-dash-head">
        <h1 className="console-dash-title">{title}</h1>
        {subtitle ? <p className="console-dash-sub">{subtitle}</p> : null}
      </header>

      {shortcuts ? <div className="console-dash-shortcuts">{shortcuts}</div> : null}

      {metrics ? <div className="console-dash-metrics">{metrics}</div> : null}

      <div className="console-dash-body">
        <div className="console-dash-primary">{primary}</div>
        {secondary ? <div className="console-dash-secondary">{secondary}</div> : null}
      </div>
    </div>
  );
}

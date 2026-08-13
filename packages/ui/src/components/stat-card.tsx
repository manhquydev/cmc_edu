import { Skeleton } from '@astryxdesign/core/Skeleton';

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  loading?: boolean;
}

/** Non-link KPI tile. MetricCard keeps `Link.console-mc`; this uses `--static`. */
export function StatCard({ label, value, trend, loading = false }: StatCardProps) {
  return (
    <div className="console-mc console-mc--static">
      <div className="console-mc-top">
        <span className="console-mc-label">{label}</span>
      </div>
      {loading ? (
        <Skeleton height={32} width="46%" radius={0} />
      ) : (
        <div className="console-mc-value">{value}</div>
      )}
      {trend ? <div className="console-mc-ctx">{trend}</div> : null}
    </div>
  );
}

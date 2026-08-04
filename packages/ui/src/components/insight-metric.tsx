import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { LineIcon, type IconName } from './line-icon.js';

/**
 * Modern KPI tile — not 2019 “big number on flat card” only.
 * Optional spark bars + delta pill + soft icon wash.
 * Requires @cmc/ui/premium.css (.ck-im*).
 */
export interface InsightMetricProps {
  label: string;
  value: ReactNode;
  /** e.g. "+12%" or "−3 so với tuần trước" */
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral';
  context?: string;
  href?: string;
  icon?: IconName;
  /** 4–8 values 0..1 for mini spark bars. */
  spark?: number[];
  loading?: boolean;
}

export function InsightMetric({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  context,
  href,
  icon,
  spark,
  loading,
}: InsightMetricProps) {
  const body = (
    <>
      <div className="ck-im-top">
        <span className="ck-im-label">{label}</span>
        {icon ? (
          <span className="ck-im-icon" aria-hidden>
            <LineIcon name={icon} size={18} />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton height={30} width="48%" radius={0} />
      ) : (
        <div className="ck-im-value-row">
          <div className="ck-im-value">{value}</div>
          {delta ? (
            <span className={`ck-im-delta is-${deltaTone}`}>{delta}</span>
          ) : null}
        </div>
      )}
      {spark && spark.length > 0 && !loading ? (
        <div className="ck-im-spark" aria-hidden>
          {spark.map((v, i) => (
            <span
              key={i}
              className="ck-im-spark-bar"
              style={{ height: `${Math.max(12, Math.min(100, v * 100))}%` }}
            />
          ))}
        </div>
      ) : null}
      {context ? (
        <div className="ck-im-ctx">
          {context}
          {href ? <LineIcon name="chevron" size={13} /> : null}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link to={href} className="ck-im">
        {body}
      </Link>
    );
  }
  return <div className="ck-im">{body}</div>;
}

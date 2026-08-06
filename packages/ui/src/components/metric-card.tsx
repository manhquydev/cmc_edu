import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { LineIcon, type IconName } from './line-icon.js';
import { toneColor, type Tone } from './tone.js';

// Premium dashboard metric card (promoted from the cockpit pilot). DUMB —
// props-only, no data fetching. Locked invariants: value renders near-black
// (never tinted by status); urgency is a small `attention` DOT, not a
// recoloured number; icon is a monochrome LineIcon; flat surface at rest.
// Requires @cmc/ui/odoo.css (.o-mc* classes).
export interface MetricCardProps {
  label: string;
  value: ReactNode;
  context: string;
  icon: IconName;
  href: string;
  /** Optional status accent — renders a small dot next to the label only. */
  attention?: Tone;
  loading?: boolean;
}

export function MetricCard({ label, value, context, icon, href, attention, loading }: MetricCardProps) {
  return (
    <Link to={href} className="o-mc">
      <div className="o-mc-top">
        <span className="o-mc-label">
          {attention && <span className="o-attn" style={{ background: toneColor(attention) }} />}
          {label}
        </span>
        <span className="o-mc-icon"><LineIcon name={icon} size={19} /></span>
      </div>
      {loading
        ? <Skeleton height={32} width="46%" radius={0} />
        : <div className="o-mc-value">{value}</div>}
      <div className="o-mc-ctx">{context}<LineIcon name="chevron" size={13} /></div>
    </Link>
  );
}

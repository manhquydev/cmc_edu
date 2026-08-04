import { Badge } from '@astryxdesign/core/Badge';
import type { ComponentProps } from 'react';

type Status = string;
type AstryxBadgeVariant = ComponentProps<typeof Badge>['variant'];

// TL12 §3 color semantics: success/warning/error carry meaning, everything
// else is a plain category color. Astryx has no 'gray' variant — 'neutral'
// is its equivalent.
const STATUS_VARIANTS: Record<string, AstryxBadgeVariant> = {
  active: 'success',
  approved: 'success',
  sent: 'teal',
  pending: 'warning',
  draft: 'neutral',
  rejected: 'error',
  error: 'error',
  cancelled: 'error',
  disabled: 'neutral',
  withdrawn: 'orange',
  warning: 'warning',
};

/** Soft pastel appearance (Polaris/Primer dense tables) — preferred for ops lists. */
type SoftTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_SOFT: Record<string, SoftTone> = {
  active: 'success',
  approved: 'success',
  sent: 'info',
  pending: 'warning',
  draft: 'neutral',
  rejected: 'danger',
  error: 'danger',
  cancelled: 'danger',
  disabled: 'neutral',
  withdrawn: 'warning',
  warning: 'warning',
};

export interface StatusBadgeProps {
  status: Status;
  label?: string;
  /** Astryx's Badge has no native size axis — 'lg' is CSS scale for detail headers. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * `soft` — pastel chips for dense tables (default, modern ops).
   * `solid` — Astryx filled badge (legacy emphasis).
   */
  appearance?: 'soft' | 'solid';
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  appearance = 'soft',
}: StatusBadgeProps) {
  const text = label ?? status;

  if (appearance === 'soft') {
    const tone = STATUS_SOFT[status] ?? 'info';
    const el = (
      <span className={`ck-badge-soft ck-badge-soft--${tone}`}>{text}</span>
    );
    if (size === 'lg') {
      return <span style={{ display: 'inline-block', fontSize: '1.15em' }}>{el}</span>;
    }
    if (size === 'sm') {
      return <span style={{ display: 'inline-block', fontSize: '0.9em' }}>{el}</span>;
    }
    return el;
  }

  const variant = STATUS_VARIANTS[status] ?? 'blue';
  const badge = <Badge label={text} variant={variant} />;
  if (size === 'lg') {
    return <span style={{ display: 'inline-block', fontSize: '1.15em' }}>{badge}</span>;
  }
  return badge;
}

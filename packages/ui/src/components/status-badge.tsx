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

export interface StatusBadgeProps {
  status: Status;
  label?: string;
  /** Astryx's Badge has no native size axis (checked: only variant/label/icon
   * props exist) — 'lg' is approximated with a CSS scale on the 2 call
   * sites (detail-page headers) that use it today. */
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? 'blue';
  const badge = <Badge label={label ?? status} variant={variant} />;
  if (size === 'lg') {
    return <span style={{ display: 'inline-block', fontSize: '1.15em' }}>{badge}</span>;
  }
  return badge;
}

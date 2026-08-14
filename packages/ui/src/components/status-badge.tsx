type Status = string;

/**
 * OpenEduCat list capsule tones (solid fill + white text under `.o_web_client`).
 * `brand` = waiting on the system (not a success/failure state).
 */
export type SoftTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const STATUS_SOFT: Record<string, SoftTone> = {
  active: 'success',
  approved: 'success',
  confirmed: 'success',
  done: 'success',
  completed: 'success',
  enrolled: 'success',
  published: 'success',
  sent: 'info',
  pending: 'warning',
  draft: 'neutral',
  rejected: 'danger',
  error: 'danger',
  cancelled: 'danger',
  disabled: 'neutral',
  withdrawn: 'warning',
  warning: 'warning',
  waiting: 'brand',
  queued: 'brand',
  processing: 'brand',
};

export interface StatusBadgeProps {
  status: Status;
  label?: string;
  /** Override the status→tone map when the caller already knows the tone. */
  tone?: SoftTone;
  /** Size axis is CSS (`.console-badge-soft--sm/--lg`). Default md is the unscoped chip. */
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, label, tone, size = 'md' }: StatusBadgeProps) {
  const text = label ?? status;
  const resolved = tone ?? STATUS_SOFT[status] ?? 'info';
  const sizeClass = size === 'md' ? '' : ` console-badge-soft--${size}`;
  return (
    <span className={`console-badge-soft console-badge-soft--${resolved}${sizeClass}`}>{text}</span>
  );
}

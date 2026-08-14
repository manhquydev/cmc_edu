type Status = string;

/** OpenEduCat list capsule (solid fill + white text under `.o_web_client`). */
type SoftTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

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
};

export interface StatusBadgeProps {
  status: Status;
  label?: string;
  /** Size axis is CSS (`.console-badge-soft--sm/--lg`). Default md is the unscoped chip. */
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const text = label ?? status;
  const tone = STATUS_SOFT[status] ?? 'info';
  const sizeClass = size === 'md' ? '' : ` console-badge-soft--${size}`;
  return (
    <span className={`console-badge-soft console-badge-soft--${tone}${sizeClass}`}>{text}</span>
  );
}

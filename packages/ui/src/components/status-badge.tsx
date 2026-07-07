import { Badge } from '@mantine/core';
import type { BadgeProps } from '@mantine/core';

type Status = string;

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  approved: 'green',
  sent: 'teal',
  pending: 'yellow',
  draft: 'gray',
  rejected: 'red',
  error: 'red',
  cancelled: 'red',
  disabled: 'gray',
  withdrawn: 'orange',
  warning: 'orange',
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  status: Status;
  label?: string;
}

export function StatusBadge({ status, label, ...rest }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? 'blue';
  return (
    <Badge color={color} variant="light" {...rest}>
      {label ?? status}
    </Badge>
  );
}

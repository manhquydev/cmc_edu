import { EmptyState as AstryxEmptyState } from '@astryxdesign/core/EmptyState';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  /**
   * `ops` — dense list/table empty (`.console-empty-ops`).
   * Default keeps Astryx size so 403/404/permission-gate are not squeezed.
   */
  density?: 'default' | 'ops';
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  density = 'default',
}: EmptyStateProps) {
  return (
    <div className={density === 'ops' ? 'console-empty-ops' : undefined}>
      <AstryxEmptyState title={title} description={description} icon={icon} actions={action} />
    </div>
  );
}

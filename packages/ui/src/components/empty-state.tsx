import { EmptyState as AstryxEmptyState } from '@astryxdesign/core/EmptyState';
import type { ReactNode } from 'react';

/**
 * Why a list is empty changes what the operator should do next, so it changes
 * what we say. Three stories, never collapsed into "Không có dữ liệu":
 *
 * - `first-run` — nothing has ever been created here. Offer the first action.
 * - `filtered`  — records exist but the filter excludes them. Offer a way out.
 * - `done`      — the queue was worked to zero. Point at the next queue.
 *
 * `error` stays separate because it is a failure, not an absence.
 */
export type EmptyStateKind = 'first-run' | 'filtered' | 'done' | 'error';

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
  /** Which story this is. Surfaces as `data-empty-kind` for styling and tests. */
  kind?: EmptyStateKind;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  density = 'default',
  kind,
}: EmptyStateProps) {
  return (
    <div
      className={density === 'ops' ? 'console-empty-ops' : undefined}
      data-empty-kind={kind}
    >
      <AstryxEmptyState title={title} description={description} icon={icon} actions={action} />
    </div>
  );
}

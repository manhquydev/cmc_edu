import { EmptyState as AstryxEmptyState } from '@astryxdesign/core/EmptyState';
import type { ReactNode } from 'react';
import { LineIcon } from './line-icon.js';
import type { IconName } from './line-icon.js';

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

const DEFAULT_ICON_NAMES: Record<EmptyStateKind, IconName> = {
  'first-run': 'plus',
  filtered: 'search',
  done: 'check-circle',
  error: 'alert',
};

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
  const resolvedIcon =
    icon !== undefined ? icon : kind ? <LineIcon name={DEFAULT_ICON_NAMES[kind]} /> : undefined;

  return (
    <div
      className={density === 'ops' ? 'console-empty-ops' : undefined}
      data-empty-kind={kind}
    >
      <AstryxEmptyState
        title={title}
        description={description}
        icon={resolvedIcon}
        actions={action}
      />
    </div>
  );
}

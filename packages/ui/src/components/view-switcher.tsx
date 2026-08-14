import type { IconName } from './line-icon.js';
import { LineIcon } from './line-icon.js';

export interface ViewSwitcherItem<T extends string = string> {
  id: T;
  label: string;
  icon: IconName;
}

export interface ViewSwitcherProps<T extends string = string> {
  value: T;
  onChange: (id: T) => void;
  items: ViewSwitcherItem<T>[];
  /** Accessible name for the toolbar. */
  'aria-label'?: string;
}

/**
 * Odoo-style view icons (list / kanban / calendar / …).
 * Active = gray fill, not brand purple. Native `title` is the tooltip.
 */
export function ViewSwitcher<T extends string>({
  value,
  onChange,
  items,
  'aria-label': ariaLabel = 'Chế độ xem',
}: ViewSwitcherProps<T>) {
  return (
    <div className="console-view-switcher" role="toolbar" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            className={active ? 'is-active' : undefined}
            onClick={() => onChange(item.id)}
          >
            <LineIcon name={item.icon} size={15} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

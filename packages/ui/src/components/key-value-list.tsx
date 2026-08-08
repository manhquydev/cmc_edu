import type { ReactNode } from 'react';

export interface KeyValueItem {
  key: string;
  label: string;
  value: ReactNode;
  /** Span full width on 2-col grids. */
  fullWidth?: boolean;
}

/**
 * Detail description list — modern key/value grid for entity pages.
 * Not a 2010 definition list dump: aligned labels, tabular values.
 * Requires @cmc/ui/console.css (.console-kv*).
 */
export interface KeyValueListProps {
  items: KeyValueItem[];
  /** 1 = stacked, 2 = responsive two-column. */
  columns?: 1 | 2;
}

export function KeyValueList({ items, columns = 2 }: KeyValueListProps) {
  return (
    <dl
      className={columns === 2 ? 'console-kv console-kv--2' : 'console-kv'}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={item.fullWidth ? 'console-kv-row console-kv-row--full' : 'console-kv-row'}
        >
          <dt className="console-kv-label">{item.label}</dt>
          <dd className="console-kv-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

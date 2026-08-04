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
 * Requires @cmc/ui/premium.css (.ck-kv*).
 */
export interface KeyValueListProps {
  items: KeyValueItem[];
  /** 1 = stacked, 2 = responsive two-column. */
  columns?: 1 | 2;
}

export function KeyValueList({ items, columns = 2 }: KeyValueListProps) {
  return (
    <dl
      className={columns === 2 ? 'ck-kv ck-kv--2' : 'ck-kv'}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={item.fullWidth ? 'ck-kv-row ck-kv-row--full' : 'ck-kv-row'}
        >
          <dt className="ck-kv-label">{item.label}</dt>
          <dd className="ck-kv-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

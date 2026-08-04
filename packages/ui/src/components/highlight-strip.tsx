import type { ReactNode } from 'react';

export interface HighlightItem {
  key: string;
  label: string;
  value: ReactNode;
  /** Tabular nums for money/dates. */
  tabular?: boolean;
}

/**
 * Lightning-style highlight panel — 3–4 key fields under EntityHeader.
 * Requires @cmc/ui/premium.css (.ck-highlight*).
 */
export interface HighlightStripProps {
  items: HighlightItem[];
  className?: string;
}

export function HighlightStrip({ items, className }: HighlightStripProps) {
  if (items.length === 0) return null;
  const cls = className ? `ck-highlight ${className}` : 'ck-highlight';
  return (
    <div className={cls} role="group" aria-label="Thông tin nổi bật">
      {items.map((item) => (
        <div key={item.key} className="ck-highlight-item">
          <div className="ck-highlight-label">{item.label}</div>
          <div
            className={
              item.tabular ? 'ck-highlight-value ck-highlight-value--tabular' : 'ck-highlight-value'
            }
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

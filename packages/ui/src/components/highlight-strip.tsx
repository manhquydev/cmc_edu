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
 * Requires @cmc/ui/console.css (.console-highlight*).
 */
export interface HighlightStripProps {
  items: HighlightItem[];
  className?: string;
}

export function HighlightStrip({ items, className }: HighlightStripProps) {
  if (items.length === 0) return null;
  const cls = className ? `console-highlight ${className}` : 'console-highlight';
  return (
    <div className={cls} role="group" aria-label="Thông tin nổi bật">
      {items.map((item) => (
        <div key={item.key} className="console-highlight-item">
          <div className="console-highlight-label">{item.label}</div>
          <div
            className={
              item.tabular ? 'console-highlight-value console-highlight-value--tabular' : 'console-highlight-value'
            }
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

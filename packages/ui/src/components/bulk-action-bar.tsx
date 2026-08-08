import type { ReactNode } from 'react';

/**
 * Sticky selection toolbar for ops tables — appears when selectionCount > 0.
 * Pattern: Stripe/Linear bulk bar, not a second PageHeader.
 * Requires @cmc/ui/console.css (.console-bulk*).
 */
export interface BulkActionBarProps {
  selectionCount: number;
  /** e.g. "đã chọn" */
  label?: string;
  onClear?: () => void;
  children: ReactNode;
}

export function BulkActionBar({
  selectionCount,
  label = 'đã chọn',
  onClear,
  children,
}: BulkActionBarProps) {
  if (selectionCount <= 0) return null;
  return (
    <div className="console-bulk" role="toolbar" aria-label="Thao tác hàng loạt">
      <div className="console-bulk-meta">
        <span className="console-bulk-count">{selectionCount}</span>
        <span className="console-bulk-label">{label}</span>
        {onClear ? (
          <button type="button" className="console-bulk-clear" onClick={onClear}>
            Bỏ chọn
          </button>
        ) : null}
      </div>
      <div className="console-bulk-actions">{children}</div>
    </div>
  );
}

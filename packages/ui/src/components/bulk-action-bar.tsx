import type { ReactNode } from 'react';

/**
 * Sticky selection toolbar for ops tables — appears when selectionCount > 0.
 * Pattern: Stripe/Linear bulk bar, not a second PageHeader.
 * Requires @cmc/ui/premium.css (.ck-bulk*).
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
    <div className="ck-bulk" role="toolbar" aria-label="Thao tác hàng loạt">
      <div className="ck-bulk-meta">
        <span className="ck-bulk-count">{selectionCount}</span>
        <span className="ck-bulk-label">{label}</span>
        {onClear ? (
          <button type="button" className="ck-bulk-clear" onClick={onClear}>
            Bỏ chọn
          </button>
        ) : null}
      </div>
      <div className="ck-bulk-actions">{children}</div>
    </div>
  );
}

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
  /**
   * Total rows matching the current filter, across every page. Selecting the
   * header checkbox only ever selects the visible page, so when the page is
   * fully selected and more rows match, the bar must say so and offer the wider
   * selection explicitly. Acting on 312 rows when the operator believed they
   * picked 20 is the failure this prevents.
   */
  totalMatching?: number;
  /** Rows on the current page, used to detect "page fully selected". */
  pageSize?: number;
  onSelectAllMatching?: () => void;
}

export function BulkActionBar({
  selectionCount,
  label = 'đã chọn',
  onClear,
  children,
  totalMatching,
  pageSize,
  onSelectAllMatching,
}: BulkActionBarProps) {
  if (selectionCount <= 0) return null;
  const pageFullySelected = pageSize != null && selectionCount >= pageSize;
  const moreMatch = totalMatching != null && totalMatching > selectionCount;
  const offerWider = pageFullySelected && moreMatch && onSelectAllMatching != null;
  const allMatchingSelected = totalMatching != null && selectionCount >= totalMatching;
  return (
    <div className="console-bulk" role="toolbar" aria-label="Thao tác hàng loạt">
      <div className="console-bulk-meta">
        <span className="console-bulk-count">{selectionCount}</span>
        <span className="console-bulk-label">{label}</span>
        {offerWider ? (
          <span className="console-bulk-scope">
            Chỉ các dòng của trang này.{' '}
            <button type="button" className="console-bulk-widen" onClick={onSelectAllMatching}>
              Chọn tất cả {totalMatching} dòng khớp bộ lọc
            </button>
          </span>
        ) : null}
        {allMatchingSelected && totalMatching != null && totalMatching > 0 ? (
          <span className="console-bulk-scope">Toàn bộ {totalMatching} dòng khớp bộ lọc.</span>
        ) : null}
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

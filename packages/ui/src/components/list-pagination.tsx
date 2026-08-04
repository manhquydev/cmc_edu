/**
 * Compact table footer pagination — page size + range + prev/next.
 * Presentational; parent owns page state (URL or local).
 * Requires @cmc/ui/premium.css (.ck-page*).
 */
export interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional page-size options; omit to hide selector. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  return (
    <div className="ck-page" role="navigation" aria-label="Phân trang">
      <div className="ck-page-range">
        {total === 0 ? (
          <span>Không có dòng</span>
        ) : (
          <span>
            <strong>
              {from}–{to}
            </strong>{' '}
            / {total}
          </span>
        )}
      </div>
      {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange ? (
        <label className="ck-page-size">
          <span>Mỗi trang</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Số dòng mỗi trang"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="ck-page-nav">
        <button
          type="button"
          className="ck-page-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Trang trước"
        >
          ‹
        </button>
        <span className="ck-page-indicator" aria-current="page">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="ck-page-btn"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}

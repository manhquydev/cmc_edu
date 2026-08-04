// Funnel / proportional stage bar — ops-dense but modern (not 2018 pill-only).
// Structure: optional step chip · label head · track with soft fill · count · share.
// Wrap siblings in `.ck-fn`. Requires @cmc/ui/premium.css (.ck-fn* classes).

export interface FunnelBarProps {
  label: string;
  value: number;
  max: number;
  /** Dim zero stages (structure still visible). */
  muted?: boolean;
  /** Highlight action stage (e.g. O4 ready). */
  emphasize?: boolean;
  /** Chevron when row is navigable. */
  showChevron?: boolean;
  /** Stage index chip (1-based or code like "O4"). */
  step?: number | string;
  /** Secondary share of max (e.g. 38%). */
  showShare?: boolean;
  /** Density. Default md. */
  size?: 'sm' | 'md';
  /** Quiet context under label (e.g. "tăng 2 tuần này"). */
  hint?: string;
}

function sharePct(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.round((value / max) * 100);
}

/** Width floor so nonzero stays visible; zero stays 0%. */
export function funnelFillWidth(value: number, max: number): number {
  if (value === 0) return 0;
  return Math.max(6, (value / Math.max(1, max)) * 100);
}

export function FunnelBar({
  label,
  value,
  max,
  muted = false,
  emphasize = false,
  showChevron = false,
  step,
  showShare = false,
  size = 'md',
  hint,
}: FunnelBarProps) {
  const width = funnelFillWidth(value, max);
  const share = sharePct(value, max);
  const cls = [
    'ck-fn-row',
    size === 'sm' ? 'is-sm' : '',
    muted ? 'is-muted' : '',
    emphasize ? 'is-emphasize' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      role="group"
      aria-label={`${label}: ${value}${showShare ? ` (${share}%)` : ''}`}
    >
      {step != null && step !== '' ? (
        <span className="ck-fn-step" aria-hidden>
          {step}
        </span>
      ) : null}
      <div className="ck-fn-main">
        <div className="ck-fn-head">
          <span className="ck-fn-label">{label}</span>
          {hint ? <span className="ck-fn-hint">{hint}</span> : null}
        </div>
        <div className="ck-fn-barline">
          <span className="ck-fn-track">
            <span className="ck-fn-fill" style={{ width: `${width}%` }} />
          </span>
          <span className="ck-fn-count">{value}</span>
          {showShare ? <span className="ck-fn-share">{share}%</span> : null}
          {showChevron ? (
            <span className="ck-fn-chev" aria-hidden>
              ›
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

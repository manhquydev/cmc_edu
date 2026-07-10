// A single funnel/proportional bar row (promoted from the cockpit pilot). One
// solid accent fill, width proportional to value/max (0 → 0%, a small floor for
// any nonzero so it stays visible). Count rendered near-black. Wrap siblings in
// a `.ck-fn` container. Requires @cmc/ui/premium.css (.ck-fn* classes).
export interface FunnelBarProps {
  label: string;
  value: number;
  max: number;
}

export function FunnelBar({ label, value, max }: FunnelBarProps) {
  const pct = value === 0 ? 0 : Math.max(5, (value / Math.max(1, max)) * 100);
  return (
    <div className="ck-fn-row">
      <span className="ck-fn-label">{label}</span>
      <span className="ck-fn-track">
        <span className="ck-fn-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="ck-fn-count">{value}</span>
    </div>
  );
}

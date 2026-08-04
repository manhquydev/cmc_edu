/**
 * Compact counter — GitHub tab/nav count chip.
 * Requires @cmc/ui/premium.css (.ck-count).
 */
export interface CountBadgeProps {
  count: number;
  /** Hide when zero (default true). */
  hideZero?: boolean;
  /** Emphasize nonzero (brand wash). */
  emphasize?: boolean;
}

export function CountBadge({ count, hideZero = true, emphasize = false }: CountBadgeProps) {
  if (hideZero && count <= 0) return null;
  const cls = emphasize && count > 0 ? 'ck-count is-emphasize' : 'ck-count';
  return (
    <span className={cls} aria-label={`${count}`}>
      {count > 999 ? '999+' : count}
    </span>
  );
}

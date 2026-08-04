import type { ReactNode } from 'react';

export interface MetaItemProps {
  /** Optional colored status/language dot (GitHub Primer). */
  dot?: string;
  children: ReactNode;
}

/** Single meta fragment: optional dot + text. */
export function MetaItem({ dot, children }: MetaItemProps) {
  return (
    <span className="ck-meta-item">
      {dot ? (
        <span className="ck-meta-dot" style={{ background: dot }} aria-hidden />
      ) : null}
      <span className="ck-meta-text">{children}</span>
    </span>
  );
}

/**
 * Dense metadata row — GitHub repo card / PR meta pattern.
 * Requires @cmc/ui/premium.css (.ck-meta*).
 */
export interface MetaRowProps {
  children: ReactNode;
}

export function MetaRow({ children }: MetaRowProps) {
  return <div className="ck-meta-row">{children}</div>;
}

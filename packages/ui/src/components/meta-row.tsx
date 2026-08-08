import type { ReactNode } from 'react';

export interface MetaItemProps {
  /** Optional colored status/language dot (GitHub Primer). */
  dot?: string;
  children: ReactNode;
}

/** Single meta fragment: optional dot + text. */
export function MetaItem({ dot, children }: MetaItemProps) {
  return (
    <span className="console-meta-item">
      {dot ? (
        <span className="console-meta-dot" style={{ background: dot }} aria-hidden />
      ) : null}
      <span className="console-meta-text">{children}</span>
    </span>
  );
}

/**
 * Dense metadata row — GitHub repo card / PR meta pattern.
 * Requires @cmc/ui/console.css (.console-meta*).
 */
export interface MetaRowProps {
  children: ReactNode;
}

export function MetaRow({ children }: MetaRowProps) {
  return <div className="console-meta-row">{children}</div>;
}

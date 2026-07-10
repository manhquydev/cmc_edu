// Scopes descendants into the Astryx theme-neutral CSS variant, so
// theme-neutral's token defaults (typography scale, disabled-state opacity,
// etc.) apply in addition to the CMC brand overrides in
// astryx-theme-cmc.css. CSS-only theming (no defineTheme()/Theme JS object
// needed) — confirmed sufficient in the Phase 1 spike gate; see
// astryx-theme-cmc.css for the actual token values.
import type { ReactNode } from 'react';

export interface AstryxCmcProviderProps {
  children: ReactNode;
}

export function AstryxCmcProvider({ children }: AstryxCmcProviderProps) {
  return (
    <div data-astryx-theme="neutral" style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}

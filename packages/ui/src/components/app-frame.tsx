import type { ReactNode } from 'react';

// Warm-canvas application frame: sidebar slot + blurred sticky topbar + content
// (promoted from apps/admin/src/shell/shell.tsx — P3 shell extraction). DUMB —
// props-only, no router/session/tRPC coupling; `nav` is typically a `<SideNav>`
// but any element works. Requires @cmc/ui/console.css (.sh-* classes).
export interface AppFrameProps {
  /** Sidebar content — typically `<SideNav ... />`. */
  nav: ReactNode;
  topbarTitle: ReactNode;
  topbarActions?: ReactNode;
  children: ReactNode;
}

export function AppFrame({ nav, topbarTitle, topbarActions, children }: AppFrameProps) {
  return (
    <div className="sh-root">
      {nav}

      <div className="sh-main">
        <header className="sh-top">
          <span className="sh-top-title">{topbarTitle}</span>
          <div className="sh-top-actions">{topbarActions}</div>
        </header>

        <div className="sh-content">{children}</div>
      </div>
    </div>
  );
}

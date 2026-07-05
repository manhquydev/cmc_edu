// Empty admin shell (US-001 AC). Renders a minimal frame styled entirely from
// @cmc/ui design tokens. Real navigation and routes arrive with feature stories.

import { tokens } from '@cmc/ui';

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__brand">CMC EDU</span>
        <span className="app-shell__tag">Admin</span>
      </header>
      <main className="app-shell__body">
        <p style={{ color: tokens.color.textMuted }}>
          Khung quản trị sẵn sàng. Chức năng nghiệp vụ sẽ được bổ sung theo từng story.
        </p>
      </main>
    </div>
  );
}

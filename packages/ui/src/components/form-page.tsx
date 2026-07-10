import type { ReactNode } from 'react';

export interface FormPageProps {
  /** Page header slot — typically a `<PageHeader>`. */
  header: ReactNode;
  /** Form field region. */
  children: ReactNode;
  /**
   * Action bar content — typically a single pill-styled primary `<Button>`
   * (apply the `.fp-action` class from premium.css, or reuse `.sh-cta`) plus
   * an optional secondary/cancel action.
   */
  actions: ReactNode;
  /** Optional result slot — typically a `<ResultPanel>` shown after submit. */
  result?: ReactNode;
}

// Thin premium form-page archetype (P4 template extraction): warm-canvas
// wrapper + header slot + field region + a sticky action bar + optional
// result slot. Composes existing @cmc/ui atoms — props-only, no form
// state/validation (pages own that). Requires @cmc/ui/premium.css (.tpl-*,
// .fp-action).
export function FormPage({ header, children, actions, result }: FormPageProps) {
  return (
    <div className="tpl-wrap">
      {header}
      <div className="tpl-form-body">{children}</div>
      {result}
      <div className="tpl-actions">{actions}</div>
    </div>
  );
}

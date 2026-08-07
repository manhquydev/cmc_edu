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

// Form-page archetype: canvas wrap + header + Odoo-like form sheet + sticky
// action bar + optional result. Props-only (pages own form state). Requires
// @cmc/ui/console.css (.console-wrap, .console-form-sheet*, .console-form-body, .console-actions).
export function FormPage({ header, children, actions, result }: FormPageProps) {
  return (
    <div className="console-wrap">
      {header}
      <div className="console-form-sheet-bg">
        <div className="console-form-sheet">
          <div className="console-form-body">{children}</div>
        </div>
      </div>
      {result}
      <div className="console-actions">{actions}</div>
    </div>
  );
}

// @cmc/ui — design system entrypoint (TL12).
//
// Ships the design tokens as a typed object mirroring `tokens.css` so TS
// consumers get autocompletion and non-CSS surfaces (charts, canvas) can read
// the same values. Import `@cmc/ui/tokens.css` once at the app root to register
// the CSS custom properties.

export const tokens = {
  color: {
    brand: 'var(--cmc-brand)',
    brandHover: 'var(--cmc-brand-hover)',
    brandMuted: 'var(--cmc-brand-muted)',
    brandInk: 'var(--cmc-brand-ink)',
    text: 'var(--cmc-text)',
    text2: 'var(--cmc-text-2)',
    textMuted: 'var(--cmc-text-muted)',
    textFaint: 'var(--cmc-text-faint)',
    surface: 'var(--cmc-surface)',
    surface2: 'var(--cmc-surface-2)',
    border: 'var(--cmc-border)',
    success: 'var(--cmc-success)',
    warning: 'var(--cmc-warning)',
    danger: 'var(--cmc-danger)',
  },
  radius: {
    xs: 'var(--cmc-radius-xs)',
  },
  space: {
    1: 'var(--cmc-space-1)',
    2: 'var(--cmc-space-2)',
    3: 'var(--cmc-space-3)',
    4: 'var(--cmc-space-4)',
  },
  font: {
    sans: 'var(--cmc-font-sans)',
    sizeData: 'var(--cmc-font-size-data)',
    sizeColumn: 'var(--cmc-font-size-column)',
  },
} as const;

export type Tokens = typeof tokens;

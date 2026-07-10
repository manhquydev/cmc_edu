// Status tone → CSS var. Tone drives only a small indicator (a dot), never the
// recolouring of a value or body text (locked design principle: one accent,
// near-black numerals). Neutral falls back to the faint ink used for resting UI.
export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_VAR: Record<Tone, string> = {
  brand: 'var(--cmc-brand)',
  success: 'var(--cmc-success)',
  warning: 'var(--cmc-warning)',
  danger: 'var(--cmc-danger)',
  neutral: 'var(--cmc-text-faint)',
};

export function toneColor(tone: Tone): string {
  return TONE_VAR[tone];
}

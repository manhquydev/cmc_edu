/**
 * Configuration references stay text. Work records hop; these keys do not.
 * Extend only with an explicit decision — not a feature flag.
 */
export const NO_OPEN_FIELDS = ['program', 'room', 'classroom', 'course'] as const;

export type NoOpenField = (typeof NO_OPEN_FIELDS)[number];

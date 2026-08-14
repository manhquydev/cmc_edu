import type { Tone } from './tone.js';

export type DueLevel = 'late' | 'today' | 'future';

/** CSS class for a due-level chip. Classification lives in `@cmc/domain-time`. */
export function dueLevelClassName(level: DueLevel): string {
  switch (level) {
    case 'late':
      return 'cmc-due-late';
    case 'today':
      return 'cmc-due-today';
    case 'future':
      return 'cmc-due-future';
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

/** WorkInbox / TaskRow tone mapped from a due level. */
export function dueLevelTone(level: DueLevel): Tone {
  switch (level) {
    case 'late':
      return 'danger';
    case 'today':
      return 'warning';
    case 'future':
      return 'brand';
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export type LmsSessionKind = 'parent' | 'student' | 'family';

export function isParentDoorKind(kind: string | undefined): kind is 'parent' | 'family' {
  return kind === 'parent' || kind === 'family';
}

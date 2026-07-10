import { describe, expect, it } from 'vitest';
import { activeModuleId } from './active-module.js';
import type { NavModule } from '../components/nav-types.js';

const modules: NavModule[] = [
  { id: 'cockpit', label: 'Cockpit', icon: 'grid', path: '/cockpit' },
  {
    id: 'finance-ops',
    label: 'Finance',
    icon: 'dollar',
    path: '/finance',
    children: [
      { id: 'receipts', label: 'Receipts', path: '/finance', icon: 'receipt' },
    ],
  },
  // Mirrors real nav-registry data: '/admin' (module) is a strict path prefix
  // of '/admin/students' (a DIFFERENT module's own path) — exercises the
  // longest-match-across-modules branch, not just module-vs-own-child.
  { id: 'admin', label: 'Admin', icon: 'shield', path: '/admin' },
  { id: 'classes-students', label: 'Classes', icon: 'users', path: '/admin/students' },
];

describe('activeModuleId', () => {
  it('matches an exact module path', () => {
    expect(activeModuleId('/cockpit', modules)).toBe('cockpit');
  });

  it('matches a prefix path (module active for a nested route)', () => {
    expect(activeModuleId('/finance/123', modules)).toBe('finance-ops');
  });

  it('picks the longest match when a shorter module path and a longer, more specific module path both match', () => {
    expect(activeModuleId('/admin/students/5', modules)).toBe('classes-students');
    // Still resolves the short module when the longer sibling path doesn't apply.
    expect(activeModuleId('/admin/users', modules)).toBe('admin');
  });

  it('returns null when nothing matches', () => {
    expect(activeModuleId('/unknown', modules)).toBeNull();
  });

  it('does not treat an unrelated path sharing a prefix string as active', () => {
    // '/financex' must NOT match '/finance' (guarded by the '/' boundary check).
    expect(activeModuleId('/financex', modules)).toBeNull();
  });
});

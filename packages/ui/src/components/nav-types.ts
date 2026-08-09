import type { Role } from '@cmc/auth';
import type { IconName } from './line-icon.js';

// Shared nav-tree shape for the admin shell nav (promoted from
// apps/admin/src/shell — P3 shell extraction; consumed by ConsoleNavbar).
// Data itself (NAV_MODULES) stays app-local; only the types move here.
export interface NavEntry {
  id: string;
  label: string;
  path: string;
  icon: IconName;
  permission?: { module: string; action: string };
}

export interface NavModule {
  id: string;
  label: string;
  icon: IconName;
  path: string;
  children?: NavEntry[];
  roles?: readonly Role[];
}

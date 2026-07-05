// @cmc/auth — permission registry (single source of RBAC truth).
//
// Business stories must gate through can()/requirePermission rather than
// hardcoding role arrays. This P0 scaffold ships a deny-by-default stub so no
// downstream story accidentally relies on an unimplemented grant; the real
// registry lands with the access-control epic.

export type PermissionModule = string;
export type PermissionAction = string;

export interface AuthSubject {
  userId: string;
  roles: readonly string[];
}

/**
 * Authorization primitive. Returns whether `subject` may perform `action` on
 * `module`. Scaffold implementation denies everything until the registry exists.
 */
export function can(
  _subject: AuthSubject | null,
  _module: PermissionModule,
  _action: PermissionAction,
): boolean {
  return false;
}

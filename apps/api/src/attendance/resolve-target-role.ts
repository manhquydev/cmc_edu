// Shared role-track resolver (ADR 0043 phase 4, red-team R3). Money-scope
// gates (payroll, KPI, manual-attendance-ticket approval) all need the same
// answer to "which track (sale/giao_vien) does this AppUser belong to, and
// which director role reviews that track" — previously duplicated as
// `resolvePayrollTargetRole` (apps/api/src/payroll/router.ts) and
// `resolveKpiTargetRole` (apps/api/src/kpi/auto-score.ts). Both now import
// from here instead (phase 5/6).

export type AttendanceTargetRole = 'sale' | 'giao_vien';

/**
 * Which money-scope track an AppUser's roles put them in. Checks
 * `AppUser.roles` (RBAC truth), NOT `AppUser.position` free text —
 * `resolveShiftGroup(position)` from `@cmc/domain-time` is a different,
 * shift-registration-specific resolver and must not be reused for
 * money-scope decisions (pre-existing R2-6 constraint, unchanged by ADR 0043).
 * Prefers `sale` when a roleset holds both (pre-existing convention).
 * Returns null for director-only/super_admin-only rolesets — no track.
 */
export function resolveTargetRole(roles: readonly string[]): AttendanceTargetRole | null {
  if (roles.includes('sale')) return 'sale';
  if (roles.includes('giao_vien')) return 'giao_vien';
  return null;
}

/** The director role that reviews a given track. Null track → null (no
 * director role reviews it; only `super_admin` may act). */
export function trackDirectorRole(track: AttendanceTargetRole | null): string | null {
  if (track === 'sale') return 'giam_doc_kinh_doanh';
  if (track === 'giao_vien') return 'giam_doc_dao_tao';
  return null;
}

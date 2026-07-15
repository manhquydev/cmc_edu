// resolveTargetRole / trackDirectorRole — shared role-track resolver
// (ADR 0043 phase 4, red-team R3: previously duplicated as
// resolvePayrollTargetRole in payroll/router.ts and resolveKpiTargetRole in
// kpi/auto-score.ts; both money-scope gates now share this one module).

import { describe, expect, it } from 'vitest';
import { resolveTargetRole, trackDirectorRole } from './resolve-target-role.js';

describe('resolveTargetRole', () => {
  it('returns "sale" when roles include sale', () => {
    expect(resolveTargetRole(['sale'])).toBe('sale');
  });

  it('returns "giao_vien" when roles include giao_vien', () => {
    expect(resolveTargetRole(['giao_vien'])).toBe('giao_vien');
  });

  it('prefers sale when a user holds both sale and giao_vien', () => {
    expect(resolveTargetRole(['giao_vien', 'sale'])).toBe('sale');
  });

  it('returns null for a director-only or super_admin-only roleset', () => {
    expect(resolveTargetRole(['giam_doc_kinh_doanh'])).toBeNull();
    expect(resolveTargetRole(['giam_doc_dao_tao'])).toBeNull();
    expect(resolveTargetRole(['super_admin'])).toBeNull();
    expect(resolveTargetRole([])).toBeNull();
  });
});

describe('trackDirectorRole', () => {
  it('maps sale to giam_doc_kinh_doanh', () => {
    expect(trackDirectorRole('sale')).toBe('giam_doc_kinh_doanh');
  });

  it('maps giao_vien to giam_doc_dao_tao', () => {
    expect(trackDirectorRole('giao_vien')).toBe('giam_doc_dao_tao');
  });

  it('maps null (no track) to null — only super_admin can act', () => {
    expect(trackDirectorRole(null)).toBeNull();
  });
});

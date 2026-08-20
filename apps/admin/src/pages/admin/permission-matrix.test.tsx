// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ACTIVE_ROLES, PERMISSIONS, ROLE_LABELS, type ActiveRole } from '@cmc/auth';
import { renderWithProviders } from '../../test/render-with-providers.js';
import PermissionMatrixPage, {
  MATRIX_RULE_ANNOTATIONS,
  REGISTRY_DOOR,
  SUPER_ADMIN_ALL,
  SUPER_ADMIN_ONLY,
  isEmptyRoster,
  roleHolds,
} from './permission-matrix.js';

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: ['giam_doc_dao_tao'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
    }),
    makeQueryClient: () => ({}),
  };
});
describe('PermissionMatrixPage', () => {
  it('renders every PERMISSIONS key and every ACTIVE_ROLES column', () => {
    renderWithProviders(<PermissionMatrixPage />);
    expect(screen.getByTestId('permission-matrix')).toBeTruthy();
    for (const key of Object.keys(PERMISSIONS)) {
      expect(screen.getByText(key, { exact: true }), key).toBeTruthy();
    }
    for (const role of ACTIVE_ROLES) {
      expect(screen.getByText(ROLE_LABELS[role], { exact: true })).toBeTruthy();
    }
  });

  it('shows Toàn quyền for super_admin on every key', () => {
    renderWithProviders(<PermissionMatrixPage />);
    const allMarks = screen.getAllByText(SUPER_ADMIN_ALL);
    expect(allMarks).toHaveLength(Object.keys(PERMISSIONS).length);
    for (const key of Object.keys(PERMISSIONS)) {
      expect(roleHolds('super_admin', key)).toBe(true);
    }
  });

  it('marks empty-roster keys as super-admin-only, never nobody', () => {
    const emptyKey = Object.keys(PERMISSIONS).find((key) => isEmptyRoster(key));
    expect(emptyKey).toBeTruthy();
    renderWithProviders(<PermissionMatrixPage />);
    const badges = screen.getAllByText(SUPER_ADMIN_ONLY);
    const emptyCount = Object.keys(PERMISSIONS).filter((key) => isEmptyRoster(key)).length;
    expect(badges).toHaveLength(emptyCount);
    expect(screen.queryByText(/nobody|không ai/i)).toBeNull();
    for (const role of ACTIVE_ROLES) {
      if (role === 'super_admin') continue;
      expect(roleHolds(role as ActiveRole, emptyKey!)).toBe(false);
    }
  });

  it('annotates SoD/row-rule keys separately from registry doors', () => {
    renderWithProviders(<PermissionMatrixPage />);
    const table = screen.getByTestId('permission-matrix');
    const doorOnly = Object.keys(PERMISSIONS).filter((key) => !MATRIX_RULE_ANNOTATIONS[key]).length;
    expect(table.querySelectorAll('td[data-permission-rule]')).toHaveLength(Object.keys(PERMISSIONS).length);
    expect(
      [...table.querySelectorAll('td[data-permission-rule]')].filter((el) => el.textContent === REGISTRY_DOOR),
    ).toHaveLength(doorOnly);
    for (const [key, note] of Object.entries(MATRIX_RULE_ANNOTATIONS)) {
      expect(PERMISSIONS[key], key).toBeDefined();
      expect(table.querySelector(`[data-permission-rule="${key}"]`)?.textContent).toContain(note);
    }
  });
  it('grants a cell only when the role is on that key\'s roster', () => {
    for (const [key, roster] of Object.entries(PERMISSIONS)) {
      for (const role of ACTIVE_ROLES) {
        if (role === 'super_admin') continue;
        expect(roleHolds(role, key)).toBe(roster.includes(role));
      }
    }
  });
});

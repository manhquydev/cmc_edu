// Read-only role → permission reference (RL3). Derived at render from
// `@cmc/auth`. No mutations, no toggles, no implied editor.

import type { CSSProperties } from 'react';
import {
  ACTIVE_ROLES,
  PERMISSIONS,
  ROLE_LABELS,
  can,
  type ActiveRole,
} from '@cmc/auth';
import { DetailPage, PageHeader, Stack, StatusBadge, Text } from '@cmc/ui';

/** Procedure-level rules the registry map cannot express. */
export const MATRIX_RULE_ANNOTATIONS: Record<string, string> = {
  'crm.opportunityAssign': 'Sale chỉ nhận lead của mình; GĐKD được gán lại.',
  'crm.report': 'Sale chỉ thấy báo cáo của chính mình (byAssignee).',
  'finance.receiptList': 'Sale soạn phiếu (receiptCreate) nhưng không xem hàng đợi.',
  'finance.receiptGet': 'Sale soạn phiếu (receiptCreate) nhưng không mở phiếu.',
  'finance.receiptApprove': 'Không tự duyệt phiếu của mình; phiếu vượt ngưỡng cần second-eye.',
  'kpi.confirm': 'Chỉ xác nhận khi managerId trùng người gọi.',
  'shift.approve': 'Không tự duyệt; GV do GĐĐT duyệt, KD do GĐKD duyệt.',
  'manualPunch.approve': 'Không tự duyệt; người duyệt phải là quản lý trực tiếp của chủ phiếu.',
  'user.manage': 'Giám đốc không được cấp hoặc thu hồi super_admin.',
};

export const REGISTRY_DOOR = 'cửa registry';
export const REGISTRY_DOOR_PLUS_RULE = 'cửa registry + luật SoD/row';
export const SUPER_ADMIN_ALL = 'Toàn quyền';
export const SUPER_ADMIN_ONLY = 'chỉ super_admin';

export function permissionModule(key: string): string {
  const dot = key.indexOf('.');
  return dot === -1 ? key : key.slice(0, dot);
}

export function roleHolds(role: ActiveRole, key: string): boolean {
  const dot = key.indexOf('.');
  const module = dot === -1 ? key : key.slice(0, dot);
  const action = dot === -1 ? '' : key.slice(dot + 1);
  return can({ userId: 'matrix', roles: [role] }, module, action);
}

export function isEmptyRoster(key: string): boolean {
  return (PERMISSIONS[key] ?? []).length === 0;
}

function groupedKeys(): Array<{ module: string; keys: string[] }> {
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(PERMISSIONS)) {
    const module = permissionModule(key);
    const list = groups.get(module);
    if (list) list.push(key);
    else groups.set(module, [key]);
  }
  return [...groups.entries()].map(([module, keys]) => ({ module, keys }));
}

export default function PermissionMatrixPage() {
  const groups = groupedKeys();

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          title="Ma trận quyền"
          subtitle="Bảng tham chiếu từ registry — không chỉnh sửa được tại đây."
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Ma trận quyền' }]}
        />
      }
    >
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)' }}>
          <Text type="supporting" size="sm">
            {REGISTRY_DOOR}: cửa mở theo roster. {REGISTRY_DOOR_PLUS_RULE}: thêm
            ràng buộc SoD/ownership trong procedure. {SUPER_ADMIN_ALL}: bypass{' '}
            <code>can()</code>. Roster rỗng = {SUPER_ADMIN_ONLY}.
          </Text>

          <div style={{ overflowX: 'auto' }}>
            <table
              data-testid="permission-matrix"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--cmc-font-size-data)',
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Quyền</th>
                  <th style={thStyle}>Luật</th>
                  {ACTIVE_ROLES.map((role) => (
                    <th key={role} style={thStyle}>
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <GroupRows key={group.module} module={group.module} keys={group.keys} />
                ))}
              </tbody>
            </table>
          </div>
        </Stack>
      </div>
    </DetailPage>
  );
}

function GroupRows({ module, keys }: { module: string; keys: string[] }) {
  return (
    <>
      <tr>
        <td
          colSpan={2 + ACTIVE_ROLES.length}
          style={{
            padding: 'var(--cmc-space-2)',
            background: 'var(--cmc-surface-2)',
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: 'var(--cmc-font-size-column)',
            letterSpacing: '0.04em',
          }}
        >
          {module}
        </td>
      </tr>
      {keys.map((key) => {
        const rule = MATRIX_RULE_ANNOTATIONS[key];
        const empty = isEmptyRoster(key);
        return (
          <tr key={key}>
            <td style={tdStyle}>
              <code>{key}</code>
              {empty ? (
                <span style={{ marginLeft: 'var(--cmc-space-1)' }}>
                  <StatusBadge status="disabled" label={SUPER_ADMIN_ONLY} size="sm" />
                </span>
              ) : null}
            </td>
            <td style={tdStyle} data-permission-rule={key}>
              {rule ? `${REGISTRY_DOOR_PLUS_RULE}: ${rule}` : REGISTRY_DOOR}
            </td>
            {ACTIVE_ROLES.map((role) => (
              <td key={role} style={{ ...tdStyle, textAlign: 'center' }}>
                {role === 'super_admin' ? (
                  SUPER_ADMIN_ALL
                ) : roleHolds(role, key) ? (
                  'Có'
                ) : (
                  '—'
                )}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: 'var(--cmc-space-2)',
  borderBottom: '1px solid var(--cmc-border)',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: 'var(--cmc-space-2)',
  borderBottom: '1px solid var(--cmc-border)',
  verticalAlign: 'top',
};

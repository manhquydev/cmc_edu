// AppUser record events — operational staff timeline (resource-depth Phase 4A).
//
// Kinds and payload shapes are FROZEN by the accepted plan (decisions.md):
//   created {}, profile_updated {fields[]}, roles_updated {roles[]},
//   password_reset {}, activated {}, deactivated {},
//   manager_changed {managerId|null}.
// Payloads are allowlists, never sanitized raw input. Password events carry
// no password, hash, token, OTP or credential metadata. Old/new email,
// fullName or position values are NEVER stored — profile_updated only names
// the changed fields.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

/** Server-fixed entity discriminator — the client never supplies it. */
export const STAFF_RECORD_EVENT_ENTITY = 'AppUser';

export const STAFF_RECORD_EVENT_KINDS = [
  'created',
  'profile_updated',
  'roles_updated',
  'password_reset',
  'activated',
  'deactivated',
  'manager_changed',
] as const;

export type StaffRecordEventKind = (typeof STAFF_RECORD_EVENT_KINDS)[number];

export const STAFF_RECORD_EVENT_LABELS = {
  created: 'Đã tạo hồ sơ nhân viên',
  profile_updated: 'Đã cập nhật hồ sơ',
  roles_updated: 'Đã thay đổi vai trò',
  password_reset: 'Đã đặt lại mật khẩu',
  activated: 'Đã kích hoạt tài khoản',
  deactivated: 'Đã vô hiệu tài khoản',
  manager_changed: 'Đã đổi người quản lý',
} as const satisfies Record<StaffRecordEventKind, string>;

export const UNKNOWN_STAFF_RECORD_EVENT_LABEL = 'Sự kiện không đọc được';

/** ICT calendar day AppUser event recording started (Phase 4A rollout). */
export const STAFF_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-18T00:00:00.000+07:00');

const KIND_SET: ReadonlySet<string> = new Set(STAFF_RECORD_EVENT_KINDS);

export function isStaffRecordEventKind(kind: string): kind is StaffRecordEventKind {
  return KIND_SET.has(kind);
}

export function labelForStaffRecordEventKind(kind: string): string {
  return isStaffRecordEventKind(kind) ? STAFF_RECORD_EVENT_LABELS[kind]
    : UNKNOWN_STAFF_RECORD_EVENT_LABEL;
}

/** Keys a password event payload may never contain — defense in depth on top
 *  of the allowlist; asserted in tests via serialized-row scans. */
const SECRET_SHAPED_KEY_RE = /(password|hash|token|otp|secret|credential)/i;

export function staffEventPayloadLeaksSecret(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return false;
  return Object.keys(payload).some((k) => SECRET_SHAPED_KEY_RE.test(k));
}

export type EmitStaffRecordEventArgs = {
  facilityId: string;
  /** The staff record the event describes (entityId). */
  appUserId: string;
  /** Raw actor identity as stored everywhere else (subject userId); the
   *  timeline endpoint projects it to a safe display label at read time. */
  actor: string;
} & (
  | { kind: 'created' }
  | { kind: 'profile_updated'; fields: string[] }
  | { kind: 'roles_updated'; roles: string[] }
  | { kind: 'password_reset' }
  | { kind: 'activated' }
  | { kind: 'deactivated' }
  | { kind: 'manager_changed'; managerId: string | null }
);

function payloadJson(
  args: EmitStaffRecordEventArgs,
): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'created':
    case 'password_reset':
    case 'activated':
    case 'deactivated':
      return undefined;
    case 'profile_updated':
      return { fields: [...new Set(args.fields)] };
    case 'roles_updated':
      return { roles: [...args.roles] };
    case 'manager_changed':
      return { managerId: args.managerId };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled staff event kind: ${JSON.stringify(_never)}`);
    }
  }
}

/** Append one staff event inside the caller's mutation transaction — the
 *  event commits or rolls back together with the AppUser write. */
export async function emitStaffRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitStaffRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: STAFF_RECORD_EVENT_ENTITY,
    entityId: args.appUserId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}

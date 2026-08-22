// ParentAccount record events — operational parent timeline.
// Kinds:
//   child_linked {parentAccountId, studentId, relation}
//   email_updated {}
//   active_changed {isActive}

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

export const PARENT_RECORD_EVENT_ENTITY = 'ParentAccount';

/** ICT calendar day ParentAccount event recording started. */
export const PARENT_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-19T00:00:00.000+07:00');

export const PARENT_RECORD_EVENT_KINDS = [
  'child_linked',
  'email_updated',
  'active_changed',
] as const;

export type ParentRecordEventKind = (typeof PARENT_RECORD_EVENT_KINDS)[number];

export const PARENT_RECORD_EVENT_LABELS: Record<ParentRecordEventKind, string> = {
  child_linked: 'Đã liên kết con',
  email_updated: 'Đã cập nhật email',
  active_changed: 'Đã đổi trạng thái LMS',
};

export function isParentRecordEventKind(kind: string): kind is ParentRecordEventKind {
  return PARENT_RECORD_EVENT_KINDS.includes(kind as ParentRecordEventKind);
}

export function labelForParentRecordEventKind(kind: string): string {
  return isParentRecordEventKind(kind)
    ? PARENT_RECORD_EVENT_LABELS[kind]
    : 'Sự kiện không đọc được';
}

export type EmitParentRecordEventArgs = {
  facilityId: string;
  parentAccountId: string;
  actor: string;
} & (
  | { kind: 'child_linked'; studentId: string; relation: 'father' | 'mother' | 'guardian' }
  | { kind: 'email_updated' }
  | { kind: 'active_changed'; isActive: boolean }
);

function payloadJson(args: EmitParentRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'email_updated':
      return undefined;
    case 'child_linked':
      return { studentId: args.studentId, relation: args.relation };
    case 'active_changed':
      return { isActive: args.isActive };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled parent event kind: ${JSON.stringify(_never)}`);
    }
  }
}

export async function emitParentRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitParentRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: PARENT_RECORD_EVENT_ENTITY,
    entityId: args.parentAccountId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}

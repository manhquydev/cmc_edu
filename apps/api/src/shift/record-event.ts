// ShiftRegistration operational history.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

export const SHIFT_RECORD_EVENT_ENTITY = 'ShiftRegistration';
export const SHIFT_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-20T00:00:00.000+07:00');

export const SHIFT_RECORD_EVENT_KINDS = ['submitted', 'approved', 'rejected', 'cancelled'] as const;
export type ShiftRecordEventKind = (typeof SHIFT_RECORD_EVENT_KINDS)[number];

export const SHIFT_RECORD_EVENT_LABELS: Record<ShiftRecordEventKind, string> = {
  submitted: 'Đã nộp đăng ký ca',
  approved: 'Đã duyệt đăng ký ca',
  rejected: 'Đã từ chối đăng ký ca',
  cancelled: 'Đã huỷ đăng ký ca',
};

export function isShiftRecordEventKind(kind: string): kind is ShiftRecordEventKind {
  return SHIFT_RECORD_EVENT_KINDS.includes(kind as ShiftRecordEventKind);
}

export function labelForShiftRecordEventKind(kind: string): string {
  return isShiftRecordEventKind(kind) ? SHIFT_RECORD_EVENT_LABELS[kind] : 'Sự kiện không đọc được';
}

export type EmitShiftRecordEventArgs = {
  facilityId: string;
  registrationId: string;
  actor: string;
} & (
  | { kind: 'submitted'; shiftGroupId: string; fromDate: string; toDate: string }
  | { kind: 'approved' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'cancelled' }
);

function payloadJson(args: EmitShiftRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'submitted':
      return { shiftGroupId: args.shiftGroupId, fromDate: args.fromDate, toDate: args.toDate };
    case 'rejected':
      return { reason: args.reason };
    case 'approved':
    case 'cancelled':
      return undefined;
    default: {
      const _never: never = args;
      throw new Error(`Unhandled shift event kind: ${JSON.stringify(_never)}`);
    }
  }
}

export async function emitShiftRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitShiftRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: SHIFT_RECORD_EVENT_ENTITY,
    entityId: args.registrationId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}

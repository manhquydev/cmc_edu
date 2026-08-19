// ParentMeeting operational history.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

export const PARENT_MEETING_RECORD_EVENT_ENTITY = 'ParentMeeting';
export const PARENT_MEETING_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-19T00:00:00.000+07:00');

export const PARENT_MEETING_RECORD_EVENT_KINDS = ['created', 'completed', 'cancelled'] as const;
export type ParentMeetingRecordEventKind = (typeof PARENT_MEETING_RECORD_EVENT_KINDS)[number];

export const PARENT_MEETING_RECORD_EVENT_LABELS: Record<ParentMeetingRecordEventKind, string> = {
  created: 'Đã đặt lịch họp',
  completed: 'Đã hoàn thành cuộc họp',
  cancelled: 'Đã huỷ cuộc họp',
};

export function isParentMeetingRecordEventKind(kind: string): kind is ParentMeetingRecordEventKind {
  return PARENT_MEETING_RECORD_EVENT_KINDS.includes(kind as ParentMeetingRecordEventKind);
}

export function labelForParentMeetingRecordEventKind(kind: string): string {
  return isParentMeetingRecordEventKind(kind) ? PARENT_MEETING_RECORD_EVENT_LABELS[kind] : 'Sự kiện không đọc được';
}

export type EmitParentMeetingRecordEventArgs = {
  facilityId: string;
  meetingId: string;
  actor: string;
} & (
  | { kind: 'created'; studentId: string }
  | { kind: 'completed' }
  | { kind: 'cancelled' }
);

function payloadJson(args: EmitParentMeetingRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'created':
      return { studentId: args.studentId };
    case 'completed':
    case 'cancelled':
      return undefined;
    default: {
      const _never: never = args;
      throw new Error(`Unhandled parent meeting event kind: ${JSON.stringify(_never)}`);
    }
  }
}

export async function emitParentMeetingRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitParentMeetingRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: PARENT_MEETING_RECORD_EVENT_ENTITY,
    entityId: args.meetingId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}

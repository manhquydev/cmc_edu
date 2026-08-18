// RecordEvent emit helper — append-only business history for CRM records.
// Kinds are a closed union (`satisfies`); payload is allowlisted per kind.
// Finance kinds (`enrolled`, `enrollment_reverted`) MUST NOT carry amount,
// receipt id/code, or approver (sale is SoD-blocked from receipt reads).

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

export const RECORD_EVENT_KINDS = [
  'created',
  'reopened',
  'marked_lost',
  'assigned',
  'next_action_set',
  'next_action_cleared',
  'stage_advanced',
  'enrolled',
  'enrollment_reverted',
  'note',
] as const;

export type RecordEventKind = (typeof RECORD_EVENT_KINDS)[number];

export const RECORD_EVENT_LABELS = {
  created: 'Cơ hội được tạo',
  reopened: 'Cơ hội được mở lại',
  marked_lost: 'Cơ hội bị đánh dấu mất',
  assigned: 'Đã giao phụ trách',
  next_action_set: 'Đã đặt việc cần làm',
  next_action_cleared: 'Đã xong việc cần làm',
  stage_advanced: 'Đã chuyển giai đoạn',
  enrolled: 'Đã nhập học',
  enrollment_reverted: 'Đã hoàn tác nhập học',
  note: 'Ghi chú',
} as const satisfies Record<RecordEventKind, string>;

export const UNKNOWN_RECORD_EVENT_LABEL = 'Sự kiện không đọc được';

/** ICT calendar day RecordEvent recording started (migration 20260813143000). */
export const RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-13T00:00:00.000+07:00');

const KIND_SET: ReadonlySet<string> = new Set(RECORD_EVENT_KINDS);

export function isRecordEventKind(kind: string): kind is RecordEventKind {
  return KIND_SET.has(kind);
}

export function labelForRecordEventKind(kind: string): string {
  if (isRecordEventKind(kind)) return RECORD_EVENT_LABELS[kind];
  return UNKNOWN_RECORD_EVENT_LABEL;
}

/** Compile-time exhaustiveness for the closed kind union. */
export function assertRecordEventKindExhaustive(kind: RecordEventKind): void {
  switch (kind) {
    case 'created':
    case 'reopened':
    case 'marked_lost':
    case 'assigned':
    case 'next_action_set':
    case 'next_action_cleared':
    case 'stage_advanced':
    case 'enrolled':
    case 'enrollment_reverted':
    case 'note':
      return;
    default: {
      const _never: never = kind;
      throw new Error(`Unhandled record event kind: ${String(_never)}`);
    }
  }
}

type EmitBase = {
  facilityId: string;
  entity: string;
  entityId: string;
  actor: string;
};

export type EmitRecordEventArgs = EmitBase &
  (
    | { kind: 'created'; payload?: { source: 'walkin' | 'import' } }
    | { kind: 'reopened' }
    | { kind: 'marked_lost'; payload: { lostReason: string } }
    | { kind: 'assigned'; payload: { assigneeUserId: string | null } }
    | { kind: 'next_action_set'; payload: { nextActionAt: string; nextActionNote: string } }
    | { kind: 'next_action_cleared' }
    | { kind: 'stage_advanced'; payload: { fromStage: string; toStage: string } }
    | { kind: 'enrolled' }
    | { kind: 'enrollment_reverted' }
    | { kind: 'note'; payload: { body: string } }
  );

const FORBIDDEN_FINANCE_PAYLOAD_KEYS = [
  'amount',
  'netAmount',
  'receiptId',
  'receiptCode',
  'approver',
  'approverId',
] as const;

/** True when a stored payload leaks money-gate fields sale must not see. */
export function financePayloadLeaksMoney(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const keys = Object.keys(payload);
  return FORBIDDEN_FINANCE_PAYLOAD_KEYS.some((k) => keys.includes(k));
}

function payloadJson(args: EmitRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'created':
      return args.payload ? { source: args.payload.source } : undefined;
    case 'reopened':
    case 'next_action_cleared':
    case 'enrolled':
    case 'enrollment_reverted':
      return undefined;
    case 'marked_lost':
      return { lostReason: args.payload.lostReason };
    case 'assigned':
      return { assigneeUserId: args.payload.assigneeUserId };
    case 'next_action_set':
      return {
        nextActionAt: args.payload.nextActionAt,
        nextActionNote: args.payload.nextActionNote,
      };
    case 'stage_advanced':
      return { fromStage: args.payload.fromStage, toStage: args.payload.toStage };
    case 'note':
      return { body: args.payload.body };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled record event kind: ${JSON.stringify(_never)}`);
    }
  }
}

export async function emitRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: args.entity,
    entityId: args.entityId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}

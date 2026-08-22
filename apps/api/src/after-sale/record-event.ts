// AfterSaleCase operational history.

import type { Prisma } from '@cmc/db';
import { appendRecordEvent } from '../record-event/store.js';

export const AFTER_SALE_RECORD_EVENT_ENTITY = 'AfterSaleCase';
export const AFTER_SALE_RECORD_EVENT_HISTORY_SINCE = new Date('2026-08-20T00:00:00.000+07:00');

export const AFTER_SALE_RECORD_EVENT_KINDS = ['created', 'status_changed'] as const;
export type AfterSaleRecordEventKind = (typeof AFTER_SALE_RECORD_EVENT_KINDS)[number];

export const AFTER_SALE_RECORD_EVENT_LABELS: Record<AfterSaleRecordEventKind, string> = {
  created: 'Đã mở case sau bán',
  status_changed: 'Đã đổi trạng thái case',
};

export function isAfterSaleRecordEventKind(kind: string): kind is AfterSaleRecordEventKind {
  return AFTER_SALE_RECORD_EVENT_KINDS.includes(kind as AfterSaleRecordEventKind);
}

export function labelForAfterSaleRecordEventKind(kind: string): string {
  return isAfterSaleRecordEventKind(kind)
    ? AFTER_SALE_RECORD_EVENT_LABELS[kind]
    : 'Sự kiện không đọc được';
}

export type EmitAfterSaleRecordEventArgs = {
  facilityId: string;
  caseId: string;
  actor: string;
} & (
  | { kind: 'created'; studentId: string; priority: string }
  | { kind: 'status_changed'; from: string; to: string }
);

function payloadJson(args: EmitAfterSaleRecordEventArgs): Prisma.InputJsonValue | undefined {
  switch (args.kind) {
    case 'created':
      return { studentId: args.studentId, priority: args.priority };
    case 'status_changed':
      return { from: args.from, to: args.to };
    default: {
      const _never: never = args;
      throw new Error(`Unhandled after-sale event kind: ${JSON.stringify(_never)}`);
    }
  }
}

export async function emitAfterSaleRecordEvent(
  tx: Prisma.TransactionClient,
  args: EmitAfterSaleRecordEventArgs,
): Promise<void> {
  const payload = payloadJson(args);
  await appendRecordEvent(tx, {
    facilityId: args.facilityId,
    entity: AFTER_SALE_RECORD_EVENT_ENTITY,
    entityId: args.caseId,
    kind: args.kind,
    actor: args.actor,
    ...(payload !== undefined ? { payload } : {}),
  });
}
